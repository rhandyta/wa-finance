const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { logger } = require('../logger');
const { inc } = require('../metrics');

function createApp({ apiKey } = {}) {
  const app = express();
  const otpSecret =
    (process.env.AUTH_OTP_SECRET && String(process.env.AUTH_OTP_SECRET).trim()) ||
    (process.env.HTTP_API_KEY && String(process.env.HTTP_API_KEY).trim()) ||
    crypto.randomBytes(32).toString('base64url');
  app.locals.auth = {
    otpSecret,
    otpByKey: new Map(),
    otpAttemptsByKey: new Map(),
    sessionByToken: new Map(),
  };

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const corsAllowedRaw = (process.env.CORS_ALLOW_ORIGINS || '').trim();
  const corsAllowed = corsAllowedRaw
    ? corsAllowedRaw
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : null;

  const globToRegExp = (pattern) => {
    const escaped = String(pattern)
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
  };

  const isLoopbackHost = (host) => {
    const h = String(host || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1';
  };

  const isAllowedOrigin = (origin) => {
    if (!origin) return false;
    if (corsAllowed && corsAllowed.length > 0) {
      if (corsAllowed.includes('*')) return true;
      if (corsAllowed.includes(origin)) return true;

      let originUrl = null;
      try {
        originUrl = new URL(origin);
      } catch {
        originUrl = null;
      }

      for (const allowed of corsAllowed) {
        if (!allowed) continue;
        if (allowed === 'null' && origin === 'null') return true;
        if (allowed.includes('*') && globToRegExp(allowed).test(origin)) return true;

        if (originUrl) {
          let allowedUrl = null;
          try {
            allowedUrl = new URL(allowed);
          } catch {
            allowedUrl = null;
          }
          if (
            allowedUrl &&
            allowedUrl.protocol === originUrl.protocol &&
            allowedUrl.port === originUrl.port &&
            isLoopbackHost(allowedUrl.hostname) &&
            isLoopbackHost(originUrl.hostname)
          ) {
            return true;
          }
        }
      }
      return false;
    }

    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  };

  app.locals.cors = {
    allowed: corsAllowed,
    isAllowedOrigin,
  };

  app.use((req, res, next) => {
    const origin = req.header('origin');
    if (!origin) return next();

    if (!isAllowedOrigin(origin)) return next();

    if (corsAllowed && corsAllowed.includes('*')) {
      res.setHeader('access-control-allow-origin', '*');
    } else {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'origin');
    }
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type, authorization, x-api-key');
    res.setHeader('access-control-max-age', '600');

    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 30,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(
    '/api/import',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 5,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(express.json({ limit: '256kb' }));

  const pruneAuthCaches = () => {
    const now = Date.now();
    const last = app.locals.auth.lastPruneAt || 0;
    if (now - last < 60 * 1000) return;
    app.locals.auth.lastPruneAt = now;

    for (const [key, value] of app.locals.auth.otpByKey.entries()) {
      if (!value || !value.expiresAt || now > value.expiresAt) {
        app.locals.auth.otpByKey.delete(key);
      }
    }
    for (const [key, value] of app.locals.auth.sessionByToken.entries()) {
      if (!value || !value.expiresAt || now > value.expiresAt) {
        app.locals.auth.sessionByToken.delete(key);
      }
    }
  };

  app.use((req, res, next) => {
    pruneAuthCaches();
    const start = process.hrtime.bigint();
    const requestId = crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    res.on('finish', () => {
      inc('http_requests', 1);
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
      if (res.statusCode >= 500) inc('http_errors', 1);
      logger.info('http_request', {
        request_id: requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Math.round(elapsedMs),
      });
    });
    next();
  });

  const safeEquals = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  };

  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    if (req.path.startsWith('/api/auth/')) return next();

    const authHeader = req.header('authorization');
    const bearerMatch = authHeader ? String(authHeader).match(/^Bearer\s+(.+)$/i) : null;
    const bearerToken = bearerMatch ? bearerMatch[1].trim() : null;
    if (bearerToken) {
      const session = app.locals.auth.sessionByToken.get(bearerToken) || null;
      if (!session) return res.status(401).json({ error: 'Unauthorized' });
      if (session.expiresAt && Date.now() > session.expiresAt) {
        app.locals.auth.sessionByToken.delete(bearerToken);
        return res.status(401).json({ error: 'Unauthorized' });
      }
      req.auth = { userId: session.userId, accountId: session.accountId };
      return next();
    }

    if (apiKey) {
      const provided = req.header('x-api-key');
      if (!provided || !safeEquals(provided, apiKey)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized' });
  });

  return app;
}

module.exports = { createApp };
