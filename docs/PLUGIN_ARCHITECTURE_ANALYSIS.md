# Allow2Automate Core Plugin Architecture Analysis

**Analysis Date:** 2025-12-28
**Framework Version:** 2.0.0
**Analyzed By:** Core Framework Analysis Agent

---

## Executive Summary

This document provides a comprehensive analysis of the Allow2Automate plugin architecture, defining the contract that all plugins must implement. This analysis is based on examination of the core framework code, existing plugins (battle.net, wemo, cmd, ssh), and the plugin registry system.

---

## 1. Plugin Structure Overview

### 1.1 Package Structure

All plugins must follow this structure:

```
@namespace/plugin-name/
├── package.json          # Plugin metadata and dependencies
├── dist/
│   ├── index.js         # Main CommonJS bundle (required)
│   └── index.es.js      # ES Module bundle (optional)
├── src/
│   ├── index.js         # Main entry point
│   ├── Components/
│   │   └── TabContent.jsx  # UI component (React)
│   └── [additional modules]
└── README.md
```

### 1.2 Key Files

- **package.json**: Must include `allow2automate` metadata section
- **dist/index.js**: Built output, referenced by `main` field in package.json
- **src/index.js**: Source file that exports `plugin` function and `TabContent` component

---

## 2. Package.json Requirements

### 2.1 Required Fields

```json
{
  "name": "@namespace/allow2automate-pluginname",
  "shortName": "pluginname",
  "version": "1.0.0",
  "description": "Plugin description",
  "main": "dist/index.js",
  "module": "dist/index.es.js",
  "keywords": ["allow2automate", "..."],
  "author": {
    "name": "Author Name",
    "url": "https://..."
  },
  "license": "MIT"
}
```

### 2.2 Allow2Automate Metadata Section

**Required section in package.json:**

```json
{
  "allow2automate": {
    "plugin": true,
    "pluginId": "allow2automate-pluginname",
    "displayName": "Human Readable Name",
    "category": "Gaming|IoT|Automation|Utility",
    "permissions": [
      "network",
      "configuration",
      "system",
      "filesystem"
    ],
    "minAppVersion": "2.0.0",
    "api": {
      "actions": [
        {
          "id": "actionId",
          "name": "Action Name",
          "description": "Action description"
        }
      ],
      "triggers": [
        {
          "id": "triggerId",
          "name": "Trigger Name",
          "description": "Trigger description"
        }
      ]
    }
  }
}
```

### 2.3 Dependency Management

**CRITICAL COMPLIANCE RULES:**

#### Must Use peerDependencies (NOT dependencies):
- `react` (^16.0.0 || ^17.0.0)
- `react-dom` (^16.0.0 || ^17.0.0)
- `@material-ui/core` (^4.0.0)
- `@material-ui/icons` (^4.0.0)
- `@material-ui/lab` (^4.0.0)

#### Rationale:
The host application provides these dependencies via module path injection. Including them in `dependencies` causes:
- Duplicate React instances (React errors)
- Version conflicts
- Bloated plugin size
- Bundle errors

#### Example Correct Configuration:

```json
{
  "dependencies": {
    "@babel/runtime": "^7.13.9",
    "axios": "^0.27.2",
    "plugin-specific-library": "^1.0.0"
  },
  "peerDependencies": {
    "react": "^16.0.0 || ^17.0.0",
    "react-dom": "^16.0.0 || ^17.0.0",
    "@material-ui/core": "^4.0.0",
    "@material-ui/icons": "^4.0.0"
  }
}
```

---

## 3. Plugin Entry Point (src/index.js)

### 3.1 Required Exports

```javascript
import TabContent from './Components/TabContent';

// Main plugin factory function
function plugin(context) {
    const pluginInstance = {};

    // Lifecycle methods (see section 4)
    pluginInstance.onLoad = function(state) { /* ... */ };
    pluginInstance.newState = function(newState) { /* ... */ };
    pluginInstance.onSetEnabled = function(enabled) { /* ... */ };
    pluginInstance.onUnload = function(callback) { /* ... */ };

    return pluginInstance;
}

// Export both plugin factory and UI component
module.exports = {
    plugin,
    TabContent
};
```

---

## 4. Plugin Lifecycle Methods

### 4.1 onLoad (Optional but Recommended)

**Called when plugin is first loaded by the framework**

```javascript
pluginInstance.onLoad = function(loadState) {
    console.log('Plugin loaded with state:', loadState);

    // loadState contains persisted configuration
    // Initialize plugin services, managers, monitors
    // Set up IPC handlers
    // Load saved configuration
};
```

**Parameters:**
- `loadState`: Object containing persisted plugin state/configuration

**Use Cases:**
- Initialize plugin services
- Set up IPC communication handlers
- Start background monitoring/polling
- Load saved configuration

### 4.2 newState (Optional)

**Called when persisted state is updated**

```javascript
pluginInstance.newState = function(newState) {
    console.log('State updated:', newState);

    // Update internal state
    // Reconfigure services based on new state
    // Notify components of state changes
};
```

**Parameters:**
- `newState`: Updated state object

### 4.3 onSetEnabled (Optional)

**Called when plugin is enabled/disabled by user**

```javascript
pluginInstance.onSetEnabled = function(enabled) {
    if (enabled) {
        // Start services, monitoring, polling
    } else {
        // Stop services, cleanup resources
    }
};
```

**Parameters:**
- `enabled`: Boolean indicating if plugin is enabled

### 4.4 onUnload (Optional but Recommended)

**Called when plugin is being uninstalled/removed**

```javascript
pluginInstance.onUnload = function(callback) {
    // Cleanup resources
    // Stop services
    // Close connections
    // Remove IPC handlers

    callback(null); // Signal completion
};
```

**Parameters:**
- `callback`: Function to call when cleanup is complete

---

## 5. Context Object (Provided to Plugin)

The `context` object passed to the `plugin()` factory provides:

### 5.1 Main Process Context

```javascript
context = {
    isMain: true,

    // IPC Communication (scoped to plugin)
    ipcMain: {
        send: (channel, ...args) => {},
        on: (channel, listener) => {},
        invoke: async (channel, ...args) => {},
        handle: (channel, handler) => {}
    },

    // Configuration Management
    configurationUpdate: function(newConfig) {
        // Persist plugin configuration
        // Triggers newState callback
    },

    // Status Reporting
    statusUpdate: function(statusData) {
        // Report plugin status to framework
        // statusData: { status, message, timestamp, details }
    }
};
```

### 5.2 IPC Channel Scoping

**IMPORTANT:** All IPC channels are automatically scoped to plugin name:

```javascript
// Plugin code:
context.ipcMain.handle('myChannel', handler);

// Actual channel: 'pluginName.myChannel'
```

This prevents conflicts between plugins.

### 5.3 Status Management

**Valid status values:**
- `'unconfigured'` - Plugin needs configuration
- `'configured'` - Plugin configured but not connected
- `'connected'` - Plugin active and operational
- `'disconnected'` - Plugin lost connection
- `'error'` - Plugin encountered error
- `'warning'` - Plugin has non-critical issue

**Example:**

```javascript
context.statusUpdate({
    status: 'connected',
    message: 'Connected to Battle.net parental controls',
    timestamp: Date.now(),
    details: {
        childrenCount: 2,
        lastSync: new Date().toISOString()
    }
});
```

---

## 6. IPC Communication Patterns

### 6.1 Main Process Handlers

```javascript
// Setup in plugin's onLoad
context.ipcMain.handle('getDevices', async (event, params) => {
    try {
        const devices = await discoverDevices(params);
        return [null, devices]; // [error, result]
    } catch (error) {
        return [error]; // [error]
    }
});

context.ipcMain.handle('updateConfig', async (event, config) => {
    try {
        // Save configuration
        context.configurationUpdate(config);
        return [null, { success: true }];
    } catch (error) {
        return [error];
    }
});
```

### 6.2 Main Process Events (to Renderer)

```javascript
// Send events to renderer process
context.sendToRenderer('deviceDiscovered', {
    deviceId: '123',
    name: 'Device Name',
    type: 'switch'
});
```

---

## 7. TabContent Component (Renderer Process)

### 7.1 Component Props

The `TabContent` component receives these props:

```javascript
class TabContent extends Component {
    render() {
        const {
            plugin,              // Plugin metadata
            data,                // Plugin data/children assignments
            children,            // Child user data from Allow2
            user,                // Current user data from Allow2
            pluginPath,          // Path to plugin directory

            // IPC Communication (scoped)
            ipcRenderer: {
                send: (channel, ...args) => {},
                on: (channel, listener) => {},
                invoke: async (channel, ...args) => {},
                handle: (channel, handler) => {}
            },

            // Configuration Management
            configurationUpdate: function(newConfig) {},

            // Status Reporting
            statusUpdate: function(statusData) {},

            // Data Persistence (backward compatibility)
            persist: function(key, value) {},

            // Child Assignment
            assign: function(device, token) {},

            // Utilities
            allow2: {
                avatarURL: function(user, child) {}
            }
        } = this.props;

        return <div>Plugin UI</div>;
    }
}
```

### 7.2 IPC Communication from Renderer

```javascript
// Call main process handler
async componentDidMount() {
    const [err, devices] = await this.props.ipcRenderer.invoke('getDevices', params);
    if (err) {
        console.error('Error:', err);
        return;
    }

    this.setState({ devices });
}

// Listen for events from main process
componentDidMount() {
    this.props.ipcRenderer.on('deviceDiscovered', (event, device) => {
        console.log('Device discovered:', device);
    });
}
```

### 7.3 Status Updates from UI

```javascript
handleConnect = async () => {
    this.props.statusUpdate({
        status: 'connected',
        message: 'Successfully connected to service',
        details: { lastConnect: new Date() }
    });
};

handleError = (error) => {
    this.props.statusUpdate({
        status: 'error',
        message: error.message,
        details: { errorCode: error.code }
    });
};
```

---

## 8. Configuration Management

### 8.1 Plugin Configuration Pattern

```javascript
// Main Process - Update configuration
context.configurationUpdate({
    devices: [...],
    settings: {...},
    lastUpdated: Date.now()
});

// Configuration is:
// 1. Persisted to disk
// 2. Triggers newState() callback
// 3. Available in loadState on next load
```

### 8.2 Configuration Structure

```javascript
{
    // Plugin-specific configuration
    devices: [],
    settings: {},

    // Child assignments (optional)
    assignments: {
        'childId': {
            deviceId: 'device-123',
            settings: {}
        }
    }
}
```

---

## 9. Plugin Installation & Registry

### 9.1 Plugin Discovery

Plugins are discovered from:

1. **GitHub Registry** (production)
   - URL: `https://raw.githubusercontent.com/Allow2/allow2automate-registry/master/plugins.json`
   - Cache TTL: 1 hour
   - Fallback to cache on network failure

2. **Namespace Directories** (local)
   - `registry/plugins/@namespace/plugin.json`
   - Override master registry

3. **Dev-Plugins Directory** (development mode)
   - `dev-plugins/plugin-directory/`
   - Loaded from package.json
   - Override registry

### 9.2 Plugin Installation Locations

**Production:**
- macOS: `~/Library/Application Support/allow2automate/plugins`
- Windows: `%APPDATA%/allow2automate/plugins`
- Linux: `~/.config/allow2automate/plugins`

**Development:**
- `<project-root>/dev-plugins`

### 9.3 Development Mode Detection

Development mode is active when:
- `process.env.NODE_ENV === 'development'`
- Running from source (not packaged)
- Electron CLI detected

---

## 10. Module Path Injection

### 10.1 Shared Dependencies

The framework injects module paths for shared dependencies:

```javascript
// Automatically added to all loaded modules
module.paths.push('/path/to/host/node_modules');
module.paths.push('/path/to/react');
module.paths.push('/path/to/@material-ui');
module.paths.push('/path/to/redux');
module.paths.push('/path/to/react-redux');
```

### 10.2 Available to Plugins

Plugins can import these without bundling:
- React
- ReactDOM
- @material-ui/core
- @material-ui/icons
- @material-ui/lab
- Redux
- React-Redux

---

## 11. Build Configuration

### 11.1 Rollup Configuration

Plugins should use Rollup for building:

```javascript
// rollup.config.js
import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

export default {
    input: 'src/index.js',
    output: [
        {
            file: 'dist/index.js',
            format: 'cjs',
            exports: 'auto'
        },
        {
            file: 'dist/index.es.js',
            format: 'es'
        }
    ],
    plugins: [
        peerDepsExternal(), // Externalize peer dependencies
        resolve(),
        commonjs(),
        babel({
            babelHelpers: 'runtime',
            exclude: 'node_modules/**'
        })
    ],
    external: [
        'react',
        'react-dom',
        '@material-ui/core',
        '@material-ui/icons',
        '@material-ui/lab'
    ]
};
```

### 11.2 Babel Configuration

```json
{
  "presets": [
    "@babel/preset-env",
    "@babel/preset-react"
  ],
  "plugins": [
    "@babel/plugin-transform-runtime",
    "@babel/plugin-proposal-class-properties"
  ]
}
```

---

## 12. Common Utilities Available

### 12.1 Allow2 API Utilities

```javascript
import { allow2Login, allow2Request, allow2AvatarURL } from '../util';

// Login to Allow2
allow2Login(
    { email, pass },
    onError,
    onSuccess
);

// Make API request
allow2Request(
    '/path',
    { method: 'POST', body: {...} },
    onError,
    onSuccess
);

// Get avatar URL
const avatarUrl = allow2AvatarURL(user, child);
```

---

## 13. Plugin Testing

### 13.1 Development Testing

1. Place plugin in `dev-plugins/` directory
2. Ensure `NODE_ENV=development`
3. Plugin will be auto-discovered
4. Build with `npm run build` or `npm start` (watch mode)

### 13.2 Test Script

```json
{
  "scripts": {
    "build": "rollup -c",
    "start": "rollup -c -w",
    "test": "react-scripts test --env=jsdom"
  }
}
```

---

## 14. Best Practices

### 14.1 Plugin Development

1. **Always use peerDependencies** for React, Material-UI
2. **Use IPC scoping** - channels are auto-prefixed
3. **Update status** - keep framework informed of plugin state
4. **Cleanup on unload** - implement onUnload for resource cleanup
5. **Error handling** - always use try-catch and report errors
6. **Configuration persistence** - use configurationUpdate()

### 14.2 UI Components

1. **Use Material-UI** for consistent styling
2. **Handle loading states** - show progress indicators
3. **Error feedback** - use Snackbar/Alert for user feedback
4. **Responsive design** - support different window sizes

### 14.3 Performance

1. **Lazy loading** - load resources when needed
2. **Debounce updates** - avoid excessive IPC calls
3. **Clean listeners** - remove IPC listeners on unmount
4. **Optimize bundles** - externalize peer dependencies

---

## 15. Plugin Contract Summary

### 15.1 Required

✅ **Package.json:**
- `name`, `version`, `description`, `main`
- `allow2automate` metadata section
- `peerDependencies` (NOT dependencies) for React/Material-UI

✅ **Exports:**
- `plugin` factory function
- `TabContent` React component

✅ **Build Output:**
- `dist/index.js` (CommonJS)

### 15.2 Recommended

⭐ **Lifecycle Methods:**
- `onLoad` - Initialize plugin
- `onUnload` - Cleanup resources

⭐ **Status Management:**
- Report status changes via `statusUpdate()`

⭐ **IPC Communication:**
- Use scoped IPC for main/renderer communication

### 15.3 Optional

📌 **Lifecycle Methods:**
- `newState` - Handle configuration updates
- `onSetEnabled` - Handle enable/disable

📌 **Advanced Features:**
- Background monitoring/polling
- External API integration
- Device discovery
- Child assignment

---

## 16. Battle.net Plugin Requirements

Based on this analysis, the Battle.net plugin must implement:

### 16.1 Core Requirements

1. **Package Structure**
   - Follow standard plugin structure
   - Use peerDependencies correctly
   - Include allow2automate metadata

2. **Lifecycle Methods**
   - `onLoad` - Initialize Battle.net API client
   - `onSetEnabled` - Start/stop quota monitoring
   - `onUnload` - Cleanup connections

3. **IPC Handlers**
   - `getChildren` - Fetch Battle.net children
   - `updateQuota` - Update time quotas
   - `testConnection` - Test API connectivity
   - `saveConfig` - Persist configuration

4. **Status Management**
   - Report connection status
   - Report quota sync status
   - Report errors/warnings

5. **UI Component**
   - Configuration form (API key, child selection)
   - Status display (connection, last sync)
   - Manual sync button
   - Child assignment interface

### 16.2 Battle.net Specific

1. **API Integration**
   - Session ID management
   - Quota fetching via GET requests
   - Quota updating via POST requests
   - Error handling for API failures

2. **State Management**
   - Store API credentials
   - Cache child data
   - Track quota sync timestamps
   - Persist child assignments

3. **Monitoring**
   - Poll Battle.net API periodically
   - Sync quotas with Allow2
   - Handle quota exceeded scenarios
   - Report status changes

---

## Appendix A: Example Plugin (Minimal)

```javascript
// src/index.js
import React, { Component } from 'react';
import Button from '@material-ui/core/Button';

class TabContent extends Component {
    render() {
        return (
            <div>
                <h2>My Plugin</h2>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => this.props.statusUpdate({
                        status: 'connected',
                        message: 'Plugin active'
                    })}
                >
                    Activate
                </Button>
            </div>
        );
    }
}

function plugin(context) {
    const instance = {};

    instance.onLoad = function(state) {
        console.log('Plugin loaded:', state);
        context.statusUpdate({
            status: 'configured',
            message: 'Plugin ready'
        });
    };

    return instance;
}

module.exports = { plugin, TabContent };
```

---

## Appendix B: File Locations Reference

### Framework Files
- `/mnt/ai/automate/automate/package.json` - Main app config
- `/mnt/ai/automate/automate/app/plugins.js` - Plugin loader
- `/mnt/ai/automate/automate/app/pluginPaths.js` - Path resolution
- `/mnt/ai/automate/automate/app/registry.js` - Registry loader
- `/mnt/ai/automate/automate/app/actions/pluginStatus.js` - Status actions
- `/mnt/ai/automate/automate/app/components/Plugin.js` - Plugin UI wrapper

### Example Plugins
- `/mnt/ai/automate/automate/dev-plugins/node_modules/@allow2/allow2automate-wemo/`
- `/mnt/ai/automate/automate/dev-plugins/node_modules/@allow2/allow2automate-cmd/`
- `/mnt/ai/automate/automate/dev-plugins/node_modules/@allow2/allow2automate-ssh/`
- `/mnt/ai/automate/automate/dev-plugins/allow2automate-cmd/` (development)

---

**End of Analysis**

This document defines the complete contract for Battle.net plugin development.
