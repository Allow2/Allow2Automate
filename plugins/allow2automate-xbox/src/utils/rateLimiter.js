/**
 * Rate Limiter Utility
 * Token bucket implementation for Xbox Live API rate limiting
 * Enforces burst (10 req/15s) and sustained (30 req/5min) limits
 *
 * @module utils/rateLimiter
 */

/**
 * Token bucket rate limiter with dual burst/sustained limits
 * Complies with Xbox Live API rate limits (10 req/15s, 30 req/5min)
 *
 * @class RateLimiter
 * @example
 * const limiter = new RateLimiter({
 *   burst: { requests: 10, window: 15000 },
 *   sustained: { requests: 30, window: 300000 }
 * });
 *
 * await limiter.wait(); // Blocks until request is allowed
 * makeAPICall();
 */
export class RateLimiter {
  /**
   * Creates a new rate limiter with burst and sustained limits
   *
   * @constructor
   * @param {Object} config - Rate limiter configuration
   * @param {Object} config.burst - Burst limit configuration
   * @param {number} config.burst.requests - Max requests in burst window (default: 10)
   * @param {number} config.burst.window - Burst window in milliseconds (default: 15000)
   * @param {Object} config.sustained - Sustained limit configuration
   * @param {number} config.sustained.requests - Max requests in sustained window (default: 30)
   * @param {number} config.sustained.window - Sustained window in milliseconds (default: 300000)
   */
  constructor(config = {}) {
    this.burst = {
      requests: config.burst?.requests || 10,
      window: config.burst?.window || 15000, // 15 seconds
      tokens: config.burst?.requests || 10,
      lastRefill: Date.now()
    };

    this.sustained = {
      requests: config.sustained?.requests || 30,
      window: config.sustained?.window || 300000, // 5 minutes
      tokens: config.sustained?.requests || 30,
      lastRefill: Date.now()
    };

    this.queue = [];
    this.processing = false;
  }

  /**
   * Refills token buckets based on elapsed time
   *
   * @private
   * @param {Object} bucket - Bucket to refill (burst or sustained)
   */
  _refillBucket(bucket) {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;

    if (elapsed >= bucket.window) {
      // Full refill if window elapsed
      bucket.tokens = bucket.requests;
      bucket.lastRefill = now;
    } else {
      // Partial refill based on elapsed time
      const refillRate = bucket.requests / bucket.window;
      const tokensToAdd = Math.floor(elapsed * refillRate);

      if (tokensToAdd > 0) {
        bucket.tokens = Math.min(bucket.requests, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
      }
    }
  }

  /**
   * Checks if a request can be made without waiting
   *
   * @returns {boolean} True if both buckets have available tokens
   *
   * @example
   * if (limiter.canProceed()) {
   *   makeAPICall();
   * }
   */
  canProceed() {
    this._refillBucket(this.burst);
    this._refillBucket(this.sustained);

    return this.burst.tokens > 0 && this.sustained.tokens > 0;
  }

  /**
   * Consumes a token from both buckets
   *
   * @private
   * @throws {Error} If no tokens available
   */
  _consumeToken() {
    if (!this.canProceed()) {
      throw new Error('Rate limit exceeded');
    }

    this.burst.tokens -= 1;
    this.sustained.tokens -= 1;
  }

  /**
   * Calculates time until next token is available
   *
   * @private
   * @returns {number} Milliseconds until next token
   */
  _timeUntilNextToken() {
    const burstWait = this.burst.tokens === 0
      ? this.burst.window - (Date.now() - this.burst.lastRefill)
      : 0;

    const sustainedWait = this.sustained.tokens === 0
      ? this.sustained.window - (Date.now() - this.sustained.lastRefill)
      : 0;

    return Math.max(0, burstWait, sustainedWait);
  }

  /**
   * Waits until a request can proceed without violating rate limits
   * Returns immediately if tokens available, otherwise queues the request
   *
   * @async
   * @returns {Promise<void>} Resolves when request can proceed
   * @throws {Error} If rate limiter is in invalid state
   *
   * @example
   * await limiter.wait();
   * const response = await xboxAPI.batchPresence(xuids);
   */
  async wait() {
    if (this.canProceed()) {
      this._consumeToken();
      return;
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Rate limiter timeout after 60 seconds'));
      }, 60000); // 60 second timeout

      this.queue.push({
        resolve: () => {
          clearTimeout(timeoutId);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      this._processQueue();
    });
  }

  /**
   * Processes queued requests when tokens become available
   *
   * @private
   * @async
   */
  async _processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      if (this.canProceed()) {
        const request = this.queue.shift();
        this._consumeToken();
        request.resolve();
      } else {
        // Wait until next token is available
        const waitTime = this._timeUntilNextToken();
        await new Promise(resolve => setTimeout(resolve, waitTime + 10)); // +10ms buffer
      }
    }

    this.processing = false;
  }

  /**
   * Gets current rate limiter status
   *
   * @returns {Object} Current status including available tokens and queue length
   *
   * @example
   * const status = limiter.getStatus();
   * console.log(`Burst tokens: ${status.burst.available}/${status.burst.max}`);
   */
  getStatus() {
    this._refillBucket(this.burst);
    this._refillBucket(this.sustained);

    return {
      burst: {
        available: this.burst.tokens,
        max: this.burst.requests,
        window: this.burst.window,
        nextRefill: this.burst.lastRefill + this.burst.window
      },
      sustained: {
        available: this.sustained.tokens,
        max: this.sustained.requests,
        window: this.sustained.window,
        nextRefill: this.sustained.lastRefill + this.sustained.window
      },
      queue: {
        length: this.queue.length,
        processing: this.processing
      }
    };
  }

  /**
   * Resets rate limiter to initial state
   * Clears queue and refills all tokens
   *
   * @example
   * limiter.reset(); // Use after authentication refresh
   */
  reset() {
    this.burst.tokens = this.burst.requests;
    this.burst.lastRefill = Date.now();

    this.sustained.tokens = this.sustained.requests;
    this.sustained.lastRefill = Date.now();

    this.queue = [];
    this.processing = false;
  }
}

export default RateLimiter;
