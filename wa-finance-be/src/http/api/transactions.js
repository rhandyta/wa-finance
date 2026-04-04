const express = require('express');
const { 
  listTransactions, 
  getTransactionDetail,
  createTransactionWithItems,
  updateTransactionWithItems,
  deleteTransaction,
} = require('../../db');
const { requiredInt, optionalInt, optionalBool, optionalDate, optionalCurrency } = require('./utils');

const router = express.Router();

// GET /api/transactions - List transactions with pagination
router.get('/', async (req, res) => {
  try {
    const accountId = Number.isFinite(req.auth?.accountId)
      ? req.auth.accountId
      : requiredInt(req.query.accountId, 'accountId');
    const startDate = req.query.start ? optionalDate(req.query.start) : null;
    const endDate = req.query.end ? optionalDate(req.query.end) : null;
    const type = req.query.type ? String(req.query.type) : null;
    const category = req.query.category ? String(req.query.category) : null;
    const merchant = req.query.merchant ? String(req.query.merchant) : null;
    const q = req.query.q ? String(req.query.q) : null;
    const limit = optionalInt(req.query.limit, 20);
    const offset = optionalInt(req.query.offset, 0);
    const includeItems = optionalBool(req.query.includeItems, false);
    const currency = req.query.currency ? optionalCurrency(req.query.currency, null) : null;

    // Ensure accountId is valid
    if (!Number.isFinite(accountId) || accountId <= 0) {
      return res.status(400).json({ ok: false, error: 'account_id invalid' });
    }

    const data = await listTransactions(
      accountId,
      { startDate, endDate, type, category, merchant, q, limit, offset, includeItems },
      currency,
    );
    res.json({ ok: true, data });
  } catch (error) {
    console.error('transactions_list_error:', error.message, { accountId: req.auth?.accountId });
    res.status(500).json({ ok: false, error: error.message || 'Failed to list transactions' });
  }
});

// POST /api/transactions - Create new transaction
router.post('/', async (req, res) => {
  try {
    const accountId = req.auth?.accountId;
    if (!Number.isFinite(accountId)) {
      return res.status(400).json({ ok: false, error: 'account_id required' });
    }

    const {
      transaction_date,
      type,
      amount,
      currency = 'IDR',
      category,
      merchant = null,
      description = null,
      items = [],
    } = req.body || {};

    // Validation
    if (!transaction_date) return res.status(400).json({ ok: false, error: 'transaction_date required' });
    if (!type || !['IN', 'OUT'].includes(type)) return res.status(400).json({ ok: false, error: 'type must be IN or OUT' });
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ ok: false, error: 'amount must be positive number' });
    if (!category) return res.status(400).json({ ok: false, error: 'category required' });

    // Validate items if provided
    if (items && !Array.isArray(items)) {
      return res.status(400).json({ ok: false, error: 'items must be an array' });
    }
    if (items && items.length > 0) {
      for (const item of items) {
        if (!item.item_name) return res.status(400).json({ ok: false, error: 'item.item_name required' });
        if (!item.price || isNaN(Number(item.price))) return res.status(400).json({ ok: false, error: 'item.price required' });
      }
    }

    const txData = {
      transaction_date,
      type,
      amount: Number(amount),
      currency: String(currency).toUpperCase(),
      category: String(category),
      merchant: merchant ? String(merchant) : null,
      description: description ? String(description) : null,
    };

    const transactionId = await createTransactionWithItems(accountId, txData, items, req.auth?.userId);
    res.status(201).json({ ok: true, data: { id: transactionId } });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message || 'Failed to create transaction' });
  }
});

// GET /api/transactions/:id - Get transaction detail
router.get('/:id', async (req, res) => {
  const accountId = Number.isFinite(req.auth?.accountId)
    ? req.auth.accountId
    : requiredInt(req.query.accountId, 'accountId');
  const currency = req.query.currency ? optionalCurrency(req.query.currency, null) : null;
  const data = await getTransactionDetail(accountId, req.params.id, currency);
  if (!data) return res.status(404).json({ ok: false, error: 'not_found' });
  res.json({ ok: true, data });
});

// PUT /api/transactions/:id - Update transaction
router.put('/:id', async (req, res) => {
  try {
    const accountId = req.auth?.accountId;
    if (!Number.isFinite(accountId)) {
      return res.status(400).json({ ok: false, error: 'account_id required' });
    }

    const transactionId = parseInt(req.params.id, 10);
    if (!Number.isFinite(transactionId) || transactionId <= 0) {
      return res.status(400).json({ ok: false, error: 'invalid transaction id' });
    }

    const {
      transaction_date,
      type,
      amount,
      currency,
      category,
      merchant,
      description,
      items,
    } = req.body || {};

    const txData = {};
    if (transaction_date) txData.transaction_date = transaction_date;
    if (type && ['IN', 'OUT'].includes(type)) txData.type = type;
    if (amount && !isNaN(Number(amount)) && Number(amount) > 0) txData.amount = Number(amount);
    if (currency) txData.currency = String(currency).toUpperCase();
    if (category) txData.category = String(category);
    if (merchant !== undefined) txData.merchant = merchant ? String(merchant) : null;
    if (description !== undefined) txData.description = description ? String(description) : null;

    if (Object.keys(txData).length === 0 && items === undefined) {
      return res.status(400).json({ ok: false, error: 'no valid fields to update' });
    }

    // Validate items if provided
    if (items !== null) {
      if (!Array.isArray(items)) {
        return res.status(400).json({ ok: false, error: 'items must be an array or null' });
      }
      for (const item of items) {
        if (!item.item_name) return res.status(400).json({ ok: false, error: 'item.item_name required' });
        if (!item.price || isNaN(Number(item.price))) return res.status(400).json({ ok: false, error: 'item.price required' });
      }
    }

    const updatedId = await updateTransactionWithItems(accountId, transactionId, txData, items, req.auth?.userId);
    res.json({ ok: true, data: { id: updatedId } });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message || 'Failed to update transaction' });
  }
});

// DELETE /api/transactions/:id - Delete transaction
router.delete('/:id', async (req, res) => {
  try {
    const accountId = req.auth?.accountId;
    if (!Number.isFinite(accountId)) {
      return res.status(400).json({ ok: false, error: 'account_id required' });
    }

    const transactionId = parseInt(req.params.id, 10);
    if (!Number.isFinite(transactionId) || transactionId <= 0) {
      return res.status(400).json({ ok: false, error: 'invalid transaction id' });
    }

    const result = await deleteTransaction(accountId, transactionId, req.auth?.userId);
    res.json({ ok: true, data: result });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message || 'Failed to delete transaction' });
  }
});

module.exports = { transactionsRouter: router };
