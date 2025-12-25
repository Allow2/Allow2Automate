/**
 * Plugin Path Resolution Test Script
 *
 * Tests the environment-aware plugin path resolution system.
 * Can be run in both development and production modes.
 *
 * Usage:
 *   NODE_ENV=development node app/test-plugin-paths.js
 *   NODE_ENV=production node app/test-plugin-paths.js
 */

const path = require('path');
const os = require('os');

// Mock Electron app object for testing
const mockApp = {
    getPath: (name) => {
        const paths = {
            'home': os.homedir(),
            'appData': process.platform === 'darwin'
                ? path.join(os.homedir(), 'Library', 'Application Support')
                : process.platform === 'win32'
                    ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
                    : path.join(os.homedir(), '.config'),
            'userData': process.platform === 'darwin'
                ? path.join(os.homedir(), 'Library', 'Application Support', 'allow2automate')
                : process.platform === 'win32'
                    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'allow2automate')
                    : path.join(os.homedir(), '.config', 'allow2automate')
        };
        return paths[name] || paths.appData;
    }
};

// Import plugin path utilities (using require for CommonJS compatibility)
const pluginPaths = require('./pluginPaths');

console.log('========================================');
console.log('PLUGIN PATH RESOLUTION TEST');
console.log('========================================\n');

// Test environment detection
console.log('1. Environment Detection:');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('   Platform:', os.platform());
console.log('   Detected as development?', pluginPaths.isDevelopmentMode());
console.log();

// Test path resolution
console.log('2. Plugin Paths:');
const devPath = pluginPaths.getDevelopmentPluginPath();
const prodPath = pluginPaths.getProductionPluginPath(mockApp);
const currentPath = pluginPaths.getPluginPath(mockApp);

console.log('   Development path:', devPath);
console.log('   Production path:', prodPath);
console.log('   Current active path:', currentPath);
console.log('   Match expected?', currentPath === (pluginPaths.isDevelopmentMode() ? devPath : prodPath) ? '✓ YES' : '✗ NO');
console.log();

// Test full path info
console.log('3. Complete Path Information:');
const pathInfo = pluginPaths.getPluginPathInfo(mockApp);
console.log('   Environment:', pathInfo.environment);
console.log('   Platform:', pathInfo.platform);
console.log('   Current path:', pathInfo.currentPath);
console.log('   Production path:', pathInfo.productionPath);
console.log('   Development path:', pathInfo.developmentPath);
console.log();

// Test getPathByName function
console.log('4. Legacy Path Resolution:');
console.log('   getPath("appData"):', pluginPaths.getPathByName(mockApp, 'appData'));
console.log('   getPath("plugins"):', pluginPaths.getPathByName(mockApp, 'plugins'));
console.log('   getPath("pluginsDir"):', pluginPaths.getPathByName(mockApp, 'pluginsDir'));
console.log();

// Test path existence (info only, doesn't create)
console.log('5. Path Verification:');
const fs = require('fs');
console.log('   Current path exists?', fs.existsSync(currentPath) ? '✓ YES' : '✗ NO (will be created on first use)');
console.log('   Dev path exists?', fs.existsSync(devPath) ? '✓ YES' : '✗ NO (will be created on first use)');
console.log('   Production path exists?', fs.existsSync(prodPath) ? '✓ YES' : '✗ NO (normal for fresh install)');
console.log();

console.log('========================================');
console.log('TEST SUMMARY');
console.log('========================================');
console.log('Environment:', pluginPaths.isDevelopmentMode() ? 'DEVELOPMENT' : 'PRODUCTION');
console.log('Active plugin path:', currentPath);
console.log('Path separation working:', devPath !== prodPath ? '✓ YES' : '✗ NO');
console.log('========================================\n');

// Exit with appropriate code
process.exit(0);
