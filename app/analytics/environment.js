/**
 * Environment Detection
 * Safe to use in both main and renderer processes
 */

const { execSync } = require('child_process');
const electron = require('electron');

// Determine if we're in main or renderer process
const isRenderer = typeof window !== 'undefined';

// Get app object safely in both main and renderer processes
let app;
let appVersion;
let appPath;
let isPackaged;

if (!isRenderer) {
  // Main process - direct access to app
  app = electron.app;
  appVersion = app.getVersion();
  appPath = app.getAppPath();
  isPackaged = app.isPackaged;
} else {
  // Renderer process - use IPC or preload API
  // Fix: Don't destructure - ipcRenderer is null in main process
  const ipcRenderer = electron.ipcRenderer;

  // Get version - try multiple methods
  try {
    // Method 1: Try to read from package.json in app root
    const pkg = require('../package.json');
    appVersion = pkg.version || '2.0.0';
  } catch (e) {
    try {
      // Method 2: Try via userData path
      const userDataPath = ipcRenderer.sendSync('getPath', 'userData');
      if (userDataPath && typeof userDataPath === 'string') {
        const path = require('path');
        const appPath = path.join(userDataPath, '..', '..', 'package.json');
        const pkg = require(appPath);
        appVersion = pkg.version || '2.0.0';
      } else {
        appVersion = '2.0.0';
      }
    } catch (e2) {
      appVersion = '2.0.0';
    }
  }

  // Get app path via IPC
  try {
    appPath = ipcRenderer.sendSync('getPath', 'userData');
    if (!appPath || typeof appPath !== 'string') {
      appPath = process.cwd();
    }
  } catch (e) {
    appPath = process.cwd();
  }

  // Detect if packaged (simple heuristic for renderer)
  isPackaged = typeof appPath === 'string' ? !appPath.includes('node_modules') : false;

  // Create app-like object for consistent API
  app = {
    getVersion: () => appVersion,
    getAppPath: () => appPath,
    isPackaged: isPackaged
  };
}

/**
 * Environment detection function
 * Determines app source (official store, development, custom build)
 */
function getAppSourceTag() {
  // Check for official build environment variables
  if (process.env.OFFICIAL_BUILD === 'true') {
    return {
      type: 'official',
      platform: process.env.STORE_PLATFORM || 'unknown',
      storeId: process.env.STORE_ID || 'unknown',
      version: app.getVersion()
    };
  }

  // Runtime store detection
  if (process.mas) return { type: 'official', platform: 'mac-app-store', version: app.getVersion() };
  if (process.windowsStore) return { type: 'official', platform: 'microsoft-store', version: app.getVersion() };
  if (process.env.SNAP) return { type: 'official', platform: 'snap-store', version: app.getVersion() };

  // Development mode
  if (!app.isPackaged || process.env.NODE_ENV === 'development') {
    try {
      return {
        type: 'development',
        git: {
          repo: execSync('git config --get remote.origin.url').toString().trim(),
          commit: execSync('git rev-parse --short HEAD').toString().trim(),
          branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
        },
        version: app.getVersion()
      };
    } catch (e) {
      return { type: 'development', version: app.getVersion() };
    }
  }

  // Custom build
  return {
    type: 'custom-build',
    installPath: app.getAppPath(),
    version: app.getVersion()
  };
}

/**
 * Get build information
 */
function getBuildInfo() {
  return {
    timestamp: process.env.BUILD_TIMESTAMP || new Date().toISOString(),
    version: app.getVersion(),
    isOfficialBuild: process.env.OFFICIAL_BUILD === 'true',
    buildNumber: process.env.BUILD_NUMBER || 'dev'
  };
}

module.exports = { getAppSourceTag, getBuildInfo };
