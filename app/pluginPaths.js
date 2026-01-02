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
 * Get data root directory based on environment
 * Development: <project-root>/dev-data (git-ignored, never stomps on production)
 * Production: Platform-specific app data directory
 * @param {Object} app - Electron app object
 * @returns {string} Root directory for all app data
 */
export function getDataRoot(app) {
    const isDev = isDevelopmentMode();

    if (isDev) {
        // Development: Use project-local dev-data directory (git-ignored)
        const devDataRoot = path.join(__dirname, '..', 'dev-data');
        console.log(`[PluginPaths] Using DEVELOPMENT data root: ${devDataRoot}`);
        return devDataRoot;
    } else {
        // Production: Use platform-specific app data
        const platform = os.platform();
        const appData = app.getPath('appData');

        let prodDataRoot;
        switch (platform) {
            case 'darwin':
                // macOS: ~/Library/Application Support/allow2automate
                prodDataRoot = path.join(appData, 'allow2automate');
                break;
            case 'win32':
                // Windows: %APPDATA%/allow2automate
                prodDataRoot = path.join(appData, 'allow2automate');
                break;
            case 'linux':
                // Linux: ~/.config/allow2automate
                prodDataRoot = path.join(appData, 'allow2automate');
                break;
            default:
                console.warn(`[PluginPaths] Unknown platform: ${platform}, using default`);
                prodDataRoot = path.join(appData, 'allow2automate');
        }

        console.log(`[PluginPaths] Using PRODUCTION data root: ${prodDataRoot}`);
        return prodDataRoot;
    }
}

/**
 * Get platform-specific production plugin path
 * @param {Object} app - Electron app object
 * @returns {string} Platform-specific production plugin path
 */
export function getProductionPluginPath(app) {
    // All installed plugins (dev and prod) go to data root
    return path.join(getDataRoot(app), 'plugins');
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
 * Get plugin LIBRARY scan path (for marketplace - includes dev-plugins in dev mode)
 * @param {Object} app - Electron app object
 * @returns {string} Path to scan for plugin library/marketplace
 */
export function getPluginLibraryScanPath(app) {
    const isDev = isDevelopmentMode();

    if (isDev) {
        // Development: Scan dev-plugins for marketplace augmentation
        const devPath = getDevelopmentPluginPath();
        console.log(`[PluginPaths] Plugin library scan path (dev): ${devPath}`);
        return devPath;
    } else {
        // Production: No local scan, marketplace comes from registry only
        // Return null to indicate no local scanning
        console.log(`[PluginPaths] Plugin library scan path (prod): REGISTRY ONLY`);
        return null;
    }
}

/**
 * Get plugin INSTALL path (where npm installed plugins are stored - ALWAYS persistent)
 * @param {Object} app - Electron app object
 * @returns {string} Path where plugins should be npm installed
 */
export function getPluginInstallPath(app) {
    // ALWAYS use data root for installation (dev-data in dev, app data in prod)
    const installPath = getProductionPluginPath(app);
    console.log(`[PluginPaths] Plugin install path: ${installPath}`);
    return installPath;
}


/**
 * Get all plugin path information for debugging
 * @param {Object} app - Electron app object
 * @returns {Object} Plugin path information
 */
export function getPluginPathInfo(app) {
    const isDev = isDevelopmentMode();
    const installPath = getPluginInstallPath(app);
    const libraryScanPath = getPluginLibraryScanPath(app);
    const prodPath = getProductionPluginPath(app);
    const devPath = getDevelopmentPluginPath();

    return {
        environment: isDev ? 'development' : 'production',
        currentPath: installPath, // Install path is the main path
        libraryScanPath: libraryScanPath, // Where we scan for marketplace augmentation
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
    // Handle data root
    if (name === 'dataRoot') {
        return getDataRoot(app);
    }

    // Handle plugin-specific path requests
    if (name === 'plugins' || name === 'pluginsDir') {
        // For npm install operations, use install path (persistent)
        return getPluginInstallPath(app);
    }

    if (name === 'pluginLibraryScan') {
        // For marketplace scanning, use library scan path
        return getPluginLibraryScanPath(app);
    }

    // Delegate to Electron's getPath for standard paths
    return app.getPath(name || 'appData');
}

export default {
    isDevelopmentMode,
    getDataRoot,
    getProductionPluginPath,
    getDevelopmentPluginPath,
    getPluginLibraryScanPath,
    getPluginInstallPath,
    getPluginPathInfo,
    getPathByName
};
