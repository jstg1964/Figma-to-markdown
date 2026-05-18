'use strict';

/**
 * Lightweight structured logger — zero external dependencies.
 * Implements the same interface as winston (info, warn, error, debug)
 * so it can be swapped for winston in production without changing call-sites.
 *
 * Production swap: npm install winston, then replace this file with:
 *   const { createLogger, format, transports } = require('winston');
 *   module.exports = createLogger({ ... });
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

// Lazy-load config to avoid circular dependencies at startup
function getLevel() {
  try {
    const { config } = require('../config');
    return config.log.level || 'debug';
  } catch {
    return process.env.LOG_LEVEL || 'debug';
  }
}

function getFormat() {
  try {
    const { config } = require('../config');
    return config.log.format || 'pretty';
  } catch {
    return process.env.LOG_FORMAT || 'pretty';
  }
}

// ANSI colour codes for pretty output
const COLOURS = {
  error: '\x1b[31m', // red
  warn:  '\x1b[33m', // yellow
  info:  '\x1b[36m', // cyan
  debug: '\x1b[90m', // grey
  reset: '\x1b[0m',
};

function pad(n) { return String(n).padStart(2, '0'); }

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function log(level, message, meta) {
  const currentLevel = getLevel();
  if (LEVELS[level] === undefined || LEVELS[level] > (LEVELS[currentLevel] ?? 3)) return;

  const format = getFormat();
  const ts = timestamp();

  if (format === 'json') {
    const entry = { timestamp: ts, level, message };
    if (meta && Object.keys(meta).length) Object.assign(entry, meta);
    if (meta?.stack) entry.stack = meta.stack;
    process.stdout.write(JSON.stringify(entry) + '\n');
    return;
  }

  // Pretty format
  const colour = COLOURS[level] || '';
  const reset  = COLOURS.reset;
  let line = `[${ts}] ${colour}${level.toUpperCase().padEnd(5)}${reset}: ${message}`;
  if (meta?.stack) line += `\n${meta.stack}`;
  else if (meta && Object.keys(meta).length) {
    const filtered = Object.fromEntries(Object.entries(meta).filter(([k]) => k !== 'stack'));
    if (Object.keys(filtered).length) line += `  ${JSON.stringify(filtered)}`;
  }
  (level === 'error' ? process.stderr : process.stdout).write(line + '\n');
}

const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  info:  (msg, meta) => log('info',  msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};

module.exports = logger;
