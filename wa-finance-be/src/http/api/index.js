const express = require('express');
const crypto = require('crypto');
const { joinAccountByToken, getUserCurrency } = require('../../db');
const { getBotClient } = require('../../bot');
const { dashboardRouter } = require('./dashboard');
const { transactionsRouter } = require('./transactions');
const { auditRouter } = require('./audit');
const { importRouter } = require('./import');

const router = express.Router();

function normalizePhoneToChatId(rawPhone) {
  const digits = String(rawPhone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!digits) return null;
  let normalized = digits;
  if (normalized.startsWith('0')) normalized = `62${normalized.slice(1)}`;
  if (normalized.startsWith('8')) normalized = `62${normalized}`;
  if (!normalized.startsWith('62')) return null;
  if (normalized.length < 10 || normalized.length > 16) return null;
  return `${normalized}@c.us`;
}

function allowAttempt(bucketMap, key, limit, windowMs) {
  const now = Date.now();
  const existing = bucketMap.get(key);
  if (!existing || now > existing.resetAt) {
    bucketMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

function sha256Base64Url(input) {
  return crypto.createHash('sha256').update(String(input)).digest('base64url');
}

router.post('/auth/request-otp', async (req, res) => {
  const phone = req.body?.phone;
  const token = String(req.body?.token || '').trim();
  const chatId = normalizePhoneToChatId(phone);
  if (!chatId) return res.status(400).json({ ok: false, error: 'phone invalid' });
  if (!token || !/^[A-Za-z0-9_-]{8,64}$/.test(token)) {
    return res.status(400).json({ ok: false, error: 'token invalid' });
  }

  const client = getBotClient();
  if (!client) return res.status(503).json({ ok: false, error: 'whatsapp not ready' });

  const attemptKey = `otp:${chatId}`;
  const okAttempt = allowAttempt(req.app.locals.auth.otpAttemptsByKey, attemptKey, 3, 10 * 60 * 1000);
  if (!okAttempt) return res.status(429).json({ ok: false, error: 'too_many_requests' });

  const otp = String(crypto.randomInt(100000, 1000000));
  const key = `${chatId}:${token}`;
  const otpHash = sha256Base64Url(`${otp}:${key}:${req.app.locals.auth.otpSecret}`);
  req.app.locals.auth.otpByKey.set(key, {
    otpHash,
    expiresAt: Date.now() + 5 * 60 * 1000,
    remaining: 5,
  });

  try {
    await client.sendMessage(chatId, `Kode OTP dashboard: ${otp}\nBerlaku 5 menit.`);
    return res.json({ ok: true, data: { sent: true } });
  } catch {
    req.app.locals.auth.otpByKey.delete(key);
    return res.status(503).json({ ok: false, error: 'whatsapp not ready' });
  }
});

router.post('/auth/verify-otp', async (req, res) => {
  const phone = req.body?.phone;
  const token = String(req.body?.token || '').trim();
  const otp = String(req.body?.otp || '').trim();
  const chatId = normalizePhoneToChatId(phone);
  if (!chatId) return res.status(400).json({ ok: false, error: 'phone invalid' });
  if (!token || !/^[A-Za-z0-9_-]{8,64}$/.test(token)) {
    return res.status(400).json({ ok: false, error: 'token invalid' });
  }
  if (!/^\d{6}$/.test(otp)) return res.status(400).json({ ok: false, error: 'otp invalid' });

  const key = `${chatId}:${token}`;
  const stored = req.app.locals.auth.otpByKey.get(key) || null;
  if (!stored) return res.status(400).json({ ok: false, error: 'otp invalid' });
  if (stored.expiresAt && Date.now() > stored.expiresAt) {
    req.app.locals.auth.otpByKey.delete(key);
    return res.status(400).json({ ok: false, error: 'otp expired' });
  }
  stored.remaining = (stored.remaining || 0) - 1;
  if (stored.remaining < 0) {
    req.app.locals.auth.otpByKey.delete(key);
    return res.status(429).json({ ok: false, error: 'too_many_attempts' });
  }

  const otpHash = sha256Base64Url(`${otp}:${key}:${req.app.locals.auth.otpSecret}`);
  if (otpHash !== stored.otpHash) {
    return res.status(400).json({ ok: false, error: 'otp invalid' });
  }

  req.app.locals.auth.otpByKey.delete(key);

  const { accountId } = await joinAccountByToken(chatId, token);
  const currency = await getUserCurrency(chatId);
  const sessionToken = crypto.randomBytes(32).toString('base64url');
  const ttlMs = 30 * 24 * 60 * 60 * 1000;
  req.app.locals.auth.sessionByToken.set(sessionToken, {
    userId: chatId,
    accountId,
    expiresAt: Date.now() + ttlMs,
  });

  return res.json({ ok: true, data: { sessionToken, currency } });
});

router.use('/dashboard', dashboardRouter);
router.use('/transactions', transactionsRouter);
router.use('/audit', auditRouter);
router.use('/import', importRouter);

router.use((err, req, res, next) => {
  const status = err?.status || 500;
  res.status(status).json({ ok: false, error: err?.message || 'error' });
});

module.exports = { apiRouter: router };
