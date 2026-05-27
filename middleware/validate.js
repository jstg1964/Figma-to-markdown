'use strict';

/**
 * Validation middleware factories for route-level input checking.
 */

/** Validate that :fileKey param is a non-empty alphanumeric string */
function validateFileKey(req, res, next) {
  const { fileKey } = req.params;
  if (!fileKey || !/^[a-zA-Z0-9_-]+$/.test(fileKey)) {
    return next(createValidationError('Invalid fileKey. Must be alphanumeric (hyphens/underscores allowed).', ['fileKey']));
  }
  next();
}

/** Validate query params for the /json and /markdown endpoints */
function validateFigmaQueryParams(req, res, next) {
  const errors = [];

  // Optional: version must be a positive integer string if present
  if (req.query.version !== undefined) {
    const v = parseInt(req.query.version, 10);
    if (isNaN(v) || v < 1) errors.push('version must be a positive integer');
  }

  // Optional: nodeIds must be a comma-separated list of non-empty strings
  if (req.query.nodeIds !== undefined) {
    const ids = req.query.nodeIds.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) errors.push('nodeIds must be a non-empty comma-separated list');
    req.parsedNodeIds = ids;
  }

  // Optional: boolean flags
  const boolFlags = ['includeLayout', 'includeInteractions', 'includeText', 'includeComponents', 'includeFlows', 'perPage'];
  for (const flag of boolFlags) {
    if (req.query[flag] !== undefined && !['true', 'false', '1', '0'].includes(req.query[flag])) {
      errors.push(`${flag} must be a boolean (true/false)`);
    }
  }

  if (errors.length > 0) {
    return next(createValidationError(errors.join('; '), errors));
  }

  // Coerce booleans
  for (const flag of boolFlags) {
    if (req.query[flag] !== undefined) {
      req.query[flag] = req.query[flag] === 'true' || req.query[flag] === '1';
    }
  }

  next();
}

function createValidationError(message, fields = []) {
  const err = new Error(message);
  err.type = 'VALIDATION_ERROR';
  err.fields = fields;
  return err;
}

module.exports = { validateFileKey, validateFigmaQueryParams, createValidationError };
