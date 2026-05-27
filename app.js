'use strict';

const express = require('express');
const { requestLogger } = require('./middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const routes = require('./api/routes');
const logger = require('./utils/logger');
const { config } = require('./config');

function createApp() {
  const app = express();

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Trust proxy (for accurate IP logging behind load balancers) ───────────
  if (config.env === 'production') app.set('trust proxy', 1);

  // ── Request logging ───────────────────────────────────────────────────────
  app.use(requestLogger);

  // ── Security headers (minimal, no external dep) ───────────────────────────
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.removeHeader('X-Powered-By');
    next();
  });

  // ── CORS (permissive for local dev; restrict in production) ───────────────
  app.use((req, res, next) => {
    const origin = process.env.CORS_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use(routes);

  // ── 404 ───────────────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ── Error handler (must be last) ──────────────────────────────────────────
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
