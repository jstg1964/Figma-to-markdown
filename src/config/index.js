'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Minimal .env loader — zero external dependencies.
 * Reads .env from the project root and populates process.env.
 * Production swap: npm install dotenv, then replace with require('dotenv').config()
 */
function loadDotenv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadDotenv();

const requiredEnvVars = ['FIGMA_ACCESS_TOKEN'];

function validateConfig() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Copy .env.example to .env and fill in the values.'
    );
  }
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  figma: {
    accessToken: process.env.FIGMA_ACCESS_TOKEN || '',
    baseUrl: 'https://api.figma.com/v1',
    tokenType: process.env.FIGMA_TOKEN_TYPE || 'personal', // 'personal' | 'oauth'
    requestTimeoutMs: parseInt(process.env.FIGMA_TIMEOUT_MS || '30000', 10),
  },

  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
    maxItems: parseInt(process.env.CACHE_MAX_ITEMS || '100', 10),
  },

  log: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: process.env.LOG_FORMAT || 'pretty', // 'pretty' | 'json'
  },

  markdown: {
    includeNodeIds: process.env.MD_INCLUDE_NODE_IDS !== 'false',
    includeThumbnailUrls: process.env.MD_INCLUDE_THUMBNAILS !== 'false',
    maxDepth: parseInt(process.env.MD_MAX_DEPTH || '10', 10),
    codeBlockLang: process.env.MD_CODE_LANG || 'json',
  },
};

module.exports = { config, validateConfig };
