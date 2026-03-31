const crypto = require('crypto');
const { recognizeText } = require('../../ocr');
const { structureText } = require('../../ai');
const { saveReceipt } = require('../../file-saver');
const {
  findTransactionByReceiptHash,
  findTransactionByTextHash,
  findTransactionByFingerprint,
  resolveCategoryFromText,
  resolveMerchantFromText,
} = require('../../db');
const { splitIntoTransactions, formatDateYyyyMmDd } = require('../utils');
const { setUserState } = require('../state');
const { sendPendingTransactionPreview } = require('./pending');

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function normalizeTextForHash(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Resolves relative date keywords in text into an absolute date string.
 * Returns `null` if no relative date keyword is found.
 */
function resolveRelativeDate(text) {
  const lower = text.toLowerCase();
  const now = new Date();

  // Next month: "bulan depan", "depan", "bulan berikutnya", "next month", "next"
  if (/bulan depan|bulan berikutnya|next month|\bdepan\b|\bnext\b/i.test(lower)) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return formatDateYyyyMmDd(d);
  }

  // Tomorrow: "besok", "tomorrow"
  if (/\bbesok\b|\btomorrow\b/i.test(lower)) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return formatDateYyyyMmDd(d);
  }

  // Yesterday: "kemarin", "yesterday"
  if (/\bkemarin\b|\byesterday\b/i.test(lower)) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return formatDateYyyyMmDd(d);
  }

  return null;
}

async function processTransaction(message, senderId, accountId) {
  let rawText = message.body;
  let mediaFile = null;
  let receiptHash = null;
  let ocrText = '';
  let textHash = null;

  if (message.hasMedia) {
    const media = await message.downloadMedia();
    if (media && media.mimetype.startsWith('image/')) {
      mediaFile = media;
      try {
        const buffer = Buffer.from(media.data, 'base64');
        receiptHash = crypto.createHash('sha256').update(buffer).digest('hex');
      } catch {
        receiptHash = null;
      }
      try {
        ocrText = await recognizeText(media.data);
        rawText = `${rawText} ${ocrText}`;
        const normalizedOcr = normalizeTextForHash(ocrText);
        textHash = normalizedOcr ? sha256Hex(normalizedOcr) : null;
      } catch {
        ocrText = '';
      }
    }
  }

  if (rawText.trim().length === 0) {
    if (mediaFile) {
      return message.reply(
        'Maaf, tidak ada teks yang bisa dibaca dari gambar tersebut. Coba foto dengan lebih jelas.',
      );
    }
    return;
  }

  // Resolve relative date keywords BEFORE sending to AI
  const forcedDate = resolveRelativeDate(rawText);

  try {
    const parts = splitIntoTransactions(rawText);
    const transactions = [];
    const receiptPath = mediaFile ? await saveReceipt(mediaFile) : null;
    const dupByReceipt = receiptHash ? await findTransactionByReceiptHash(accountId, receiptHash) : null;
    const dupByText = textHash ? await findTransactionByTextHash(accountId, textHash) : null;
    const duplicates = [];
    if (dupByReceipt) duplicates.push({ reason: 'receipt', ...dupByReceipt });
    if (dupByText) duplicates.push({ reason: 'text', ...dupByText });

    for (const part of parts) {
      try {
        const structuredData = await structureText(part);
        if (structuredData.error && structuredData.error === 'Bukan transaksi') {
          continue;
        }
        const resolvedCategory = await resolveCategoryFromText(accountId, structuredData.keterangan || part);
        if (resolvedCategory) {
          structuredData.kategori = resolvedCategory;
        }
        const resolvedMerchant = await resolveMerchantFromText(accountId, structuredData.keterangan || part);
        if (resolvedMerchant) {
          structuredData.merchant = resolvedMerchant;
        }
        structuredData.receipt_path = receiptPath;
        structuredData.receipt_hash = receiptHash;
        structuredData.text_hash = textHash;

        // Override date: forcedDate always wins over AI's guess or default
        if (forcedDate) {
          structuredData.transaction_date = forcedDate;
        } else if (!structuredData.transaction_date) {
          structuredData.transaction_date = formatDateYyyyMmDd(new Date());
        }

        const fingerprintSource = normalizeTextForHash(
          [
            structuredData.transaction_date,
            structuredData.tipe,
            structuredData.nominal,
            structuredData.currency,
            structuredData.kategori,
            structuredData.keterangan,
          ].join('|'),
        );
        structuredData.fingerprint_hash = fingerprintSource ? sha256Hex(fingerprintSource) : null;
        const dupByFingerprint = structuredData.fingerprint_hash
          ? await findTransactionByFingerprint(accountId, structuredData.fingerprint_hash)
          : null;
        structuredData.duplicate = dupByFingerprint ? { reason: 'fingerprint', ...dupByFingerprint } : null;
        transactions.push(structuredData);
      } catch (error) {
        console.error(`Failed to process part: "${part}"`, error);
      }
    }

    if (transactions.length === 0) {
      return message.reply('Tidak ada transaksi yang bisa dicatat dari pesan ini.');
    }

    const state = {
      step: 'awaiting_tx_confirmation',
      accountId,
      receiptPath,
      receiptHash,
      duplicates,
      transactions,
    };
    setUserState(senderId, state);
    await sendPendingTransactionPreview(message, senderId, state);
  } catch (error) {
    console.error('Full error trace:', error);
    message.reply('Waduh, AI-nya lagi pusing, atau formatnya aneh. Gagal mencatat transaksi.');
  }
}

module.exports = { processTransaction };
