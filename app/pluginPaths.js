/**
 * Plugin Path Resolution Utility
 *
 * Provides environment-aware plugin path resolution for Allow2Automate.
 * Separates development and production plugin storage to prevent conflicts.
 *
 * Production paths (platform-specific):
 * - macOS: ~/Library/Application Support/allow2automate/plugins
 * - Windows: %APPDATA%/allow2automate/plugins
 * - Linux: ~/.config/allow2automate/plugins
 *
 * Development path:
 * - <project-root>/dev-plugins
 */

import path from 'path';
import os from 'os';

// Note: __dirname is provided by Babel/Webpack in this project
// No need to derive it from import.meta.url

/**
 * Detect if running in development mode
 * Checks multiple indicators for reliable detection
 */
export function isDevelopmentMode() {
    // Check NODE_ENV
    if (process.env.NODE_ENV === 'development') {
        return true;
    }

    // Check if running from source (not packaged)
    if (process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath)) {
        return true;
    }

    // Check if running with electron CLI
    if (process.argv.some(arg => arg.includes('electron'))) {
        return true;
    }

    return false;
}

/**
 * Get platform-specific production plugin path
 * @param {Object} app - Electron app object
 * @returns {string} Platform-specific production plugin path
 */
export function getProductionPluginPath(app) {
    const platform = os.platform();

    // Use Electron's appData path which is platform-aware
    const appData = app.getPath('appData');

    switch (platform) {
        case 'darwin':
            // macOS: ~/Library/Application Support/allow2automate/plugins
            return path.join(appData, 'allow2automate', 'plugins');

        case 'win32':
            // Windows: %APPDATA%/allow2automate/plugins
            return path.join(appData, 'allow2automate', 'plugins');

        case 'linux':
            // Linux: ~/.config/allow2automate/plugins (via appData)
            return path.join(appData, 'allow2automate', 'plugins');

        default:
            // Fallback for unknown platforms
            console.warn(`[PluginPaths] Unknown platform: ${platform}, using default`);
            return path.join(appData, 'allow2automate', 'plugins');
    }
}

/**
 * Get development plugin path (project-relative)
 * @returns {string} Development plugin path
 */
export function getDevelopmentPluginPath() {
    // Project-relative path: <project-root>/dev-plugins
    return path.join(__dirname, '..', 'dev-plugins');
}

/**
 * Get plugin path based on current environment
 * @param {Object} app - Electron app object
 * @returns {string} Environment-appropriate plugin path
 */
export function getPluginPath(app) {
    const isDev = isDevelopmentMode();

    if (isDev) {
        const devPath = getDevelopmentPluginPath();
        console.log(`[PluginPaths] Using DEVELOPMENT plugin path: ${devPath}`);
        return devPath;
    } else {
        const prodPath = getProductionPluginPath(app);
        console.log(`[PluginPaths] Using PRODUCTION plugin path: ${prodPath}`);
        return prodPath;
    }
}

/**
 * Get all plugin path information for debugging
 * @param {Object} app - Electron app object
 * @returns {Object} Plugin path information
 */
export function getPluginPathInfo(app) {
    const isDev = isDevelopmentMode();
    const currentPath = getPluginPath(app);
    const prodPath = getProductionPluginPath(app);
    const devPath = getDevelopmentPluginPath();

    return {
        environment: isDev ? 'development' : 'production',
        currentPath: currentPath,
        productionPath: prodPath,
        developmentPath: devPath,
        platform: os.platform(),
        nodeEnv: process.env.NODE_ENV,
        execPath: process.execPath,
        argv: process.argv
    };
}

/**
 * Legacy compatibility: Get path by name with plugin-specific handling
 * @param {Object} app - Electron app object
 * @param {string} name - Path name ('appData', 'userData', 'plugins', etc.)
 * @returns {string} Requested path
 */
export function getPathByName(app, name) {
    // Handle plugin-specific path requests
    if (name === 'plugins' || name === 'pluginsDir') {
        return getPluginPath(app);
    }

    // Delegate to Electron's getPath for standard paths
    return app.getPath(name || 'appData');
}

export default {
    isDevelopmentMode,
    getProductionPluginPath,
    getDevelopmentPluginPath,
    getPluginPath,
    getPluginPathInfo,
    getPathByName
};
