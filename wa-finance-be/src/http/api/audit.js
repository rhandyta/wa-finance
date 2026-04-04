const express = require('express');
const { listAuditLogs } = require('../../db');
const { requiredInt, optionalInt, optionalDate } = require('./utils');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const accountId = Number.isFinite(req.auth?.accountId)
      ? req.auth.accountId
      : requiredInt(req.query.accountId, 'accountId');
    const startDate = req.query.start ? optionalDate(req.query.start) : null;
    const endDate = req.query.end ? optionalDate(req.query.end) : null;
    const action = req.query.action ? String(req.query.action) : null;
    const limit = optionalInt(req.query.limit, 50);
    const offset = optionalInt(req.query.offset, 0);

    // Ensure accountId is valid
    if (!Number.isFinite(accountId) || accountId <= 0) {
      return res.status(400).json({ ok: false, error: 'account_id invalid' });
    }

    const data = await listAuditLogs(accountId, { startDate, endDate, action, limit, offset });
    res.json({ ok: true, data });
  } catch (error) {
    console.error('audit_logs_error:', error.message, { accountId: req.auth?.accountId });
    res.status(500).json({ ok: false, error: error.message || 'Failed to list audit logs' });
  }
});

module.exports = { auditRouter: router };
