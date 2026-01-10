/**
 * Xbox Live API Endpoints and Configuration
 *
 * This module contains all Xbox Live API URLs, OAuth configuration,
 * and rate limiting parameters used throughout the plugin.
 *
 * @module constants/xboxEndpoints
 */

/**
 * Base URLs for Xbox Live API services
 * @constant {Object}
 */
export const BASE_URLS = {
  /** Xbox Live authentication service */
  AUTH: 'https://login.live.com',
  /** Xbox Live user authentication */
  USER_AUTH: 'https://user.auth.xboxlive.com',
  /** Xbox Live XSTS (Xbox Secure Token Service) */
  XSTS: 'https://xsts.auth.xboxlive.com',
  /** Xbox Live Profile Service */
  PROFILE: 'https://profile.xboxlive.com',
  /** Xbox Live Achievements Service */
  ACHIEVEMENTS: 'https://achievements.xboxlive.com',
  /** Xbox Live Presence Service */
  PRESENCE: 'https://userpresence.xboxlive.com',
  /** Xbox Live Social Service */
  SOCIAL: 'https://social.xboxlive.com',
  /** Xbox Live Activity Service */
  ACTIVITY: 'https://avty.xboxlive.com',
  /** Xbox Live Title Hub Service */
  TITLE_HUB: 'https://titlehub.xboxlive.com'
};

/**
 * Xbox Live API endpoint URLs
 *
 * @constant {Object} XBOX_ENDPOINTS
 * @property {string} OAUTH_AUTHORIZE - Microsoft OAuth2 authorization endpoint
 * @property {string} OAUTH_TOKEN - Microsoft OAuth2 token exchange endpoint
 * @property {string} USER_AUTH - Xbox Live user authentication endpoint (Stage 2)
 * @property {string} XSTS_AUTHORIZE - Xbox Live XSTS token authorization endpoint (Stage 3)
 * @property {string} PRESENCE_BATCH - Batch presence query endpoint for multiple users
 * @property {string} PROFILE - User profile endpoint (requires gamertag substitution)
 * @property {string} PROFILE_BY_XUID - User profile by XUID endpoint
 * @property {string} TITLE_HUB - Title metadata endpoint (requires titleId substitution)
 * @property {string} ACHIEVEMENTS - User achievements endpoint
 * @property {string} SOCIAL_FRIENDS - User friends list endpoint
 * @property {string} ACTIVITY_RECENT - Recent activity endpoint
 */
export const XBOX_ENDPOINTS = {
  // OAuth2 endpoints
  OAUTH_AUTHORIZE: `${BASE_URLS.AUTH}/oauth20_authorize.srf`,
  OAUTH_TOKEN: `${BASE_URLS.AUTH}/oauth20_token.srf`,

  // Xbox Live authentication chain
  USER_AUTH: `${BASE_URLS.USER_AUTH}/user/authenticate`,
  XSTS_AUTHORIZE: `${BASE_URLS.XSTS}/xsts/authorize`,

  // Xbox Live APIs
  PRESENCE_BATCH: `${BASE_URLS.PRESENCE}/users/batch`,
  PROFILE: `${BASE_URLS.PROFILE}/users/gt({gamertag})/profile/settings`,
  PROFILE_BY_XUID: `${BASE_URLS.PROFILE}/users/xuid({xuid})/profile/settings`,
  TITLE_HUB: `${BASE_URLS.TITLE_HUB}/titles/{titleId}`,
  ACHIEVEMENTS: `${BASE_URLS.ACHIEVEMENTS}/users/xuid({xuid})/achievements`,
  SOCIAL_FRIENDS: `${BASE_URLS.SOCIAL}/users/xuid({xuid})/people`,
  ACTIVITY_RECENT: `${BASE_URLS.ACTIVITY}/users/xuid({xuid})/activity/recent`
};

/**
 * API endpoint builders for dynamic URL construction
 * @constant {Object}
 */
export const API_BUILDERS = {
  /**
   * Build profile URL by XUID
   * @param {string} xuid - Xbox User ID
   * @returns {string} Profile endpoint URL
   */
  profileByXuid: (xuid) => `${BASE_URLS.PROFILE}/users/xuid(${xuid})/profile/settings`,

  /**
   * Build profile URL by gamertag
   * @param {string} gamertag - Xbox gamertag
   * @returns {string} Profile endpoint URL
   */
  profileByGamertag: (gamertag) => `${BASE_URLS.PROFILE}/users/gt(${gamertag})/profile/settings`,

  /**
   * Build achievements URL
   * @param {string} xuid - Xbox User ID
   * @param {string} [titleId] - Optional game title ID
   * @returns {string} Achievements endpoint URL
   */
  achievements: (xuid, titleId) =>
    titleId
      ? `${BASE_URLS.ACHIEVEMENTS}/users/xuid(${xuid})/achievements?titleId=${titleId}`
      : `${BASE_URLS.ACHIEVEMENTS}/users/xuid(${xuid})/achievements`,

  /**
   * Build title metadata URL
   * @param {string} titleId - Game title ID
   * @returns {string} Title hub endpoint URL
   */
  titleHub: (titleId) => `${BASE_URLS.TITLE_HUB}/titles/${titleId}`,

  /**
   * Build friends list URL
   * @param {string} xuid - Xbox User ID
   * @returns {string} Friends endpoint URL
   */
  friends: (xuid) => `${BASE_URLS.SOCIAL}/users/xuid(${xuid})/people`,

  /**
   * Build recent activity URL
   * @param {string} xuid - Xbox User ID
   * @returns {string} Activity endpoint URL
   */
  recentActivity: (xuid) => `${BASE_URLS.ACTIVITY}/users/xuid(${xuid})/activity/recent`
};

/**
 * OAuth2 scopes required for Xbox Live access
 *
 * @constant {Object} OAUTH_SCOPES
 * @description
 * - SIGNIN: Required for Xbox Live authentication
 * - OFFLINE_ACCESS: Required for refresh token generation
 * - PROFILE_READ: Read user profile information (optional, often included with signin)
 * - SOCIAL_READ: Read user social information (optional)
 * - ACHIEVEMENTS_READ: Read user achievements (optional)
 */
export const OAUTH_SCOPES = {
  SIGNIN: 'Xboxlive.signin',
  OFFLINE_ACCESS: 'Xboxlive.offline_access',
  PROFILE_READ: 'Xboxlive.profileRead',
  SOCIAL_READ: 'Xboxlive.socialRead',
  ACHIEVEMENTS_READ: 'Xboxlive.achievementsRead',

  /**
   * Get all required scopes as an array
   * @returns {string[]} Array of scope strings
   */
  getAll: () => [
    OAUTH_SCOPES.SIGNIN,
    OAUTH_SCOPES.OFFLINE_ACCESS
  ],

  /**
   * Get extended scopes for full access
   * @returns {string[]} Array of all available scopes
   */
  getExtended: () => [
    OAUTH_SCOPES.SIGNIN,
    OAUTH_SCOPES.OFFLINE_ACCESS,
    OAUTH_SCOPES.PROFILE_READ,
    OAUTH_SCOPES.SOCIAL_READ,
    OAUTH_SCOPES.ACHIEVEMENTS_READ
  ],

  /**
   * Join scopes as space-separated string (for OAuth URL)
   * @param {boolean} extended - Include extended scopes
   * @returns {string} Space-separated scope string
   */
  toString: (extended = false) =>
    (extended ? OAUTH_SCOPES.getExtended() : OAUTH_SCOPES.getAll()).join(' ')
};

/**
 * API rate limiting configuration
 *
 * Xbox Live enforces strict rate limits to prevent abuse:
 * - Burst: Short-term limit for immediate requests
 * - Sustained: Long-term limit for continuous operation
 *
 * Exceeding these limits results in 429 (Too Many Requests) errors
 * and potential temporary API bans.
 *
 * @constant {Object} RATE_LIMITS
 * @property {Object} BURST - Short-term burst rate limit
 * @property {number} BURST.requests - Maximum requests allowed in burst window
 * @property {number} BURST.window - Time window in milliseconds (15 seconds)
 * @property {Object} SUSTAINED - Long-term sustained rate limit
 * @property {number} SUSTAINED.requests - Maximum requests allowed in sustained window
 * @property {number} SUSTAINED.window - Time window in milliseconds (5 minutes)
 */
export const RATE_LIMITS = {
  BURST: {
    requests: 10,
    window: 15000 // 15 seconds
  },
  SUSTAINED: {
    requests: 30,
    window: 300000 // 5 minutes
  }
};

/**
 * Xbox Live API contract versions
 *
 * These header values are required for API authentication and must
 * match the expected version for each endpoint.
 *
 * @constant {Object} CONTRACT_VERSIONS
 * @property {string} AUTH - Contract version for authentication endpoints
 * @property {string} PRESENCE - Contract version for presence API
 * @property {string} PROFILE - Contract version for profile API
 */
export const CONTRACT_VERSIONS = {
  AUTH: '1',
  PRESENCE: '3',
  PROFILE: '2'
};

/**
 * Xbox Live authentication configuration
 *
 * @constant {Object} AUTH_CONFIG
 * @property {string} RELYING_PARTY_AUTH - Relying party for user authentication
 * @property {string} RELYING_PARTY_XSTS - Relying party for XSTS authorization
 * @property {string} TOKEN_TYPE - Token type for JWT tokens
 * @property {string} AUTH_METHOD - Authentication method (RPS = Microsoft Account)
 * @property {string} SITE_NAME - Site name for Xbox Live authentication
 * @property {string} SANDBOX_ID - Sandbox ID for retail Xbox Live environment
 */
export const AUTH_CONFIG = {
  RELYING_PARTY_AUTH: 'http://auth.xboxlive.com',
  RELYING_PARTY_XSTS: 'http://xboxlive.com',
  TOKEN_TYPE: 'JWT',
  AUTH_METHOD: 'RPS',
  SITE_NAME: 'user.auth.xboxlive.com',
  SANDBOX_ID: 'RETAIL'
};

/**
 * Polling intervals for presence detection
 *
 * @constant {Object} POLLING_INTERVALS
 * @property {number} PRESENCE_CHECK - Interval for checking Xbox Live presence (15 seconds)
 * @property {number} TOKEN_REFRESH_CHECK - Interval for checking token expiry (5 minutes)
 * @property {number} AGENT_PROCESS_CHECK - Interval for agent-side process monitoring (5 seconds)
 */
export const POLLING_INTERVALS = {
  PRESENCE_CHECK: 15000,      // 15 seconds (cloud detection)
  TOKEN_REFRESH_CHECK: 300000, // 5 minutes
  AGENT_PROCESS_CHECK: 5000    // 5 seconds (local PC detection)
};

/**
 * Cache TTL (Time To Live) configurations
 *
 * @constant {Object} CACHE_TTL
 * @property {number} PRESENCE - Presence data cache duration (15 seconds)
 * @property {number} TITLE_METADATA - Game metadata cache duration (24 hours)
 * @property {number} PROFILE - Profile data cache duration (1 hour)
 */
export const CACHE_TTL = {
  PRESENCE: 15000,           // 15 seconds
  TITLE_METADATA: 86400000,  // 24 hours
  PROFILE: 3600000           // 1 hour
};

/**
 * Xbox device types
 *
 * @constant {Object} DEVICE_TYPES
 */
export const DEVICE_TYPES = {
  XBOX_ONE: 'XboxOne',
  XBOX_SERIES_X: 'XboxSeriesX',
  XBOX_SERIES_S: 'XboxSeriesS',
  XBOX_360: 'Xbox360',
  PC: 'Win32',
  IOS: 'iOS',
  ANDROID: 'Android',
  WEB: 'Web'
};

/**
 * Presence states
 *
 * @constant {Object} PRESENCE_STATES
 */
export const PRESENCE_STATES = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  AWAY: 'Away'
};

/**
 * Profile settings keys to request from Xbox API
 * @constant {string[]}
 */
export const PROFILE_SETTINGS = [
  'Gamertag',
  'Gamerscore',
  'AccountTier',
  'XboxOneRep',
  'PreferredColor',
  'RealName',
  'Bio',
  'Location',
  'TenureLevel',
  'Watermarks',
  'IsQuarantined'
];

/**
 * HTTP request headers for Xbox API
 * @constant {Object}
 */
export const REQUEST_HEADERS = {
  DEFAULT: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  /**
   * Get headers with contract version
   * @param {string} version - Contract version
   * @returns {Object} Headers object
   */
  withContractVersion: (version) => ({
    ...REQUEST_HEADERS.DEFAULT,
    'x-xbl-contract-version': version
  }),
  /**
   * Get authenticated headers
   * @param {string} token - XSTS token
   * @param {string} uhs - User hash
   * @param {string} [version] - Optional contract version
   * @returns {Object} Headers object
   */
  authenticated: (token, uhs, version) => {
    const headers = {
      ...REQUEST_HEADERS.DEFAULT,
      'Authorization': `XBL3.0 x=${uhs};${token}`
    };
    if (version) {
      headers['x-xbl-contract-version'] = version;
    }
    return headers;
  }
};

/**
 * Retry configuration for failed requests
 * @constant {Object}
 */
export const RETRY_CONFIG = {
  /** HTTP status codes that should trigger retry */
  RETRYABLE_STATUS_CODES: [408, 429, 500, 502, 503, 504],
  /** Maximum number of retry attempts */
  MAX_ATTEMPTS: 3,
  /** Initial retry delay (ms) */
  INITIAL_DELAY: 1000,
  /** Maximum retry delay (ms) */
  MAX_DELAY: 10000,
  /** Exponential backoff factor */
  BACKOFF_FACTOR: 2,
  /** Jitter factor (0-1) for randomizing delays */
  JITTER_FACTOR: 0.1,
  /**
   * Calculate retry delay with exponential backoff and jitter
   * @param {number} attemptNumber - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  calculateDelay: (attemptNumber) => {
    const exponentialDelay = RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_FACTOR, attemptNumber);
    const cappedDelay = Math.min(exponentialDelay, RETRY_CONFIG.MAX_DELAY);
    const jitter = cappedDelay * RETRY_CONFIG.JITTER_FACTOR * Math.random();
    return Math.floor(cappedDelay + jitter);
  }
};
