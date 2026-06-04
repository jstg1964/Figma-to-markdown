'use strict';

const https = require('https');
const http = require('http');
const { config } = require('../config');
const logger = require('../utils/logger');
const { cache } = require('../utils/cache');

class FigmaApiError extends Error {
  constructor(message, statusCode, body) {
    super(message);
    this.name = 'FigmaApiError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

/**
 * Minimal HTTP client that wraps the Figma REST API.
 * Uses Node's built-in https — no external HTTP library needed.
 */
class FigmaClient {
  constructor({ accessToken, baseUrl, tokenType, timeoutMs } = {}) {
    this.accessToken = accessToken || config.figma.accessToken;
    this.baseUrl = baseUrl || config.figma.baseUrl;
    this.tokenType = tokenType || config.figma.tokenType;
    this.timeoutMs = timeoutMs || config.figma.requestTimeoutMs;
  }

  _buildHeaders() {
    if (this.tokenType === 'oauth') {
      return { Authorization: `Bearer ${this.accessToken}` };
    }
    return { 'X-Figma-Token': this.accessToken };
  }

  /**
   * Perform a GET request against the Figma API.
   * @param {string} path  - e.g. '/files/abc123'
   * @param {object} query - query string params
   */
  _request(path, query = {}) {
    return new Promise((resolve, reject) => {
      const qs = new URLSearchParams(query).toString();
      const url = new URL(`${this.baseUrl}${path}${qs ? '?' + qs : ''}`);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          ...this._buildHeaders(),
          'Content-Type': 'application/json',
          'User-Agent': 'figma-to-markdown/1.0.0',
        },
      };

      const transport = url.protocol === 'https:' ? https : http;
      const req = transport.request(options, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            return reject(new FigmaApiError('Invalid JSON response', res.statusCode, data));
          }
          if (res.statusCode >= 400) {
            const msg = parsed.message || parsed.err || `HTTP ${res.statusCode}`;
            return reject(new FigmaApiError(msg, res.statusCode, parsed));
          }
          resolve(parsed);
        });
      });

      req.setTimeout(this.timeoutMs, () => {
        req.destroy(new FigmaApiError(`Request timed out after ${this.timeoutMs}ms`, 408, null));
      });
      req.on('error', reject);
      req.end();
    });
  }

  /**
   * GET /v1/files/:fileKey
   * Returns the full document tree.
   * @param {string} fileKey
   * @param {{ geometry?, version?, branch_data?, plugin_data? }} opts
   */
  async getFile(fileKey, opts = {}) {
    const cacheKey = `file:${fileKey}:${JSON.stringify(opts)}`;
    if (config.cache.enabled) {
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    logger.info(`Fetching Figma file: ${fileKey}`);
    const data = await this._request(`/files/${fileKey}`, opts);
    if (config.cache.enabled) cache.set(cacheKey, data);
    return data;
  }

  /**
   * GET /v1/files/:fileKey/nodes
   * @param {string} fileKey
   * @param {string[]} nodeIds
   */
  async getFileNodes(fileKey, nodeIds) {
    const ids = nodeIds.join(',');
    const cacheKey = `nodes:${fileKey}:${ids}`;
    if (config.cache.enabled) {
      const cached = cache.get(cacheKey);
      if (cached) return cached;
    }
    logger.info(`Fetching Figma nodes: ${ids} from file ${fileKey}`);
    const data = await this._request(`/files/${fileKey}/nodes`, { ids });
    if (config.cache.enabled) cache.set(cacheKey, data);
    return data;
  }

  /**
   * GET /v1/files/:fileKey/images
   * Renders nodes as images. Returns a map of { nodeId: url }.
   * @param {string} fileKey
   * @param {string[]} nodeIds
   * @param {{ format?, scale?, svg_include_id?, svg_simplify_stroke?, use_absolute_bounds? }} opts
   */
  async getImages(fileKey, nodeIds, opts = {}) {
    const ids = nodeIds.join(',');
    logger.info(`Fetching Figma images for nodes: ${ids}`);
    return this._request(`/files/${fileKey}/images`, { ids, ...opts });
  }

  /**
   * GET /v1/files/:fileKey/image_fills
   * Returns URLs for all images used as fills in the file.
   */
  async getImageFills(fileKey) {
    const cacheKey = `image_fills:${fileKey}`;
    if (config.cache.enabled) {
      const cached = cache.get(cacheKey);
      if (cached) return cached;
    }
    logger.info(`Fetching image fills for file: ${fileKey}`);
    const data = await this._request(`/files/${fileKey}/image_fills`);
    if (config.cache.enabled) cache.set(cacheKey, data);
    return data;
  }

  /**
   * GET /v1/files/:fileKey/comments
   */
  async getComments(fileKey) {
    logger.info(`Fetching comments for file: ${fileKey}`);
    return this._request(`/files/${fileKey}/comments`);
  }

  /**
   * GET /v1/files/:fileKey/components
   */
  async getComponents(fileKey) {
    const cacheKey = `components:${fileKey}`;
    if (config.cache.enabled) {
      const cached = cache.get(cacheKey);
      if (cached) return cached;
    }
    logger.info(`Fetching components for file: ${fileKey}`);
    const data = await this._request(`/files/${fileKey}/components`);
    if (config.cache.enabled) cache.set(cacheKey, data);
    return data;
  }

  /**
   * GET /v1/files/:fileKey/styles
   */
  async getStyles(fileKey) {
    const cacheKey = `styles:${fileKey}`;
    if (config.cache.enabled) {
      const cached = cache.get(cacheKey);
      if (cached) return cached;
    }
    logger.info(`Fetching styles for file: ${fileKey}`);
    const data = await this._request(`/files/${fileKey}/styles`);
    if (config.cache.enabled) cache.set(cacheKey, data);
    return data;
  }

  /**
   * GET /v1/files/:fileKey/versions
   */
  async getVersions(fileKey) {
    logger.info(`Fetching versions for file: ${fileKey}`);
    return this._request(`/files/${fileKey}/versions`);
  }

  /**
   * GET /v1/libraries
   * Returns list of libraries accessible to the user
   */
  async getLibraries() {
    const cacheKey = 'libraries';
    if (config.cache.enabled) {
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    logger.info('Fetching libraries');
    const data = await this._request('/libraries');
    if (config.cache.enabled) cache.set(cacheKey, data);
    return data;
  }

  /**
   * GET /v1/libraries/:libraryId
   * Returns metadata for a specific library
   */
  async getLibrary(libraryId) {
    const cacheKey = `library:${libraryId}`;
    if (config.cache.enabled) {
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit: ${cacheKey}`);
        return cached;
      }
    }
    logger.info(`Fetching library: ${libraryId}`);
    const data = await this._request(`/libraries/${libraryId}`);
    if (config.cache.enabled) cache.set(cacheKey, data);
    return data;
  }
}

module.exports = { FigmaClient, FigmaApiError };
