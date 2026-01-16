/**
 * GA4 Measurement Protocol Client
 * Direct REST API implementation for Google Analytics 4
 *
 * This replaces Firebase Analytics which has compatibility issues with Electron.
 * Uses the GA4 Measurement Protocol: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

const https = require('https');
const { v4: uuidv4 } = require('uuid');

// GA4 Configuration
const GA4_CONFIG = {
  measurementId: 'G-QN8ZM81FHJ',
  apiSecret: process.env.GA4_API_SECRET || '', // Set via environment or will use debug endpoint
  endpoint: 'https://www.google-analytics.com/mp/collect',
  debugEndpoint: 'https://www.google-analytics.com/debug/mp/collect'
};

// Client state
let clientId = null;
let userId = null;
let userProperties = {};
let sessionId = null;
let isInitialized = false;
let debugMode = false;

/**
 * Generate or retrieve persistent client ID
 * Client ID should persist across sessions for proper user tracking
 */
function getOrCreateClientId() {
  if (clientId) {
    return clientId;
  }

  // Try to get from localStorage (renderer process)
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('ga4_client_id');
    if (stored) {
      clientId = stored;
      return clientId;
    }
  }

  // Generate new client ID
  clientId = uuidv4();

  // Persist it
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('ga4_client_id', clientId);
  }

  return clientId;
}

/**
 * Generate session ID (changes per app session)
 */
function getSessionId() {
  if (!sessionId) {
    sessionId = Date.now().toString();
  }
  return sessionId;
}

/**
 * Send events to GA4 Measurement Protocol
 * @param {Array} events - Array of event objects
 * @returns {Promise<boolean>} Success status
 */
async function sendToGA4(events) {
  if (!isInitialized) {
    console.warn('[GA4] Not initialized, queuing event');
    return false;
  }

  const endpoint = debugMode ? GA4_CONFIG.debugEndpoint : GA4_CONFIG.endpoint;
  const url = `${endpoint}?measurement_id=${GA4_CONFIG.measurementId}&api_secret=${GA4_CONFIG.apiSecret}`;

  const payload = {
    client_id: getOrCreateClientId(),
    timestamp_micros: Date.now() * 1000,
    events: events.map(event => ({
      name: event.name,
      params: {
        ...event.params,
        session_id: getSessionId(),
        engagement_time_msec: 100 // Required parameter
      }
    }))
  };

  // Add user_id if set
  if (userId) {
    payload.user_id = userId;
  }

  // Add user properties if set
  if (Object.keys(userProperties).length > 0) {
    payload.user_properties = {};
    for (const [key, value] of Object.entries(userProperties)) {
      payload.user_properties[key] = { value: String(value) };
    }
  }

  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: `${urlObj.pathname}${urlObj.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (debugMode && data) {
          console.log('[GA4 Debug Response]', data);
        }

        // GA4 returns 204 No Content on success
        if (res.statusCode === 204 || res.statusCode === 200) {
          resolve(true);
        } else {
          console.warn('[GA4] Unexpected status:', res.statusCode, data);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[GA4] Request error:', err.message);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Initialize GA4 client
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} Success status
 */
async function initializeGA4(options = {}) {
  if (isInitialized) {
    console.log('[GA4] Already initialized');
    return true;
  }

  try {
    // Apply options
    if (options.apiSecret) {
      GA4_CONFIG.apiSecret = options.apiSecret;
    }
    if (options.measurementId) {
      GA4_CONFIG.measurementId = options.measurementId;
    }
    if (options.debug !== undefined) {
      debugMode = options.debug;
    }

    // Initialize client ID
    getOrCreateClientId();

    isInitialized = true;
    console.log('[GA4] Initialized with measurement ID:', GA4_CONFIG.measurementId);

    // Send initialization event
    await logEvent('ga4_initialized', {
      timestamp: new Date().toISOString(),
      environment: 'electron',
      client_id: clientId
    });

    return true;
  } catch (err) {
    console.error('[GA4] Initialization error:', err);
    return false;
  }
}

/**
 * Log a single event
 * @param {string} eventName - Event name (snake_case, max 40 chars)
 * @param {Object} params - Event parameters
 * @returns {Promise<boolean>} Success status
 */
async function logEvent(eventName, params = {}) {
  // Validate event name (GA4 requirements)
  const sanitizedName = eventName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .substring(0, 40);

  // Sanitize params (GA4 has limits on param names and values)
  const sanitizedParams = {};
  for (const [key, value] of Object.entries(params)) {
    const sanitizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 40);
    let sanitizedValue = value;

    // Convert to string and limit length for string values
    if (typeof value === 'string') {
      sanitizedValue = value.substring(0, 100);
    } else if (typeof value === 'object') {
      sanitizedValue = JSON.stringify(value).substring(0, 100);
    }

    sanitizedParams[sanitizedKey] = sanitizedValue;
  }

  return sendToGA4([{ name: sanitizedName, params: sanitizedParams }]);
}

/**
 * Set user ID for cross-device tracking
 * @param {string} id - User identifier
 */
function setUserId(id) {
  userId = id;
  console.log('[GA4] User ID set');
}

/**
 * Set user properties
 * @param {Object} properties - User properties object
 */
function setUserProperties(properties) {
  userProperties = { ...userProperties, ...properties };
  console.log('[GA4] User properties updated');
}

/**
 * Get the analytics instance info
 * @returns {Object} Analytics state info
 */
function getAnalyticsInfo() {
  return {
    isInitialized,
    clientId,
    userId,
    sessionId,
    measurementId: GA4_CONFIG.measurementId
  };
}

/**
 * Enable/disable debug mode
 * @param {boolean} enabled - Debug mode state
 */
function setDebugMode(enabled) {
  debugMode = enabled;
  console.log('[GA4] Debug mode:', enabled ? 'enabled' : 'disabled');
}

// Compatibility exports matching previous firebase-config.js interface
module.exports = {
  // Initialization
  initializeFirebase: initializeGA4, // Alias for backward compatibility
  initializeGA4,

  // Event logging
  logEvent,
  logAnalyticsEvent: logEvent, // Alias

  // User management
  setUserId,
  setAnalyticsUserId: setUserId, // Alias
  setUserProperties,
  setAnalyticsUserProperties: setUserProperties, // Alias

  // Info
  getAnalyticsInstance: getAnalyticsInfo,
  getAnalyticsInfo,

  // Debug
  setDebugMode,

  // Direct access to send function for batching
  sendToGA4
};
