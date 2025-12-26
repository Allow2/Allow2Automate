# Firebase Analytics Integration

## Overview

Firebase Analytics integration for Allow2Automate with comprehensive environment detection and build tagging.

## Features

- **Environment Detection**: Automatically detects Mac App Store, Windows Store, Snap, development, and custom builds
- **Git Metadata Capture**: In development mode, captures repository, commit, and branch information
- **Build Metadata Injection**: Supports CI/CD environment variables for build tracking
- **User Context**: Sets user ID after Allow2 login
- **Platform Tagging**: Automatically tags events with platform, architecture, and distribution channel

## Environment Detection

The system automatically detects:

- **Mac App Store**: `process.mas === true`
- **Windows Store**: `process.windowsStore === true`
- **Snap Package**: `process.env.SNAP` is set
- **Development**: `NODE_ENV === 'development'` or running from source
- **Custom Build**: Any other production build

## Usage

### Main Process (app/main.js)

```javascript
const { initializeMainProcess } = require('./analytics/firebase-config');

// Initialize during app startup
app.on('ready', () => {
  const firebaseMain = initializeMainProcess(app);

  // Main process events (logged to console, actual analytics in renderer)
  firebaseMain.logMainEvent('app_ready', {
    startup_time: Date.now() - startTime
  });
});
```

### Renderer Process (app/components/Login.js or similar)

```javascript
const {
  initializeRendererProcess,
  setAnalyticsUserId,
  logAnalyticsEvent
} = require('../analytics/firebase-config');

// Initialize in your root component
componentDidMount() {
  const firebase = initializeRendererProcess();
  if (firebase) {
    console.log('Firebase Analytics ready:', firebase.environmentTags);
  }
}

// After successful login
handleLoginSuccess(userData) {
  setAnalyticsUserId(userData.userId);

  logAnalyticsEvent('login_complete', {
    user_type: userData.role,
    has_children: userData.children.length > 0
  });
}

// Track other events
handlePluginInstall(pluginName) {
  logAnalyticsEvent('plugin_install', {
    plugin_name: pluginName,
    install_method: 'marketplace'
  });
}
```

## CI/CD Build Metadata Injection

Add these environment variables during your build process:

```bash
# In your CI/CD pipeline (e.g., GitHub Actions, Jenkins)
export CI_BUILD_NUMBER="${BUILD_NUMBER}"
export CI_COMMIT_SHA="${COMMIT_SHA}"
export CI_BRANCH="${BRANCH_NAME}"
export BUILD_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# These will be automatically captured in environment tags
npm run pack
```

## Environment Tags Structure

```javascript
{
  platform: 'darwin',              // Process platform
  arch: 'x64',                     // Process architecture
  nodeVersion: 'v16.x.x',          // Node.js version
  electronVersion: '25.0.0',       // Electron version
  buildType: 'production',         // 'production' or 'development'
  distributionChannel: 'mac-app-store', // Distribution channel
  isDevelopment: false,            // Is development build
  isStoreDistribution: true,       // Is from app store

  // Development builds only
  gitMetadata: {
    repo: 'https://github.com/Allow2/Allow2Automate',
    commit: 'abc123...',
    commitShort: 'abc123',
    branch: 'master'
  },

  // CI/CD builds (if env vars set)
  ciBuildNumber: '123',
  ciCommitSha: 'abc123...',
  ciBranch: 'master',
  buildTimestamp: '2025-12-25T23:54:32Z'
}
```

## Events to Track

Recommended events to implement:

- `app_open` - App launched (automatic)
- `login` - User logged in (automatic when setAnalyticsUserId called)
- `plugin_install` - Plugin installed
- `plugin_uninstall` - Plugin removed
- `device_paired` - Device paired with Allow2
- `automation_triggered` - Automation rule executed
- `error_occurred` - Error encountered
- `settings_changed` - Settings modified

## Security Notes

- Firebase config is public (client-side app)
- No sensitive data should be logged
- User IDs are Allow2 user IDs (not PII)
- All events are subject to Firebase Analytics data retention policies

## Testing

In development mode:
1. Check console for environment detection logs
2. Verify git metadata is captured
3. Test event logging in browser DevTools (Application > Firebase)

## Firebase Console

View analytics data at:
https://console.firebase.google.com/project/allow2-1179/analytics
