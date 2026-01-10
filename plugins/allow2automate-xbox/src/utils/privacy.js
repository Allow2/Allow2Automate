/**
 * Privacy Utilities
 * Microsoft XR-013 compliance for XUID handling
 * Ensures XUIDs are never exposed in UI/logs and gamertags are used for display
 *
 * @module utils/privacy
 */

/**
 * Privacy utilities for Xbox user identification
 * Enforces Microsoft XR-013 guidelines: XUIDs for API calls only, gamertags for display
 *
 * @class PrivacyUtils
 * @example
 * // ✅ CORRECT: Use XUID for API calls
 * const presence = await getPresence(xuid);
 *
 * // ✅ CORRECT: Display gamertag to users
 * PrivacyUtils.renderDisplayName(gamertag);
 *
 * // ❌ NEVER expose XUID in UI/logs
 */
export class PrivacyUtils {
  /**
   * Validates that a string is a valid XUID format
   * XUIDs are 16-digit hexadecimal strings
   *
   * @static
   * @param {string} xuid - XUID to validate
   * @returns {boolean} True if valid XUID format
   *
   * @example
   * if (PrivacyUtils.isValidXUID('2535405290574572')) {
   *   // Use for API calls only
   * }
   */
  static isValidXUID(xuid) {
    if (!xuid || typeof xuid !== 'string') {
      return false;
    }

    // XUID is 16-digit decimal or hexadecimal string
    return /^\d{16}$/.test(xuid) || /^[0-9a-fA-F]{16}$/.test(xuid);
  }

  /**
   * Validates gamertag format according to Xbox rules
   * - 1-15 characters (modern gamertags can be longer with suffixes)
   * - Letters, numbers, spaces allowed
   * - Cannot start or end with space
   *
   * @static
   * @param {string} gamertag - Gamertag to validate
   * @returns {boolean} True if valid gamertag format
   * @throws {Error} If gamertag is invalid
   *
   * @example
   * try {
   *   PrivacyUtils.validateGamertag('PlayerOne');
   * } catch (error) {
   *   console.error('Invalid gamertag:', error.message);
   * }
   */
  static validateGamertag(gamertag) {
    if (!gamertag || typeof gamertag !== 'string') {
      throw new Error('Gamertag is required and must be a string');
    }

    // Trim whitespace
    const trimmed = gamertag.trim();

    // Check length (1-15 for classic, longer for modern with #suffix)
    if (trimmed.length === 0 || trimmed.length > 25) {
      throw new Error('Gamertag must be 1-25 characters');
    }

    // Classic gamertag: 1-15 alphanumeric + spaces, no leading/trailing spaces
    // Modern gamertag: allows #1234 suffix
    const classicRegex = /^[a-zA-Z0-9][\sa-zA-Z0-9]{0,13}[a-zA-Z0-9]$/;
    const modernRegex = /^[a-zA-Z0-9][\sa-zA-Z0-9]{0,13}[a-zA-Z0-9](#\d{4})?$/;

    if (!classicRegex.test(trimmed) && !modernRegex.test(trimmed)) {
      throw new Error('Invalid gamertag format. Must contain only letters, numbers, and spaces.');
    }

    return trimmed;
  }

  /**
   * Masks XUID for safe logging (shows only first/last 4 digits)
   * Use this ONLY for debugging/logging, NEVER in production UI
   *
   * @static
   * @param {string} xuid - XUID to mask
   * @returns {string} Masked XUID (e.g., "2535****5572")
   *
   * @example
   * console.log('[Debug] User:', PrivacyUtils.maskXUID(xuid));
   * // Output: [Debug] User: 2535****5572
   */
  static maskXUID(xuid) {
    if (!xuid || typeof xuid !== 'string') {
      return '****INVALID****';
    }

    if (xuid.length < 8) {
      return '****';
    }

    const first4 = xuid.substring(0, 4);
    const last4 = xuid.substring(xuid.length - 4);
    const masked = '*'.repeat(Math.max(0, xuid.length - 8));

    return `${first4}${masked}${last4}`;
  }

  /**
   * Sanitizes log messages to remove XUIDs
   * Replaces XUID-like patterns with [XUID_REDACTED]
   *
   * @static
   * @param {string} message - Log message to sanitize
   * @returns {string} Sanitized message
   *
   * @example
   * const safeLog = PrivacyUtils.sanitizeLog(`Fetching presence for ${xuid}`);
   * console.log(safeLog); // "Fetching presence for [XUID_REDACTED]"
   */
  static sanitizeLog(message) {
    if (!message || typeof message !== 'string') {
      return '';
    }

    // Replace 16-digit numbers (likely XUIDs) with redacted marker
    return message.replace(/\b\d{16}\b/g, '[XUID_REDACTED]');
  }

  /**
   * Returns display-safe user identifier (gamertag only)
   * NEVER returns XUID
   *
   * @static
   * @param {Object} user - User object
   * @param {string} user.gamertag - User's gamertag
   * @param {string} user.xuid - User's XUID (ignored for display)
   * @returns {string} Display-safe identifier (gamertag)
   *
   * @example
   * const displayName = PrivacyUtils.getDisplayName({
   *   gamertag: 'PlayerOne',
   *   xuid: '2535405290574572'
   * });
   * console.log(displayName); // "PlayerOne"
   */
  static getDisplayName(user) {
    if (!user || !user.gamertag) {
      return 'Unknown User';
    }

    return user.gamertag;
  }

  /**
   * Creates privacy-safe error messages (never includes XUIDs)
   *
   * @static
   * @param {Error} error - Original error
   * @param {Object} context - Error context (may contain XUIDs)
   * @returns {Error} Sanitized error
   *
   * @example
   * try {
   *   await api.call(xuid);
   * } catch (error) {
   *   throw PrivacyUtils.sanitizeError(error, { xuid, gamertag });
   * }
   */
  static sanitizeError(error, context = {}) {
    const safeContext = { ...context };

    // Remove XUID from context
    delete safeContext.xuid;
    delete safeContext.xuids;

    // Sanitize error message
    const safeMessage = this.sanitizeLog(error.message);

    const sanitizedError = new Error(safeMessage);
    sanitizedError.context = safeContext;
    sanitizedError.stack = error.stack;

    return sanitizedError;
  }

  /**
   * Validates that an object doesn't contain XUIDs in exposed properties
   * Used to verify data before sending to UI
   *
   * @static
   * @param {Object} data - Data to validate
   * @param {string[]} allowedKeys - Keys that are safe to expose
   * @returns {Object} Validated safe data
   * @throws {Error} If data contains XUID in non-allowed keys
   *
   * @example
   * const safeData = PrivacyUtils.validateExposedData(
   *   { gamertag: 'Player', xuid: '1234' },
   *   ['gamertag', 'presence']
   * );
   * // Throws error because 'xuid' is not in allowedKeys
   */
  static validateExposedData(data, allowedKeys = []) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveKeys = ['xuid', 'xuids', 'userId', 'userIds'];
    const exposedSensitive = Object.keys(data).filter(key =>
      sensitiveKeys.includes(key) && !allowedKeys.includes(key)
    );

    if (exposedSensitive.length > 0) {
      throw new Error(
        `Privacy violation: Sensitive keys exposed in UI data: ${exposedSensitive.join(', ')}`
      );
    }

    return data;
  }

  /**
   * Creates a privacy-safe child status object for UI display
   * Removes XUIDs and sensitive data
   *
   * @static
   * @param {Object} child - Child data with XUID
   * @param {Object} presence - Xbox presence data
   * @returns {Object} Privacy-safe status object
   *
   * @example
   * const safeStatus = PrivacyUtils.createSafeChildStatus(
   *   { gamertag: 'PlayerOne', xuid: '1234...' },
   *   { state: 'Online', game: 'Minecraft' }
   * );
   * // Returns: { gamertag: 'PlayerOne', state: 'Online', game: 'Minecraft' }
   */
  static createSafeChildStatus(child, presence) {
    return {
      childId: child.childId,
      gamertag: child.xboxGamertag || 'Unknown',
      state: presence?.state || 'Offline',
      game: presence?.lastSeen?.titleName || null,
      lastSeen: presence?.lastSeen?.timestamp || null,
      // XUID explicitly excluded
    };
  }

  /**
   * Logs privacy-safe information with automatic XUID redaction
   *
   * @static
   * @param {string} level - Log level (info, warn, error)
   * @param {string} message - Log message
   * @param {Object} data - Additional data (XUIDs will be masked)
   *
   * @example
   * PrivacyUtils.safeLog('info', 'Fetching presence', {
   *   gamertag: 'PlayerOne',
   *   xuid: '2535405290574572'
   * });
   * // Logs: [Info] Fetching presence - gamertag: PlayerOne, xuid: 2535****5572
   */
  static safeLog(level, message, data = {}) {
    const safeData = { ...data };

    // Mask XUID if present
    if (safeData.xuid) {
      safeData.xuid = this.maskXUID(safeData.xuid);
    }

    if (safeData.xuids && Array.isArray(safeData.xuids)) {
      safeData.xuids = safeData.xuids.map(xuid => this.maskXUID(xuid));
    }

    const safeMessage = this.sanitizeLog(message);

    console[level](`[${level.toUpperCase()}] ${safeMessage}`, safeData);
  }

  /**
   * Checks if gamertag needs to be refreshed (user may have changed it)
   * XUIDs are permanent, but gamertags can change
   *
   * @static
   * @param {number} lastRefresh - Timestamp of last gamertag refresh
   * @param {number} maxAge - Maximum age in milliseconds (default: 7 days)
   * @returns {boolean} True if refresh needed
   *
   * @example
   * if (PrivacyUtils.shouldRefreshGamertag(child.lastGamertagRefresh)) {
   *   const profile = await api.getProfile(child.xuid);
   *   child.xboxGamertag = profile.gamertag;
   * }
   */
  static shouldRefreshGamertag(lastRefresh, maxAge = 7 * 24 * 60 * 60 * 1000) {
    if (!lastRefresh) {
      return true; // Never refreshed
    }

    const age = Date.now() - lastRefresh;
    return age > maxAge;
  }
}

export default PrivacyUtils;
