/**
 * Plugin Registry API
 *
 * Handles fetching plugin registry from GitHub with error handling,
 * caching, and offline support using electron-settings.
 */

import request from 'request';
import settings from 'electron-settings';

// Error types for consistent error handling
export const ErrorTypes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    PARSE_ERROR: 'PARSE_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    TIMEOUT: 'TIMEOUT',
    RATE_LIMIT: 'RATE_LIMIT',
    UNKNOWN: 'UNKNOWN'
};

// User-friendly error messages
const ErrorMessages = {
    [ErrorTypes.NETWORK_ERROR]: 'Unable to connect to the plugin registry. Please check your internet connection.',
    [ErrorTypes.PARSE_ERROR]: 'The plugin registry data is malformed. Please try again later.',
    [ErrorTypes.NOT_FOUND]: 'The plugin registry could not be found.',
    [ErrorTypes.TIMEOUT]: 'The connection to the plugin registry timed out. Please try again.',
    [ErrorTypes.RATE_LIMIT]: 'GitHub API rate limit exceeded. Please try again later.',
    [ErrorTypes.UNKNOWN]: 'An unexpected error occurred while loading the plugin registry.'
};

// Cache settings
const CACHE_KEY = 'pluginRegistry';
const CACHE_TIMESTAMP_KEY = 'pluginRegistryTimestamp';
const CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Fetch plugin registry from GitHub
 * @param {Object} options - Fetch options
 * @param {number} options.timeout - Request timeout in milliseconds (default: 5000)
 * @param {boolean} options.useCache - Whether to use cached data if available (default: true)
 * @returns {Promise<Object>} Registry data with error information
 */
export async function fetchPluginRegistry(options = {}) {
    const {
        timeout = 5000,
        useCache = true
    } = options;

    const registryUrl = 'https://raw.githubusercontent.com/Allow2/automate-registry/master/plugins.json';

    try {
        // Try to fetch from network first
        const result = await fetchFromNetwork(registryUrl, timeout);

        if (result.success) {
            // Cache successful response
            await cacheRegistry(result.data);
            return {
                success: true,
                data: result.data,
                fromCache: false,
                timestamp: Date.now(),
                error: null
            };
        }

        // Network fetch failed, try cache if enabled
        if (useCache) {
            const cachedData = await getCachedRegistry();
            if (cachedData) {
                return {
                    success: true,
                    data: cachedData.data,
                    fromCache: true,
                    timestamp: cachedData.timestamp,
                    error: result.error,
                    errorType: result.errorType,
                    errorMessage: result.errorMessage
                };
            }
        }

        // Both network and cache failed
        return {
            success: false,
            data: null,
            fromCache: false,
            timestamp: null,
            error: result.error,
            errorType: result.errorType,
            errorMessage: result.errorMessage
        };

    } catch (error) {
        console.error('[Registry] Unexpected error:', error);

        // Try cache as last resort
        if (useCache) {
            const cachedData = await getCachedRegistry();
            if (cachedData) {
                return {
                    success: true,
                    data: cachedData.data,
                    fromCache: true,
                    timestamp: cachedData.timestamp,
                    error: error,
                    errorType: ErrorTypes.UNKNOWN,
                    errorMessage: ErrorMessages[ErrorTypes.UNKNOWN]
                };
            }
        }

        return {
            success: false,
            data: null,
            fromCache: false,
            timestamp: null,
            error: error,
            errorType: ErrorTypes.UNKNOWN,
            errorMessage: ErrorMessages[ErrorTypes.UNKNOWN]
        };
    }
}

/**
 * Fetch registry from network
 * @param {string} url - Registry URL
 * @param {number} timeout - Request timeout
 * @returns {Promise<Object>} Fetch result
 */
function fetchFromNetwork(url, timeout) {
    return new Promise((resolve) => {
        const requestOptions = {
            url,
            timeout,
            headers: {
                'User-Agent': 'Allow2-Automate'
            }
        };

        request(requestOptions, (error, response, body) => {
            // Handle network errors
            if (error) {
                let errorType = ErrorTypes.NETWORK_ERROR;

                if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
                    errorType = ErrorTypes.TIMEOUT;
                } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
                    errorType = ErrorTypes.NETWORK_ERROR;
                }

                resolve({
                    success: false,
                    data: null,
                    error,
                    errorType,
                    errorMessage: ErrorMessages[errorType]
                });
                return;
            }

            // Handle HTTP errors
            if (!response || response.statusCode !== 200) {
                let errorType = ErrorTypes.UNKNOWN;
                let errorMessage = ErrorMessages[ErrorTypes.UNKNOWN];

                if (response) {
                    if (response.statusCode === 404) {
                        errorType = ErrorTypes.NOT_FOUND;
                        errorMessage = ErrorMessages[ErrorTypes.NOT_FOUND];
                    } else if (response.statusCode === 403) {
                        errorType = ErrorTypes.RATE_LIMIT;
                        errorMessage = ErrorMessages[ErrorTypes.RATE_LIMIT];
                    } else {
                        errorMessage = `HTTP ${response.statusCode}: ${response.statusMessage}`;
                    }
                }

                resolve({
                    success: false,
                    data: null,
                    error: new Error(errorMessage),
                    errorType,
                    errorMessage
                });
                return;
            }

            // Parse response
            try {
                const data = JSON.parse(body);

                // Validate data structure
                if (!data || typeof data !== 'object') {
                    resolve({
                        success: false,
                        data: null,
                        error: new Error('Invalid registry format'),
                        errorType: ErrorTypes.PARSE_ERROR,
                        errorMessage: ErrorMessages[ErrorTypes.PARSE_ERROR]
                    });
                    return;
                }

                resolve({
                    success: true,
                    data,
                    error: null,
                    errorType: null,
                    errorMessage: null
                });

            } catch (parseError) {
                resolve({
                    success: false,
                    data: null,
                    error: parseError,
                    errorType: ErrorTypes.PARSE_ERROR,
                    errorMessage: ErrorMessages[ErrorTypes.PARSE_ERROR]
                });
            }
        });
    });
}

/**
 * Cache registry data
 * @param {Object} data - Registry data to cache
 * @returns {Promise<void>}
 */
async function cacheRegistry(data) {
    try {
        await settings.set(CACHE_KEY, data);
        await settings.set(CACHE_TIMESTAMP_KEY, Date.now());
        console.log('[Registry] Data cached successfully');
    } catch (error) {
        console.error('[Registry] Error caching data:', error);
    }
}

/**
 * Get cached registry data if available and not expired
 * @returns {Promise<Object|null>} Cached data or null
 */
async function getCachedRegistry() {
    try {
        const data = await settings.get(CACHE_KEY);
        const timestamp = await settings.get(CACHE_TIMESTAMP_KEY);

        if (!data || !timestamp) {
            return null;
        }

        // Check if cache is still valid (optional - can be removed to always use cache)
        // const age = Date.now() - timestamp;
        // if (age > CACHE_TTL) {
        //     console.log('[Registry] Cache expired');
        //     return null;
        // }

        console.log('[Registry] Using cached data');
        return {
            data,
            timestamp
        };

    } catch (error) {
        console.error('[Registry] Error reading cache:', error);
        return null;
    }
}

/**
 * Clear cached registry data
 * @returns {Promise<void>}
 */
export async function clearCache() {
    try {
        await settings.unset(CACHE_KEY);
        await settings.unset(CACHE_TIMESTAMP_KEY);
        console.log('[Registry] Cache cleared');
    } catch (error) {
        console.error('[Registry] Error clearing cache:', error);
    }
}

/**
 * Get cache age in milliseconds
 * @returns {Promise<number|null>} Cache age or null if no cache
 */
export async function getCacheAge() {
    try {
        const timestamp = await settings.get(CACHE_TIMESTAMP_KEY);
        if (!timestamp) return null;
        return Date.now() - timestamp;
    } catch (error) {
        return null;
    }
}

/**
 * Check if cached data exists
 * @returns {Promise<boolean>} Whether cache exists
 */
export async function hasCachedData() {
    try {
        const data = await settings.get(CACHE_KEY);
        return !!data;
    } catch (error) {
        return false;
    }
}

export default {
    fetchPluginRegistry,
    clearCache,
    getCacheAge,
    hasCachedData,
    ErrorTypes,
    ErrorMessages
};
