/**
 * Environment Detection Module
 * Safe for both main and renderer processes
 */

const { execSync } = require('child_process');

// Detect process type
const isRenderer = typeof window !== 'undefined';
const electron = require('electron');
let app;
let appPath;
let isPackaged;

// Main process - direct access to app
if (!isRenderer) {
  app = electron.app;
  appPath = app.getAppPath();
  isPackaged = app.isPackaged;
} else {
  // Renderer process - use IPC to get app info
  const ipcRenderer = electron.ipcRenderer;

  if (ipcRenderer) {
    appPath = ipcRenderer.sendSync('getPath', 'userData');
    if (!appPath || typeof appPath !== 'string') {
      appPath = process.cwd();
    }
    isPackaged = typeof appPath === 'string' ? !appPath.includes('node_modules') : false;
  } else {
    console.warn('[Environment] ipcRenderer not available');
    appPath = process.cwd();
    isPackaged = false;
  }
}

/**
 * Get application source tag for analytics
 */
function getAppSourceTag() {
  const version = getVersion();

  // Check if running in official store
  if (isPackaged) {
    if (process.mas) {
      return { type: 'mac-app-store', version };
    }
    if (process.windowsStore) {
      return { type: 'microsoft-store', version };
    }
    if (process.env.SNAP) {
      return { type: 'snap-store', version };
    }
    return { type: 'official-build', version };
  }

  // Development build
  try {
    const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      cwd: appPath
    }).trim();

    const gitCommit = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      cwd: appPath
    }).trim();

    return {
      type: 'development',
      version,
      git_branch: gitBranch,
      git_commit: gitCommit
    };
  } catch (err) {
    return { type: 'development', version };
  }
}

/**
 * Get build information
 */
function getBuildInfo() {
  const version = getVersion();
  const timestamp = new Date().toISOString();

  return {
    version,
    isOfficialBuild: isPackaged,
    buildNumber: process.env.BUILD_NUMBER || 'dev',
    timestamp
  };
}

/**
 * Get app version
 */
function getVersion() {
  try {
    const packageJson = require(isRenderer ? '../../package.json' : '../package.json');
    return packageJson.version || '2.0.0';
  } catch (err) {
    return '2.0.0';
  }
}

module.exports = {
  getAppSourceTag,
  getBuildInfo,
  isRenderer
};
