const { getUserCurrency, setMonthlyBudget, listMonthlyBudgets, getSpendingByCategory, convertAmount } = require('../../db');
const { formatMoney } = require('../utils');

async function handleBudget(message, senderId, accountId, rawMessageBody, canWrite) {
  const parts = rawMessageBody.trim().split(/\s+/);
  const cmd = (parts[1] || '').toLowerCase();
  
  let targetDate = new Date();
  const isNext = parts.some(p => /^(next|depan)$/i.test(p));
  if (isNext) {
    // Set to 1st to avoid overflow if today is 31st and next month has 30 days
    targetDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
  }

  const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
  const userCurrency = await getUserCurrency(senderId);

  if (cmd === 'set') {
    if (!canWrite) {
      await message.reply('Mode monitoring tidak bisa set budget. Kirim "monitor off" dulu.');
      return;
    }
    const tail = rawMessageBody
      .replace(/^budget\s+set\s+/i, '')
      .replace(/\s+(next|depan)(\s+|$)/i, ' ')
      .replace(/^(next|depan)\s+/i, '')
      .trim();
    const m = tail.match(/^(.*)\s+(\d[\d.,]*)$/);
    if (!m) {
      await message.reply('Format: "budget set <kategori> <jumlah>"');
      return;
    }
    const category = m[1].trim();
    const amount = parseInt(m[2].replace(/[^0-9]/g, ''), 10);
    if (!category || !Number.isFinite(amount)) {
      await message.reply('Kategori/jumlah tidak valid.');
      return;
    }
    await setMonthlyBudget(accountId, senderId, monthKey, category, amount, userCurrency);
    await message.reply(`✅ Budget diset: ${category} = Rp${formatMoney(amount)} (${monthKey})`);
    return;
  }

  if (cmd === 'list' || cmd === 'status' || cmd === '') {
    const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1).toISOString().slice(0, 10);
    const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).toISOString().slice(0, 10);
    const budgets = await listMonthlyBudgets(accountId, monthKey);
    const spend = await getSpendingByCategory(accountId, startDate, endDate, userCurrency);
    if (budgets.length === 0) {
      await message.reply(`Belum ada budget untuk ${isNext ? 'bulan depan ' : ''}(${monthKey}). Contoh: "budget set Makan 1500000"`);
      return;
    }
    let txt = `📌 *Budget (${monthKey})*\n\n`;
    budgets.forEach((b) => {
      const spent = spend[b.category] || 0;
      const limit = convertAmount(parseFloat(b.limit_amount), b.currency, userCurrency);
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      txt += `- ${b.category}: Rp${formatMoney(spent)} / Rp${formatMoney(limit)} (${pct}%)\n`;
    });
    await message.reply(txt);
    return;
  }

  await message.reply('Perintah budget: "budget set <kategori> <jumlah> [next/depan]" atau "budget list [next/depan]"');
}

module.exports = { handleBudget };
