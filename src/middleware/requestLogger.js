'use strict';

const logger = require('../utils/logger');

/**
 * Express middleware that logs every incoming request and its response time.
 */
function requestLogger(req, res, next) {
  const startAt = process.hrtime.bigint();

  // Log when response finishes
  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startAt;
    const elapsedMs = Number(elapsedNs / 1_000_000n);
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info';

    logger[level](`${req.method} ${req.originalUrl} → ${res.statusCode} (${elapsedMs}ms)`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: elapsedMs,
      ip: req.ip,
      userAgent: req.get('user-agent') || '—',
    });
  });

  next();
}

module.exports = { requestLogger };
