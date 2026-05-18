'use strict';

const { config } = require('../config');
const logger = require('./logger');

/**
 * Lightweight in-memory LRU-style cache with TTL support.
 * Suitable for development/single-instance deployments.
 * Swap out for Redis in multi-instance production setups.
 */
class Cache {
  constructor({ ttlSeconds = 300, maxItems = 100 } = {}) {
    this.ttlSeconds = ttlSeconds;
    this.maxItems = maxItems;
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this.store = new Map();
  }

  _isExpired(entry) {
    return Date.now() > entry.expiresAt;
  }

  _evictExpired() {
    for (const [key, entry] of this.store.entries()) {
      if (this._isExpired(entry)) {
        this.store.delete(key);
      }
    }
  }

  _evictOldest() {
    // Map preserves insertion order — first entry is oldest
    const firstKey = this.store.keys().next().value;
    if (firstKey !== undefined) {
      this.store.delete(firstKey);
      logger.debug(`Cache evicted oldest key: ${firstKey}`);
    }
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this._isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlOverride) {
    this._evictExpired();
    if (this.store.size >= this.maxItems) {
      this._evictOldest();
    }
    const ttl = (ttlOverride ?? this.ttlSeconds) * 1000;
    this.store.set(key, { value, expiresAt: Date.now() + ttl });
    logger.debug(`Cache set key: ${key} (TTL: ${ttl / 1000}s)`);
  }

  delete(key) {
    return this.store.delete(key);
  }

  clear() {
    this.store.clear();
    logger.debug('Cache cleared');
  }

  get size() {
    return this.store.size;
  }

  stats() {
    return {
      size: this.store.size,
      maxItems: this.maxItems,
      ttlSeconds: this.ttlSeconds,
      keys: Array.from(this.store.keys()),
    };
  }
}

// Singleton cache instance
const cache = new Cache({
  ttlSeconds: config.cache.ttlSeconds,
  maxItems: config.cache.maxItems,
});

module.exports = { Cache, cache };
