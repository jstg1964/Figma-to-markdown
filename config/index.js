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
    let val = line.slice(eqIdx + 1).trim();
    // Remove inline comments
    const commentIdx = val.indexOf('#');
    if (commentIdx !== -1) {
      val = val.slice(0, commentIdx).trim();
    }
    // Remove quotes
    val = val.replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadDotenv();

/**
 * Load component mapping file if enabled
 */
function loadComponentMapping() {
  const enabled = process.env.COMPONENT_MAPPING_ENABLED === 'true';
  console.log(`[Config] COMPONENT_MAPPING_ENABLED = "${process.env.COMPONENT_MAPPING_ENABLED}", enabled = ${enabled}`);
  if (!enabled) return { enabled: false, mapping: {} };

  const filePath = process.env.COMPONENT_MAPPING_FILE || 'ConversionMapForSynapse.json';
  const fullPath = path.resolve(process.cwd(), filePath);
  console.log(`[Config] Loading component mapping from: ${fullPath}`);

  try {
    if (!fs.existsSync(fullPath)) {
      console.warn(`Component mapping file not found: ${fullPath}`);
      return { enabled: true, mapping: {} };
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const mapping = JSON.parse(content);

    // Remove comment keys (starting with _)
    const cleanMapping = {};
    for (const [key, value] of Object.entries(mapping)) {
      if (!key.startsWith('_')) {
        cleanMapping[key] = value;
      }
    }

    return { enabled: true, mapping: cleanMapping };
  } catch (err) {
    console.warn(`Failed to load component mapping file: ${err.message}`);
    return { enabled: true, mapping: {} };
  }
}

const componentMapping = loadComponentMapping();
if (componentMapping.enabled) {
  console.log(`[Config] Component mapping enabled with ${Object.keys(componentMapping.mapping).length} mappings`);
}

/**
 * Load library mapping file if it exists
 */
function loadLibraryMapping() {
  const filePath = process.env.LIBRARY_MAPPING_FILE || 'LibraryMapping.json';
  const fullPath = path.resolve(process.cwd(), filePath);
  console.log(`[Config] Checking library mapping from: ${fullPath}`);

  try {
    if (!fs.existsSync(fullPath)) {
      console.log(`[Config] Library mapping file not found, will use automatic fetching only`);
      return {};
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const data = JSON.parse(content);

    // Extract libraries object if it exists
    const libraries = data.libraries || data || {};

    console.log(`[Config] Library mapping loaded with ${Object.keys(libraries).length} manual entries`);
    return libraries;
  } catch (err) {
    console.warn(`[Config] Failed to load library mapping file: ${err.message}`);
    return {};
  }
}

const libraryMapping = loadLibraryMapping();

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

  componentMapping,
  libraryMapping,
};

module.exports = { config, validateConfig };
