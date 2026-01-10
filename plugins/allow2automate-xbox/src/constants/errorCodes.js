/**
 * Xbox Live Error Codes and Messages
 *
 * This module provides mappings for Xbox Live API error codes and
 * utility functions for generating user-friendly error messages.
 *
 * Error codes are returned by Xbox Live APIs during authentication,
 * authorization, and presence queries. These codes help identify
 * specific issues with account status, regional restrictions, and
 * age verification requirements.
 *
 * @module constants/errorCodes
 * @see {@link https://docs.microsoft.com/en-us/gaming/xbox-live/api-ref/xbox-live-rest/additional/httpstatuscodes Xbox Live HTTP Status Codes}
 */

/**
 * Xbox Live API error code mappings
 *
 * These error codes are returned in the response body or as HTTP status codes
 * from Xbox Live authentication and API endpoints.
 *
 * @constant {Object} XBOX_ERROR_CODES
 * @property {string} 2148916233 - Account does not have Xbox Live access
 * @property {string} 2148916235 - Xbox Live account is banned or suspended
 * @property {string} 2148916236 - Account requires adult verification
 * @property {string} 2148916237 - Account is from a country where Xbox Live is unavailable
 * @property {string} 2148916238 - Child account without parental consent for Xbox Live
 * @property {string} 2148916239 - Account is a child account (under 18)
 * @property {string} 2148916240 - Account requires additional security verification
 * @property {string} 2148916241 - Account is temporarily locked
 * @property {string} 2148916242 - Account requires email verification
 * @property {string} 2148916245 - Account is not allowed to play multiplayer games
 * @property {string} 2148916246 - Account has communication restrictions
 * @property {string} 2148916247 - Account cannot share user-generated content
 */
export const XBOX_ERROR_CODES = {
  // Authentication errors
  2148916233: 'Account does not have Xbox Live access',
  2148916235: 'Xbox Live account is banned or suspended',
  2148916236: 'Account requires adult verification',
  2148916237: 'Account is from a country where Xbox Live is unavailable',
  2148916238: 'Child account without parental consent for Xbox Live',
  2148916239: 'Account is a child account (under 18 years old)',
  2148916240: 'Account requires additional security verification',
  2148916241: 'Account is temporarily locked due to suspicious activity',
  2148916242: 'Account requires email verification',

  // Permission errors
  2148916245: 'Account is not allowed to play multiplayer games',
  2148916246: 'Account has communication restrictions (cannot send messages)',
  2148916247: 'Account cannot share user-generated content',
  2148916248: 'Account is restricted from viewing other profiles',
  2148916249: 'Account cannot join clubs or groups',

  // Regional and compliance errors
  2148916250: 'Service is unavailable in your region',
  2148916251: 'Account age group prevents access to this content',
  2148916252: 'Family settings prevent this action',
  2148916253: 'Account is subject to time restrictions',

  // Token and session errors
  2148916254: 'Authentication token has expired',
  2148916255: 'Authentication token is invalid',
  2148916256: 'XSTS token authorization failed',
  2148916257: 'User token generation failed',
  2148916258: 'OAuth token is invalid or revoked',

  // API and rate limiting errors
  2148916259: 'Rate limit exceeded - too many requests',
  2148916260: 'Service is temporarily unavailable',
  2148916261: 'Requested resource not found',
  2148916262: 'Invalid request parameters',
  2148916263: 'Insufficient permissions for this operation',

  // Privacy and data errors
  2148916264: 'XUID privacy violation detected',
  2148916265: 'User has blocked access to their profile',
  2148916266: 'User has restricted their online status',
  2148916267: 'User has restricted their gaming activity',

  // Gamertag and profile errors
  2148916268: 'Gamertag not found',
  2148916269: 'Gamertag has been changed',
  2148916270: 'Profile data is incomplete',
  2148916271: 'User has not consented to data sharing',

  // Additional network errors
  2148916272: 'Network connection timeout',
  2148916273: 'Failed to connect to Xbox Live services',
  2148916274: 'DNS resolution failed for Xbox Live domain',
  2148916275: 'SSL/TLS handshake failed',

  // Additional token errors
  2148916276: 'Token signature verification failed',
  2148916277: 'Token claims are invalid',
  2148916278: 'Token audience mismatch',
  2148916279: 'Token issuer not trusted'
};

/**
 * HTTP status code error messages
 *
 * @constant {Object} HTTP_ERROR_CODES
 */
export const HTTP_ERROR_CODES = {
  400: 'Bad Request - Invalid parameters provided',
  401: 'Unauthorized - Authentication token is invalid or expired',
  403: 'Forbidden - Insufficient permissions for this operation',
  404: 'Not Found - Requested resource does not exist',
  429: 'Too Many Requests - Rate limit exceeded',
  500: 'Internal Server Error - Xbox Live service error',
  503: 'Service Unavailable - Xbox Live is temporarily down'
};

/**
 * Error categories for grouping related errors
 *
 * @constant {Object} ERROR_CATEGORIES
 */
export const ERROR_CATEGORIES = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  PERMISSION: 'permission',
  PRIVACY: 'privacy',
  RATE_LIMIT: 'rate_limit',
  NETWORK: 'network',
  REGIONAL: 'regional',
  ACCOUNT_STATUS: 'account_status'
};

/**
 * Get user-friendly error message for Xbox error code
 *
 * @param {number|string} code - Xbox Live error code
 * @returns {string} User-friendly error message
 *
 * @example
 * const message = getErrorMessage(2148916233);
 * // Returns: "Account does not have Xbox Live access"
 *
 * @example
 * const message = getErrorMessage(9999999);
 * // Returns: "Unknown Xbox error: 9999999"
 */
export function getErrorMessage(code) {
  const numericCode = typeof code === 'string' ? parseInt(code, 10) : code;
  return XBOX_ERROR_CODES[numericCode] || `Unknown Xbox error: ${code}`;
}

/**
 * Get HTTP status error message
 *
 * @param {number} statusCode - HTTP status code
 * @returns {string} User-friendly error message
 *
 * @example
 * const message = getHttpErrorMessage(401);
 * // Returns: "Unauthorized - Authentication token is invalid or expired"
 */
export function getHttpErrorMessage(statusCode) {
  return HTTP_ERROR_CODES[statusCode] || `HTTP error ${statusCode}`;
}

/**
 * Categorize error by code
 *
 * @param {number|string} code - Xbox Live error code or HTTP status code
 * @returns {string} Error category
 *
 * @example
 * const category = categorizeError(2148916233);
 * // Returns: "account_status"
 *
 * @example
 * const category = categorizeError(401);
 * // Returns: "authentication"
 */
export function categorizeError(code) {
  const numericCode = typeof code === 'string' ? parseInt(code, 10) : code;

  // HTTP status codes
  if (numericCode === 401 || numericCode === 2148916254 ||
      numericCode === 2148916255 || numericCode === 2148916258) {
    return ERROR_CATEGORIES.AUTHENTICATION;
  }

  if (numericCode === 403 || numericCode === 2148916256 ||
      numericCode === 2148916257 || numericCode === 2148916263) {
    return ERROR_CATEGORIES.AUTHORIZATION;
  }

  if (numericCode === 429 || numericCode === 2148916259) {
    return ERROR_CATEGORIES.RATE_LIMIT;
  }

  if (numericCode >= 2148916245 && numericCode <= 2148916249) {
    return ERROR_CATEGORIES.PERMISSION;
  }

  if (numericCode >= 2148916264 && numericCode <= 2148916271) {
    return ERROR_CATEGORIES.PRIVACY;
  }

  if (numericCode === 2148916237 || numericCode === 2148916250) {
    return ERROR_CATEGORIES.REGIONAL;
  }

  if (numericCode >= 2148916233 && numericCode <= 2148916242) {
    return ERROR_CATEGORIES.ACCOUNT_STATUS;
  }

  return ERROR_CATEGORIES.NETWORK;
}

/**
 * Check if error is retryable
 *
 * Determines whether an error should trigger a retry attempt.
 * Retryable errors are typically temporary network issues or rate limits.
 *
 * @param {number|string} code - Xbox Live error code or HTTP status code
 * @returns {boolean} True if error is retryable
 *
 * @example
 * if (isRetryableError(429)) {
 *   // Wait and retry
 * }
 */
export function isRetryableError(code) {
  const numericCode = typeof code === 'string' ? parseInt(code, 10) : code;

  // Retryable HTTP status codes
  const retryableHttpCodes = [429, 500, 502, 503, 504];
  if (retryableHttpCodes.includes(numericCode)) {
    return true;
  }

  // Retryable Xbox error codes
  const retryableXboxCodes = [
    2148916254, // Token expired
    2148916259, // Rate limit
    2148916260  // Service unavailable
  ];

  return retryableXboxCodes.includes(numericCode);
}

/**
 * Get suggested action for error code
 *
 * Provides actionable guidance for resolving specific errors.
 *
 * @param {number|string} code - Xbox Live error code
 * @returns {string} Suggested action for the user
 *
 * @example
 * const action = getSuggestedAction(2148916238);
 * // Returns: "Please ensure parental consent is granted for this child account in Xbox Family Settings"
 */
export function getSuggestedAction(code) {
  const numericCode = typeof code === 'string' ? parseInt(code, 10) : code;

  const actions = {
    2148916233: 'Please create an Xbox Live account at xbox.com before linking',
    2148916235: 'This account is banned or suspended. Please contact Xbox Support',
    2148916236: 'Please verify your age in your Microsoft account settings',
    2148916237: 'Xbox Live is not available in your country or region',
    2148916238: 'Please ensure parental consent is granted for this child account in Xbox Family Settings',
    2148916239: 'This child account requires parental permission to use Xbox Live',
    2148916240: 'Please complete additional security verification in your Microsoft account',
    2148916241: 'Your account is temporarily locked. Please try again later or contact Xbox Support',
    2148916242: 'Please verify your email address in your Microsoft account settings',
    2148916245: 'Multiplayer gaming is restricted. Check Xbox Family Settings',
    2148916246: 'Communication features are restricted. Check Xbox Family Settings',
    2148916254: 'Session expired. Please re-authenticate',
    2148916255: 'Authentication failed. Please sign in again',
    2148916259: 'Rate limit exceeded. Please wait a few minutes and try again',
    2148916268: 'Gamertag not found. Please verify the gamertag is correct',
    429: 'Too many requests. Please wait a few minutes before trying again',
    401: 'Session expired. Please sign in again',
    503: 'Xbox Live is temporarily unavailable. Please try again later'
  };

  return actions[numericCode] || 'Please try again later or contact support if the issue persists';
}

/**
 * Format error for logging
 *
 * Creates a structured error object suitable for logging and debugging.
 *
 * @param {number|string} code - Error code
 * @param {Object} context - Additional context about the error
 * @returns {Object} Formatted error object
 *
 * @example
 * const errorLog = formatErrorForLogging(401, {
 *   endpoint: 'https://user.auth.xboxlive.com/user/authenticate',
 *   userId: 'child_123'
 * });
 */
export function formatErrorForLogging(code, context = {}) {
  const numericCode = typeof code === 'string' ? parseInt(code, 10) : code;

  return {
    code: numericCode,
    message: getErrorMessage(numericCode),
    category: categorizeError(numericCode),
    retryable: isRetryableError(numericCode),
    suggestedAction: getSuggestedAction(numericCode),
    timestamp: new Date().toISOString(),
    context
  };
}

/**
 * Parse Xbox API error response
 * @param {Object} response - API error response
 * @returns {Object} Parsed error object
 */
export function parseXboxApiError(response) {
  const errorCode = response?.XErr || response?.errorCode;
  const statusCode = response?.statusCode || response?.status;

  if (errorCode) {
    return formatErrorForLogging(errorCode, {
      statusCode,
      rawResponse: response
    });
  }

  if (statusCode) {
    return formatErrorForLogging(statusCode, {
      rawResponse: response
    });
  }

  return formatErrorForLogging('UNKNOWN', {
    message: 'Unknown Xbox API error',
    rawResponse: response
  });
}

/**
 * Create standardized error object for throwing
 * @param {number|string} code - Error code
 * @param {Object} context - Additional context
 * @returns {Error} Error object with additional properties
 */
export function createXboxError(code, context = {}) {
  const errorData = formatErrorForLogging(code, context);
  const error = new Error(errorData.message);
  Object.assign(error, errorData);
  error.name = 'XboxLiveError';
  return error;
}
