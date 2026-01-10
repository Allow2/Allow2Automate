/**
 * Cache Manager Utility
 * NodeCache wrapper with TTL support for Xbox API responses
 * Reduces API calls and improves performance
 *
 * @module utils/cacheManager
 */

import NodeCache from 'node-cache';

/**
 * Cache manager for Xbox API responses with TTL support
 * Reduces redundant API calls while ensuring data freshness
 *
 * @class CacheManager
 * @example
 * const cache = new CacheManager({ ttl: 300 }); // 5 minute TTL
 * cache.set('profile:gamertag', profileData);
 * const profile = cache.get('profile:gamertag');
 */
export class CacheManager {
  /**
   * Creates a new cache manager instance
   *
   * @constructor
   * @param {Object} config - Cache configuration
   * @param {number} [config.ttl=300] - Default TTL in seconds (default: 300 = 5 minutes)
   * @param {number} [config.checkperiod=60] - Automatic delete check interval in seconds
   * @param {boolean} [config.useClones=true] - Clone cached objects to prevent mutation
   * @param {number} [config.maxKeys=-1] - Maximum number of keys (-1 = unlimited)
   */
  constructor(config = {}) {
    this.ttl = config.ttl || 300; // 5 minutes default

    this.cache = new NodeCache({
      stdTTL: this.ttl,
      checkperiod: config.checkperiod || 60,
      useClones: config.useClones !== false, // Default true
      maxKeys: config.maxKeys || -1
    });

    // Event handlers
    this.cache.on('expired', (key, value) => {
      this._onExpired(key, value);
    });

    this.cache.on('del', (key, value) => {
      this._onDeleted(key, value);
    });

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  /**
   * Stores a value in the cache with optional custom TTL
   *
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - Custom TTL in seconds (overrides default)
   * @returns {boolean} True if successfully cached
   *
   * @example
   * cache.set('presence:xuid123', presenceData, 60); // Cache for 60 seconds
   */
  set(key, value, ttl) {
    try {
      const success = this.cache.set(key, value, ttl || this.ttl);
      if (success) {
        this.stats.sets++;
      }
      return success;
    } catch (error) {
      console.error(`[Cache] Failed to set key '${key}':`, error);
      return false;
    }
  }

  /**
   * Retrieves a value from the cache
   *
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined if not found
   *
   * @example
   * const presence = cache.get('presence:xuid123');
   * if (presence) {
   *   console.log('Cache hit!');
   * }
   */
  get(key) {
    try {
      const value = this.cache.get(key);

      if (value !== undefined) {
        this.stats.hits++;
      } else {
        this.stats.misses++;
      }

      return value;
    } catch (error) {
      console.error(`[Cache] Failed to get key '${key}':`, error);
      this.stats.misses++;
      return undefined;
    }
  }

  /**
   * Gets a value from cache or executes function to generate and cache it
   *
   * @async
   * @param {string} key - Cache key
   * @param {Function} fn - Async function to generate value if not cached
   * @param {number} [ttl] - Custom TTL in seconds
   * @returns {Promise<*>} Cached or newly generated value
   *
   * @example
   * const profile = await cache.getOrSet('profile:gamertag', async () => {
   *   return await xboxAPI.getProfile('gamertag');
   * }, 300);
   */
  async getOrSet(key, fn, ttl) {
    let value = this.get(key);

    if (value !== undefined) {
      return value;
    }

    try {
      value = await fn();
      this.set(key, value, ttl);
      return value;
    } catch (error) {
      console.error(`[Cache] Failed to generate value for key '${key}':`, error);
      throw error;
    }
  }

  /**
   * Checks if a key exists in the cache
   *
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   *
   * @example
   * if (!cache.has('presence:xuid123')) {
   *   // Fetch from API
   * }
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Deletes a specific key from the cache
   *
   * @param {string} key - Cache key to delete
   * @returns {number} Number of deleted keys (0 or 1)
   *
   * @example
   * cache.delete('presence:xuid123'); // Force refresh on next get
   */
  delete(key) {
    try {
      const count = this.cache.del(key);
      if (count > 0) {
        this.stats.deletes++;
      }
      return count;
    } catch (error) {
      console.error(`[Cache] Failed to delete key '${key}':`, error);
      return 0;
    }
  }

  /**
   * Deletes all keys matching a pattern (prefix)
   *
   * @param {string} prefix - Key prefix to match
   * @returns {number} Number of deleted keys
   *
   * @example
   * cache.deletePattern('presence:'); // Clear all presence cache
   */
  deletePattern(prefix) {
    try {
      const keys = this.cache.keys().filter(key => key.startsWith(prefix));
      const count = this.cache.del(keys);
      this.stats.deletes += count;
      return count;
    } catch (error) {
      console.error(`[Cache] Failed to delete pattern '${prefix}':`, error);
      return 0;
    }
  }

  /**
   * Clears the entire cache
   *
   * @example
   * cache.flush(); // Clear all cached data
   */
  flush() {
    try {
      this.cache.flushAll();
      console.log('[Cache] Flushed all keys');
    } catch (error) {
      console.error('[Cache] Failed to flush cache:', error);
    }
  }

  /**
   * Gets cache statistics and key count
   *
   * @returns {Object} Cache statistics
   *
   * @example
   * const stats = cache.getStats();
   * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
   */
  getStats() {
    const keys = this.cache.keys();
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      keys: keys.length,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: hitRate,
      sets: this.stats.sets,
      deletes: this.stats.deletes
    };
  }

  /**
   * Gets TTL for a specific key
   *
   * @param {string} key - Cache key
   * @returns {number} Remaining TTL in seconds, or undefined if key doesn't exist
   *
   * @example
   * const ttl = cache.getTTL('presence:xuid123');
   * console.log(`Expires in ${ttl} seconds`);
   */
  getTTL(key) {
    try {
      const ttl = this.cache.getTtl(key);
      if (ttl === undefined) {
        return undefined;
      }

      // Convert from timestamp to seconds remaining
      return Math.max(0, Math.floor((ttl - Date.now()) / 1000));
    } catch (error) {
      console.error(`[Cache] Failed to get TTL for key '${key}':`, error);
      return undefined;
    }
  }

  /**
   * Updates TTL for an existing key
   *
   * @param {string} key - Cache key
   * @param {number} ttl - New TTL in seconds
   * @returns {boolean} True if TTL was updated
   *
   * @example
   * cache.setTTL('presence:xuid123', 600); // Extend to 10 minutes
   */
  setTTL(key, ttl) {
    try {
      return this.cache.ttl(key, ttl);
    } catch (error) {
      console.error(`[Cache] Failed to set TTL for key '${key}':`, error);
      return false;
    }
  }

  /**
   * Gets all keys in the cache
   *
   * @returns {string[]} Array of cache keys
   *
   * @example
   * const keys = cache.keys();
   * console.log(`Cached keys: ${keys.join(', ')}`);
   */
  keys() {
    return this.cache.keys();
  }

  /**
   * Event handler for expired keys
   *
   * @private
   * @param {string} key - Expired key
   * @param {*} value - Expired value
   */
  _onExpired(key, value) {
    console.log(`[Cache] Key expired: ${key}`);
  }

  /**
   * Event handler for deleted keys
   *
   * @private
   * @param {string} key - Deleted key
   * @param {*} value - Deleted value
   */
  _onDeleted(key, value) {
    console.log(`[Cache] Key deleted: ${key}`);
  }

  /**
   * Closes the cache and stops automatic cleanup
   *
   * @example
   * cache.close(); // Clean shutdown
   */
  close() {
    this.cache.close();
    console.log('[Cache] Cache manager closed');
  }
}

export default CacheManager;
