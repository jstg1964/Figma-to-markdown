'use strict';

const logger = require('../utils/logger');
const { FigmaApiError } = require('../api/figmaClient');

/**
 * Centralised Express error handler.
 * Must be registered LAST (after all routes).
 * Handles both operational and programming errors with structured JSON responses.
 */
function errorHandler(err, req, res, next) {
  // Already sent — let Express default handler close the connection
  if (res.headersSent) return next(err);

  const isDev = process.env.NODE_ENV !== 'production';

  // ---- Figma API errors ----
  if (err instanceof FigmaApiError) {
    const status = _mapFigmaStatus(err.statusCode);
    logger.warn(`Figma API error [${err.statusCode}]: ${err.message}`, {
      path: req.path,
      fileKey: req.params?.fileKey,
    });
    return res.status(status).json({
      error: {
        type: 'FIGMA_API_ERROR',
        message: err.message,
        figmaStatusCode: err.statusCode,
        ...(isDev && err.body ? { body: err.body } : {}),
      },
    });
  }

  // ---- Validation errors (set by validate middleware) ----
  if (err.type === 'VALIDATION_ERROR') {
    logger.debug(`Validation error: ${err.message}`);
    return res.status(400).json({
      error: {
        type: 'VALIDATION_ERROR',
        message: err.message,
        fields: err.fields || [],
      },
    });
  }

  // ---- Timeout ----
  if (err.code === 'ECONNRESET' || err.message?.includes('timed out')) {
    logger.warn(`Request timeout: ${req.method} ${req.path}`);
    return res.status(504).json({
      error: {
        type: 'TIMEOUT',
        message: 'The upstream request timed out. Try again or increase FIGMA_TIMEOUT_MS.',
      },
    });
  }

  // ---- Unknown / programming errors ----
  const statusCode = err.statusCode || err.status || 500;
  logger.error(`Unhandled error [${statusCode}]: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  return res.status(statusCode).json({
    error: {
      type: 'INTERNAL_ERROR',
      message: isDev ? err.message : 'An internal server error occurred.',
      ...(isDev ? { stack: err.stack } : {}),
    },
  });
}

/** Map Figma-specific HTTP statuses to appropriate HTTP responses */
function _mapFigmaStatus(figmaStatus) {
  switch (figmaStatus) {
    case 400: return 400;
    case 401: return 401;
    case 403: return 403;
    case 404: return 404;
    case 408: return 504;
    case 429: return 429;
    default:  return figmaStatus >= 500 ? 502 : 500;
  }
}

/** Simple 404 handler — register before errorHandler */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      type: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`,
    },
  });
}

module.exports = { errorHandler, notFoundHandler };
