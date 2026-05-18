'use strict';

const { validateConfig } = require('./src/config');

// Validate required environment variables before starting
try {
  validateConfig();
} catch (err) {
  console.error(`\n❌  Configuration error:\n   ${err.message}\n`);
  process.exit(1);
}

const { createApp } = require('./src/app');
const { config }    = require('./src/config');
const logger        = require('./src/utils/logger');

const app    = createApp();
const server = app.listen(config.port, () => {
  logger.info(`🚀  figma-to-markdown server running`);
  logger.info(`    ENV  : ${config.env}`);
  logger.info(`    PORT : ${config.port}`);
  logger.info(`    CACHE: ${config.cache.enabled ? `enabled (TTL ${config.cache.ttlSeconds}s)` : 'disabled'}`);
  logger.info(`    LOG  : ${config.log.level} / ${config.log.format}`);
  logger.info('');
  logger.info('  Endpoints:');
  logger.info(`    GET /health`);
  logger.info(`    GET /health/ready`);
  logger.info(`    GET /api/figma/:fileKey/json`);
  logger.info(`    GET /api/figma/:fileKey/markdown`);
  logger.info(`    GET /api/figma/:fileKey/nodes?nodeIds=id1,id2`);
  logger.info(`    GET /api/figma/:fileKey/flows`);
  logger.info(`    GET /api/figma/:fileKey/interactions`);
  logger.info(`    GET /api/figma/:fileKey/components`);
  logger.info(`    GET /api/figma/:fileKey/styles`);
  logger.info(`    GET /api/figma/:fileKey/images?nodeIds=id1&format=png`);
  logger.info(`    GET /api/figma/:fileKey/versions`);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully…`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
  // Force exit after 10 s if still hanging
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — shutting down', { message: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
  process.exit(1);
});

module.exports = server; // for testing
