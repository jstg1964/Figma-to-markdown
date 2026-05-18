'use strict';

const { Router } = require('express');
const { config } = require('../../config');
const { cache } = require('../../utils/cache');

const router = Router();

/**
 * GET /health
 * Basic liveness probe — always returns 200 if the server is up.
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    env: config.env,
  });
});

/**
 * GET /health/ready
 * Readiness probe — checks that required config is present.
 */
router.get('/health/ready', (req, res) => {
  const ready = Boolean(config.figma.accessToken);
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks: {
      figmaToken: ready ? 'ok' : 'missing',
    },
  });
});

/**
 * GET /health/cache
 * Returns cache statistics.
 */
router.get('/health/cache', (req, res) => {
  res.json({
    cache: {
      enabled: config.cache.enabled,
      ...cache.stats(),
    },
  });
});

/**
 * DELETE /health/cache
 * Flush the in-memory cache.
 */
router.delete('/health/cache', (req, res) => {
  cache.clear();
  res.json({ status: 'ok', message: 'Cache cleared.' });
});

module.exports = router;
