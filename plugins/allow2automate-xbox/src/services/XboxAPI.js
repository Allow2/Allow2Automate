/**
 * XboxAPI - Xbox Live API wrapper with rate limiting and error handling
 *
 * Features:
 * - Batch presence queries (up to 1,100 XUIDs)
 * - Profile lookup by XUID or gamertag
 * - Title metadata retrieval
 * - Rate limiting: 10 req/15s, 30 req/5min
 * - Automatic token refresh on 401 errors
 * - Exponential backoff retry logic
 */

import fetch from 'node-fetch';
import { EventEmitter } from 'events';

export default class XboxAPI extends EventEmitter {
  constructor(authManager, rateLimiter) {
    super();
    this.authManager = authManager;
    this.rateLimiter = rateLimiter;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000
    };
  }

  /**
   * Make authenticated API request to Xbox Live
   * @param {string} url - API endpoint URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  async request(url, options = {}) {
    // Ensure we have a valid token
    await this.authManager.ensureValidToken();

    // Get XSTS token for authentication
    const xstsToken = this.authManager.getXSTSToken();
    if (!xstsToken) {
      throw new Error('No XSTS token available');
    }

    // Wait for rate limiter
    await this.rateLimiter.wait();

    // Make request with auth headers
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `XBL3.0 x=${xstsToken.uhs};${xstsToken.token}`,
        'x-xbl-contract-version': '3',
        'Content-Type': 'application/json',
        'User-Agent': 'Allow2Automate-Xbox/1.0',
        ...options.headers
      }
    });

    // Handle 401 - token expired, refresh and retry
    if (response.status === 401) {
      console.log('[XboxAPI] Token expired, refreshing...');
      await this.authManager.refreshToken();

      // Retry request with new token
      const newXstsToken = this.authManager.getXSTSToken();
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `XBL3.0 x=${newXstsToken.uhs};${newXstsToken.token}`,
          'x-xbl-contract-version': '3',
          'Content-Type': 'application/json',
          'User-Agent': 'Allow2Automate-Xbox/1.0',
          ...options.headers
        }
      });

      if (!retryResponse.ok) {
        const error = await retryResponse.text();
        throw new Error(`Xbox API request failed after token refresh: ${error}`);
      }

      return retryResponse.json();
    }

    // Handle rate limiting (429)
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') || 60;
      console.log(`[XboxAPI] Rate limited, retry after ${retryAfter}s`);
      this.emit('rateLimited', { retryAfter });
      throw new Error(`Rate limited, retry after ${retryAfter} seconds`);
    }

    // Handle other errors
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Xbox API request failed (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Make request with exponential backoff retry
   * @param {Function} requestFn - Request function to execute
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<Object>} Response data
   */
  async requestWithRetry(requestFn, retryCount = 0) {
    try {
      return await requestFn();
    } catch (error) {
      // Don't retry on authentication errors
      if (error.message.includes('authenticated') || error.message.includes('token')) {
        throw error;
      }

      // Check if we should retry
      if (retryCount >= this.retryConfig.maxRetries) {
        console.error('[XboxAPI] Max retries reached:', error);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.retryConfig.baseDelay * Math.pow(2, retryCount),
        this.retryConfig.maxDelay
      );

      console.log(`[XboxAPI] Retry ${retryCount + 1}/${this.retryConfig.maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));

      return this.requestWithRetry(requestFn, retryCount + 1);
    }
  }

  /**
   * Batch presence query for multiple XUIDs
   * @param {Array<string>} xuids - Array of XUIDs to query
   * @returns {Promise<Array>} Presence data for each XUID
   */
  async batchPresence(xuids) {
    if (!Array.isArray(xuids) || xuids.length === 0) {
      return [];
    }

    // Xbox API supports up to 1,100 XUIDs per batch
    if (xuids.length > 1100) {
      console.warn('[XboxAPI] XUID batch exceeds 1,100 limit, splitting...');
      const batches = [];
      for (let i = 0; i < xuids.length; i += 1100) {
        batches.push(xuids.slice(i, i + 1100));
      }

      const results = await Promise.all(
        batches.map(batch => this.batchPresence(batch))
      );

      return results.flat();
    }

    return this.requestWithRetry(async () => {
      const response = await this.request('https://userpresence.xboxlive.com/users/batch', {
        method: 'POST',
        body: JSON.stringify({
          users: xuids,
          level: 'all'
        })
      });

      return response;
    });
  }

  /**
   * Get profile information by XUID
   * @param {string} xuid - Xbox User ID
   * @returns {Promise<Object>} Profile data including gamertag
   */
  async getProfile(xuid) {
    if (!xuid) {
      throw new Error('XUID is required');
    }

    return this.requestWithRetry(async () => {
      const response = await this.request(
        `https://profile.xboxlive.com/users/xuid(${xuid})/profile/settings`,
        {
          method: 'GET'
        }
      );

      return this.parseProfile(response);
    });
  }

  /**
   * Get profile information by gamertag
   * @param {string} gamertag - Xbox gamertag
   * @returns {Promise<Object>} Profile data including XUID
   */
  async getProfileByGamertag(gamertag) {
    if (!gamertag) {
      throw new Error('Gamertag is required');
    }

    return this.requestWithRetry(async () => {
      const response = await this.request(
        `https://profile.xboxlive.com/users/gt(${encodeURIComponent(gamertag)})/profile/settings`,
        {
          method: 'GET'
        }
      );

      return this.parseProfile(response);
    });
  }

  /**
   * Parse profile response into useful format
   * @param {Object} response - Raw API response
   * @returns {Object} Parsed profile data
   */
  parseProfile(response) {
    const user = response.profileUsers[0];
    if (!user) {
      throw new Error('Profile not found');
    }

    const settings = {};
    user.settings.forEach(setting => {
      settings[setting.id] = setting.value;
    });

    return {
      xuid: user.id,
      gamertag: settings.Gamertag || settings.ModernGamertag,
      gamerscore: settings.Gamerscore,
      accountTier: settings.AccountTier,
      xboxOneRep: settings.XboxOneRep,
      preferredColor: settings.PreferredColor
    };
  }

  /**
   * Get title (game) details by Title ID
   * @param {string} titleId - Xbox Title ID
   * @returns {Promise<Object>} Game metadata
   */
  async getTitleDetails(titleId) {
    if (!titleId) {
      throw new Error('Title ID is required');
    }

    return this.requestWithRetry(async () => {
      const response = await this.request(
        `https://titlehub.xboxlive.com/titles/${titleId}`,
        {
          method: 'GET'
        }
      );

      return this.parseTitleDetails(response);
    });
  }

  /**
   * Parse title details response
   * @param {Object} response - Raw API response
   * @returns {Object} Parsed title data
   */
  parseTitleDetails(response) {
    if (!response || !response.titles || response.titles.length === 0) {
      return null;
    }

    const title = response.titles[0];
    return {
      titleId: title.titleId,
      name: title.name,
      type: title.type,
      devices: title.devices,
      displayImage: title.displayImage,
      modernTitleId: title.modernTitleId,
      isBundle: title.isBundle
    };
  }

  /**
   * Get multiple title details in batch
   * @param {Array<string>} titleIds - Array of Title IDs
   * @returns {Promise<Array>} Array of title metadata
   */
  async batchTitleDetails(titleIds) {
    if (!Array.isArray(titleIds) || titleIds.length === 0) {
      return [];
    }

    return this.requestWithRetry(async () => {
      const response = await this.request(
        `https://titlehub.xboxlive.com/titles/batch`,
        {
          method: 'POST',
          body: JSON.stringify({
            titles: titleIds
          })
        }
      );

      return response.titles.map(title => this.parseTitleDetails({ titles: [title] }));
    });
  }

  /**
   * Get friends list for authenticated user
   * @returns {Promise<Array>} Array of friend XUIDs
   */
  async getFriendsList() {
    const xstsToken = this.authManager.getXSTSToken();
    if (!xstsToken) {
      throw new Error('Not authenticated');
    }

    return this.requestWithRetry(async () => {
      const response = await this.request(
        `https://social.xboxlive.com/users/xuid(${xstsToken.xuid})/people`,
        {
          method: 'GET'
        }
      );

      return response.people.map(person => ({
        xuid: person.xuid,
        gamertag: person.gamertag,
        displayName: person.displayName,
        realName: person.realName,
        isFavorite: person.isFavorite,
        isFollowingCaller: person.isFollowingCaller
      }));
    });
  }

  /**
   * Get rich presence string for XUID
   * @param {string} xuid - Xbox User ID
   * @returns {Promise<string>} Rich presence text
   */
  async getRichPresence(xuid) {
    if (!xuid) {
      throw new Error('XUID is required');
    }

    return this.requestWithRetry(async () => {
      const response = await this.request(
        `https://userpresence.xboxlive.com/users/xuid(${xuid})`,
        {
          method: 'GET'
        }
      );

      if (response.state === 'Online' && response.lastSeen) {
        return response.lastSeen.richPresence || response.lastSeen.titleName || 'Online';
      }

      return response.state;
    });
  }

  /**
   * Health check - verify API connectivity
   * @returns {Promise<boolean>} True if API is accessible
   */
  async healthCheck() {
    try {
      const xstsToken = this.authManager.getXSTSToken();
      if (!xstsToken) {
        return false;
      }

      // Try to get own profile
      await this.getProfile(xstsToken.xuid);
      return true;
    } catch (error) {
      console.error('[XboxAPI] Health check failed:', error);
      return false;
    }
  }
}
