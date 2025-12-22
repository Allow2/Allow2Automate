# Allow2Automate Plugin Developer Guide

> **A comprehensive guide to creating, testing, and publishing Allow2Automate plugins**

**Version:** 2.0.0
**Last Updated:** December 2025
**Target Audience:** JavaScript developers with basic Electron/Node.js knowledge

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Plugin Structure](#3-plugin-structure)
4. [package.json Requirements](#4-packagejson-requirements)
5. [Plugin API](#5-plugin-api)
6. [Configuration UI](#6-configuration-ui)
7. [Allow2 Integration](#7-allow2-integration)
8. [Security Best Practices](#8-security-best-practices)
9. [Testing Your Plugin](#9-testing-your-plugin)
10. [Publishing Your Plugin](#10-publishing-your-plugin)
11. [Example: PlayStation Plugin](#11-example-playstation-plugin)
12. [Troubleshooting](#12-troubleshooting)
13. [Best Practices](#13-best-practices)
14. [Plugin Registry Submission](#14-plugin-registry-submission)

---

## 1. Introduction

### What are Allow2Automate Plugins?

Allow2Automate plugins extend the platform's ability to control and manage devices, services, and applications through the Allow2 parental control system. Plugins enable integration with third-party services like:

- Gaming platforms (PlayStation, Xbox, Battle.net)
- Smart home devices (Wemo, Philips Hue)
- Network devices (routers, firewalls via SSH)
- Streaming services (Netflix, YouTube)
- Any device or service with an API

### Use Cases and Examples

**Example 1: PlayStation Integration**
- Monitor play time across PlayStation Network accounts
- Enforce time limits based on Allow2 quotas
- Block/unblock access when quotas are exceeded
- Report usage back to Allow2 for tracking

**Example 2: SSH Router Control**
- SSH into home router when internet quota is reached
- Execute scripts to enable/disable firewall rules
- Automatically restore access when quota renews
- Support multiple children with different quotas

**Example 3: Battle.net Parental Controls**
- Scrape and update Battle.net parental control settings
- Synchronize with Allow2 quotas
- Handle authentication and session management
- Report game time to Allow2

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Allow2Automate Application                  │
│  ┌───────────────────────────────────────────────────┐  │
│  │           Main Process (Electron)                  │  │
│  │  • Plugin Loader (electron-plugin-manager)        │  │
│  │  • IPC Communication Handler                      │  │
│  │  • Configuration Storage (electron-settings)      │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │         Renderer Process (React/Redux)            │  │
│  │  • Plugin Configuration UI Components             │  │
│  │  • State Management (Redux)                       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                Your Plugin Package                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  index.js (Main Entry Point)                      │  │
│  │  • onLoad() - Called when plugin loads            │  │
│  │  • newState() - Called on state changes           │  │
│  │  • IPC handlers for configuration updates         │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  TabContent.js (Configuration UI - Optional)      │  │
│  │  • React component for plugin settings           │  │
│  │  • Material-UI components                         │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  package.json                                     │  │
│  │  • Metadata and dependencies                     │  │
│  │  • Allow2 token for API access                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Allow2 API Platform                     │
│  • Check quotas for children                            │
│  • Report usage (time, activities)                      │
│  • Receive real-time quota updates                      │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Getting Started

### Prerequisites

Before you begin plugin development, ensure you have:

1. **Node.js** (v14 or higher)
   ```bash
   node --version  # Should be v14.0.0 or higher
   ```

2. **npm** (comes with Node.js)
   ```bash
   npm --version
   ```

3. **Git** for version control
   ```bash
   git --version
   ```

4. **GitHub Account** for hosting your plugin

5. **Allow2 Developer Account**
   - Sign up at [https://developer.allow2.com/](https://developer.allow2.com/)
   - Create an app/device to get your API token

### Recommended Tools

- **Visual Studio Code** - Excellent JavaScript/TypeScript support
- **ESLint** - Code quality and consistency
- **Prettier** - Code formatting
- **Postman** - For testing API calls

### Understanding the Plugin Lifecycle

When your plugin is loaded by Allow2Automate, it goes through the following lifecycle:

1. **Discovery** - Plugin listed in marketplace/library
2. **Installation** - User installs via `electron-plugin-manager`
3. **Loading** - Plugin main module is `require()`'d
4. **Initialization** - `onLoad()` is called with initial state
5. **Active** - Plugin receives `newState()` calls on configuration changes
6. **Unload** - Plugin is disabled or removed (cleanup opportunity)

```javascript
// Lifecycle flow
Plugin Installed → require('your-plugin') → plugin({ ipcMain, configurationUpdate })
                                           → instance.onLoad(currentState)
                                           → instance.newState(newState) // on changes
```

---

## 3. Plugin Structure

### Required Files

Every Allow2Automate plugin must have at minimum:

```
allow2automate-myplugin/
├── package.json          # REQUIRED - Plugin metadata
├── index.js              # REQUIRED - Main entry point
└── README.md             # REQUIRED - Documentation
```

### Optional Files

For advanced plugins with configuration UI:

```
allow2automate-myplugin/
├── package.json          # Plugin metadata
├── index.js              # Main entry point (runs in main process)
├── TabContent.js         # Configuration UI (runs in renderer)
├── LICENSE               # License file (recommended)
├── README.md             # User-facing documentation
├── CHANGELOG.md          # Version history
└── lib/                  # Additional modules
    ├── api-client.js
    ├── quota-checker.js
    └── utils.js
```

### Folder Structure Best Practices

**Recommended structure for larger plugins:**

```
allow2automate-playstation/
├── package.json
├── README.md
├── LICENSE
├── CHANGELOG.md
├── index.js                    # Main entry point
├── TabContent.js               # Configuration UI
├── lib/
│   ├── psn-api.js             # PlayStation Network API client
│   ├── quota-manager.js       # Quota checking logic
│   ├── session-handler.js     # Auth session management
│   └── utils.js               # Helper functions
├── assets/
│   ├── icon.png               # Plugin icon (128x128)
│   └── logo.svg               # Plugin logo
└── test/
    ├── psn-api.test.js
    └── quota-manager.test.js
```

**Keep it simple for basic plugins:**

```
allow2automate-ssh/
├── package.json
├── README.md
├── index.js                    # All logic in one file
└── TabContent.js               # Simple config UI
```

---

## 4. package.json Requirements

### Required Fields

Your `package.json` must include these specific fields:

```json
{
  "name": "allow2automate-myplugin",
  "version": "1.0.0",
  "description": "Brief description of what your plugin does",
  "main": "index.js",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "allow2Token": "YOUR_ALLOW2_DEVICE_TOKEN_HERE",
  "engines": {
    "allow2automate": ">=2.0.0"
  },
  "keywords": [
    "allow2automate",
    "parental-controls",
    "your-service"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/allow2automate-myplugin"
  },
  "license": "MIT"
}
```

### Field Descriptions

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ Yes | Must start with `allow2automate-` |
| `version` | ✅ Yes | Semantic versioning (e.g., `1.0.0`) |
| `main` | ✅ Yes | Entry point file (usually `index.js`) |
| `allow2Token` | ✅ Yes | Your Allow2 API device token |
| `engines.allow2automate` | ✅ Yes | Compatible Allow2Automate versions |
| `description` | ✅ Yes | Short description (max 140 chars) |
| `keywords` | ✅ Yes | Must include `allow2automate` |
| `repository` | ✅ Yes | GitHub repository URL |
| `author` | ⚠️ Recommended | Your name and contact |
| `license` | ⚠️ Recommended | License type (MIT, ISC, etc.) |

### Naming Convention

**Plugin names MUST follow this pattern:**

```
allow2automate-[service-name]
```

**Good examples:**
- ✅ `allow2automate-playstation`
- ✅ `allow2automate-battle-net`
- ✅ `allow2automate-ssh`
- ✅ `allow2automate-wemo`

**Bad examples:**
- ❌ `playstation-allow2`
- ❌ `my-plugin`
- ❌ `allow2-playstation` (missing "automate")

### Keywords for Discoverability

Include relevant keywords to help users find your plugin:

```json
{
  "keywords": [
    "allow2automate",           // REQUIRED
    "parental-controls",        // Recommended
    "playstation",              // Your service
    "psn",                      // Related terms
    "gaming",                   // Category
    "time-management"           // Use case
  ]
}
```

### Example package.json with Annotations

```json
{
  "name": "allow2automate-playstation",
  "version": "1.0.0",
  "description": "Control PlayStation Network access with Allow2 parental controls",

  // Entry point - runs in Electron main process
  "main": "index.js",

  // Your Allow2 device token from https://developer.allow2.com/
  "allow2Token": "a1b2c3d4e5f6g7h8i9j0",

  // Specify compatible Allow2Automate versions
  "engines": {
    "allow2automate": ">=2.0.0",
    "node": ">=14.0.0"
  },

  "keywords": [
    "allow2automate",  // Required for discovery
    "playstation",
    "psn",
    "gaming",
    "parental-controls"
  ],

  "author": {
    "name": "John Developer",
    "email": "john@example.com",
    "url": "https://github.com/johndeveloper"
  },

  "repository": {
    "type": "git",
    "url": "https://github.com/johndeveloper/allow2automate-playstation"
  },

  "bugs": {
    "url": "https://github.com/johndeveloper/allow2automate-playstation/issues"
  },

  "homepage": "https://github.com/johndeveloper/allow2automate-playstation#readme",

  "license": "MIT",

  // Dependencies your plugin needs
  "dependencies": {
    "axios": "^0.27.0",
    "allow2": "^1.0.0"  // Allow2 SDK
  },

  // Development dependencies
  "devDependencies": {
    "eslint": "^8.0.0"
  }
}
```

---

## 5. Plugin API

### Available APIs

When your plugin is loaded, it receives an object with these APIs:

```javascript
module.exports = function(apis) {
  const { isMain, ipcMain, configurationUpdate } = apis;

  // Your plugin implementation
  return {
    onLoad: (currentState) => { /* ... */ },
    newState: (newState) => { /* ... */ }
  };
};
```

#### API Reference

| API | Type | Description |
|-----|------|-------------|
| `isMain` | boolean | Always `true` (runs in main process) |
| `ipcMain` | object | Scoped IPC for renderer ↔ main communication |
| `configurationUpdate` | function | Update plugin configuration |

### Lifecycle Hooks

#### onLoad(currentState)

Called once when the plugin is first loaded or when Allow2Automate starts.

```javascript
return {
  onLoad: (currentState) => {
    console.log('Plugin loaded with state:', currentState);

    // Initialize your plugin
    // - Set up timers
    // - Connect to external APIs
    // - Restore saved state

    if (currentState) {
      // Resume from previous state
      const { credentials, childId, settings } = currentState;
      // ... initialize with saved config
    }
  }
};
```

**Use onLoad to:**
- Initialize API clients
- Set up recurring checks (timers, intervals)
- Validate saved configuration
- Connect to external services

#### newState(newState)

Called whenever the plugin's configuration changes (user updates settings).

```javascript
return {
  newState: (newState) => {
    console.log('State updated:', newState);

    // React to configuration changes
    // - Update API credentials
    // - Change monitored child
    // - Adjust check intervals

    if (newState.enabled === false) {
      // Plugin was disabled - clean up
      clearInterval(checkTimer);
    } else {
      // Plugin was enabled or settings changed
      updateConfiguration(newState);
    }
  }
};
```

**Use newState to:**
- Apply new user settings
- Enable/disable functionality
- Switch monitored children
- Update API credentials

### IPC Communication Patterns

The `ipcMain` API is scoped to your plugin to prevent conflicts.

#### Pattern 1: Renderer → Main (One-way)

**In your TabContent.js (renderer):**
```javascript
ipcRenderer.send('save-settings', {
  username: 'user@example.com',
  password: 'encrypted_password'
});
```

**In your index.js (main):**
```javascript
module.exports = function({ ipcMain, configurationUpdate }) {
  ipcMain.on('save-settings', (event, settings) => {
    console.log('Received settings:', settings);

    // Update configuration
    configurationUpdate({
      credentials: settings,
      lastUpdated: Date.now()
    });
  });

  return { onLoad, newState };
};
```

#### Pattern 2: Renderer → Main → Response (Request/Response)

**In your TabContent.js (renderer):**
```javascript
// Modern async/await
const result = await ipcRenderer.invoke('check-credentials', credentials);
if (result.valid) {
  console.log('Credentials are valid!');
}
```

**In your index.js (main):**
```javascript
ipcMain.handle('check-credentials', async (event, credentials) => {
  try {
    const valid = await validateCredentials(credentials);
    return { valid, message: 'Success' };
  } catch (error) {
    return { valid: false, message: error.message };
  }
});
```

#### Pattern 3: Main → Renderer (Push Notifications)

**In your index.js (main):**
```javascript
// Send updates to the UI
ipcMain.send('quota-update', {
  childId: 123,
  remaining: 1800,  // 30 minutes in seconds
  type: 'internet'
});
```

**In your TabContent.js (renderer):**
```javascript
useEffect(() => {
  ipcRenderer.on('quota-update', (event, quota) => {
    console.log('Quota update:', quota);
    setRemainingTime(quota.remaining);
  });

  return () => {
    ipcRenderer.removeAllListeners('quota-update');
  };
}, []);
```

### Configuration Management

#### Updating Configuration

Use `configurationUpdate()` to save plugin settings:

```javascript
module.exports = function({ configurationUpdate }) {

  // Save configuration
  const saveConfig = (newConfig) => {
    configurationUpdate({
      ...currentConfig,
      ...newConfig,
      lastUpdated: new Date().toISOString()
    });
  };

  return {
    onLoad: (state) => {
      currentConfig = state || {};
    },
    newState: (state) => {
      currentConfig = state;
      // React to changes
    }
  };
};
```

#### Configuration Schema Example

```javascript
// Recommended configuration structure
const configSchema = {
  enabled: true,
  credentials: {
    username: 'user@example.com',
    apiKey: 'encrypted_key',
    sessionToken: null
  },
  childId: 123,  // Allow2 child ID
  settings: {
    checkInterval: 300000,  // 5 minutes in ms
    autoBlock: true,
    notifications: true
  },
  state: {
    lastCheck: '2025-01-15T10:30:00Z',
    lastQuota: 3600,
    isBlocked: false
  }
};
```

### Error Handling

Always implement robust error handling:

```javascript
module.exports = function({ ipcMain, configurationUpdate }) {

  const checkQuota = async (childId) => {
    try {
      const response = await allow2.check({
        childId: childId,
        activity: 3,  // Internet activity
        log: true
      });

      return response;

    } catch (error) {
      console.error('Quota check failed:', error);

      // Send error to UI
      ipcMain.send('quota-error', {
        message: error.message,
        code: error.code,
        timestamp: Date.now()
      });

      // Return safe default
      return { allowed: false, error: true };
    }
  };

  return {
    onLoad: (state) => {
      if (!state || !state.credentials) {
        console.warn('Plugin loaded without configuration');
        ipcMain.send('config-required', {
          message: 'Please configure the plugin'
        });
        return;
      }

      // Continue initialization
    }
  };
};
```

---

## 6. Configuration UI

### Creating React Configuration Components

Plugins can provide a custom UI for configuration using React and Material-UI.

#### Basic TabContent.js Template

```javascript
// TabContent.js - Runs in renderer process
import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Alert
} from '@material-ui/core';

const TabContent = ({
  data,                    // Current configuration
  configurationUpdate,     // Function to save config
  ipcRenderer              // IPC for communication
}) => {
  const [username, setUsername] = useState(data?.credentials?.username || '');
  const [password, setPassword] = useState('');
  const [childId, setChildId] = useState(data?.childId || '');
  const [message, setMessage] = useState(null);

  const handleSave = async () => {
    try {
      // Validate credentials via IPC
      const result = await ipcRenderer.invoke('validate-credentials', {
        username,
        password
      });

      if (result.valid) {
        // Save configuration
        configurationUpdate({
          credentials: {
            username,
            apiKey: result.apiKey  // Received from validation
          },
          childId: parseInt(childId),
          enabled: true
        });

        setMessage({ type: 'success', text: 'Settings saved!' });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  return (
    <Paper style={{ padding: 20 }}>
      <Typography variant="h5" gutterBottom>
        PlayStation Network Settings
      </Typography>

      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Box mt={3}>
        <TextField
          fullWidth
          label="PSN Email"
          type="email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          margin="normal"
        />

        <TextField
          fullWidth
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          margin="normal"
        />

        <TextField
          fullWidth
          label="Allow2 Child ID"
          type="number"
          value={childId}
          onChange={(e) => setChildId(e.target.value)}
          margin="normal"
          helperText="From your Allow2 account"
        />

        <Box mt={2}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
          >
            Save Settings
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

// IMPORTANT: Must be a default export
export default TabContent;
```

### Using Material-UI Components

Allow2Automate includes Material-UI v4. Use these components:

#### Form Components
```javascript
import {
  TextField,      // Text inputs
  Select,         // Dropdowns
  MenuItem,       // Dropdown items
  Checkbox,       // Checkboxes
  Radio,          // Radio buttons
  Switch,         // Toggle switches
  Slider,         // Range sliders
  Button          // Buttons
} from '@material-ui/core';
```

#### Layout Components
```javascript
import {
  Box,            // Flexbox container
  Grid,           // Grid layout
  Paper,          // Card-like container
  Container,      // Centered container
  Divider         // Visual separator
} from '@material-ui/core';
```

#### Feedback Components
```javascript
import {
  Alert,          // Success/error messages
  Snackbar,       // Toast notifications
  Dialog,         // Modal dialogs
  CircularProgress, // Loading spinner
  LinearProgress  // Progress bar
} from '@material-ui/core';
```

#### Example: Advanced Configuration Form

```javascript
import React, { useState } from 'react';
import {
  Box,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  Button,
  Typography,
  Divider,
  Alert,
  CircularProgress
} from '@material-ui/core';

const TabContent = ({ data, configurationUpdate, ipcRenderer }) => {
  const [config, setConfig] = useState(data || {});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate configuration
      const result = await ipcRenderer.invoke('validate-config', config);

      if (result.valid) {
        configurationUpdate(config);
        setStatus({ type: 'success', message: 'Settings saved successfully!' });
      } else {
        setStatus({ type: 'error', message: result.error });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Plugin Configuration
      </Typography>

      {status && (
        <Alert
          severity={status.type}
          onClose={() => setStatus(null)}
          style={{ marginBottom: 20 }}
        >
          {status.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Account Settings */}
        <Grid item xs={12}>
          <Typography variant="h6">Account Settings</Typography>
          <Divider style={{ margin: '10px 0' }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Username"
            value={config.username || ''}
            onChange={(e) => handleChange('username', e.target.value)}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="API Key"
            type="password"
            value={config.apiKey || ''}
            onChange={(e) => handleChange('apiKey', e.target.value)}
          />
        </Grid>

        {/* Child Selection */}
        <Grid item xs={12}>
          <Typography variant="h6">Child Settings</Typography>
          <Divider style={{ margin: '10px 0' }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Child</InputLabel>
            <Select
              value={config.childId || ''}
              onChange={(e) => handleChange('childId', e.target.value)}
            >
              <MenuItem value={1}>Child 1</MenuItem>
              <MenuItem value={2}>Child 2</MenuItem>
              <MenuItem value={3}>Child 3</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Options */}
        <Grid item xs={12}>
          <Typography variant="h6">Options</Typography>
          <Divider style={{ margin: '10px 0' }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={config.autoBlock || false}
                onChange={(e) => handleChange('autoBlock', e.target.checked)}
              />
            }
            label="Automatically block when quota exceeded"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={config.notifications || false}
                onChange={(e) => handleChange('notifications', e.target.checked)}
              />
            }
            label="Show notifications"
          />
        </Grid>

        {/* Save Button */}
        <Grid item xs={12}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={24} /> : 'Save Settings'}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TabContent;
```

### Storing Credentials Securely

**Never store plain text passwords!**

#### Recommended Approach:

1. **Use API tokens instead of passwords** (when possible)
2. **Encrypt sensitive data** before saving
3. **Validate credentials** via API before storing
4. **Store only tokens/keys** received from validation

```javascript
// In TabContent.js
const handleLogin = async () => {
  try {
    // Send credentials to main process
    const result = await ipcRenderer.invoke('login', {
      username: email,
      password: password  // Only sent, never stored
    });

    if (result.success) {
      // Store only the token, not the password
      configurationUpdate({
        credentials: {
          username: email,
          apiToken: result.token,  // API token from login
          tokenExpiry: result.expiry
        }
      });
    }
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

```javascript
// In index.js (main process)
ipcMain.handle('login', async (event, credentials) => {
  try {
    // Authenticate with external service
    const response = await externalAPI.login(
      credentials.username,
      credentials.password
    );

    // Return only the token
    return {
      success: true,
      token: response.apiToken,
      expiry: response.expiresAt
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});
```

### Validation and Error Messages

Provide clear, actionable error messages:

```javascript
const [errors, setErrors] = useState({});

const validateForm = () => {
  const newErrors = {};

  if (!username || !username.includes('@')) {
    newErrors.username = 'Please enter a valid email address';
  }

  if (!password || password.length < 8) {
    newErrors.password = 'Password must be at least 8 characters';
  }

  if (!childId || childId < 1) {
    newErrors.childId = 'Please select a child';
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

const handleSave = async () => {
  if (!validateForm()) {
    return;
  }

  // Proceed with save...
};

// In your JSX
<TextField
  fullWidth
  label="Email"
  value={username}
  onChange={(e) => setUsername(e.target.value)}
  error={!!errors.username}
  helperText={errors.username}
/>
```

---

## 7. Allow2 Integration

### Getting an Allow2 API Token

1. **Sign up at Allow2 Developer Portal**
   - Visit [https://developer.allow2.com/](https://developer.allow2.com/)
   - Create an account

2. **Create a Device/App**
   - Navigate to "Devices" or "Apps"
   - Click "Create New"
   - Enter details:
     - Name: "YourPlugin for Allow2Automate"
     - Type: "Device" or "Service"
   - Save and copy the generated token

3. **Add Token to package.json**
   ```json
   {
     "allow2Token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
   }
   ```

### Pairing Devices to Children

Users must pair devices/services to specific children in Allow2.

**In your plugin:**

```javascript
// In index.js
const Allow2 = require('allow2');

module.exports = function({ ipcMain, configurationUpdate }) {
  const allow2 = Allow2.setup({
    deviceToken: 'YOUR_TOKEN_FROM_PACKAGE_JSON'
  });

  // Helper to get pairing info
  const getPairingInfo = () => {
    return allow2.getPairing();
  };

  ipcMain.handle('get-pairing-info', async () => {
    try {
      const pairing = getPairingInfo();
      return {
        isPaired: pairing.isPaired(),
        pairings: pairing.getPairings()  // List of child pairings
      };
    } catch (error) {
      return { error: error.message };
    }
  });

  return { onLoad, newState };
};
```

**In your TabContent.js:**

```javascript
const [pairings, setPairings] = useState([]);

useEffect(() => {
  const loadPairings = async () => {
    const result = await ipcRenderer.invoke('get-pairing-info');
    if (result.pairings) {
      setPairings(result.pairings);
    }
  };
  loadPairings();
}, []);

// Show children dropdown
<Select
  value={selectedChild}
  onChange={(e) => setSelectedChild(e.target.value)}
>
  {pairings.map(pair => (
    <MenuItem key={pair.childId} value={pair.childId}>
      {pair.childName}
    </MenuItem>
  ))}
</Select>
```

### Checking Quotas

Use the Allow2 SDK to check if a child has quota available:

```javascript
const checkQuota = async (childId) => {
  try {
    const response = await allow2.check({
      childId: childId,
      activity: 3,  // Activity ID (3 = Internet, 5 = Gaming, etc.)
      log: true     // Log this usage
    });

    console.log('Quota check result:', response);

    return {
      allowed: response.allowed,
      remaining: response.timeRemaining,  // Seconds remaining
      activities: response.activities
    };

  } catch (error) {
    console.error('Quota check failed:', error);
    return { allowed: false, error: error.message };
  }
};

// Example usage in plugin
const enforceQuota = async (childId) => {
  const quota = await checkQuota(childId);

  if (!quota.allowed) {
    console.log('Quota exceeded - blocking access');
    await blockDevice();
  } else {
    console.log(`${quota.remaining} seconds remaining`);
    await allowDevice();
  }
};
```

### Reporting Usage

Report actual usage time to Allow2:

```javascript
const reportUsage = async (childId, seconds) => {
  try {
    const response = await allow2.log({
      childId: childId,
      activity: 3,        // Internet activity
      logType: 'time',
      amount: seconds     // Time used in seconds
    });

    console.log('Usage logged:', response);
    return response;

  } catch (error) {
    console.error('Failed to log usage:', error);
  }
};

// Example: Report gaming session
const sessionStart = Date.now();

// When session ends
const sessionEnd = Date.now();
const secondsPlayed = Math.floor((sessionEnd - sessionStart) / 1000);
await reportUsage(childId, secondsPlayed);
```

### Handling Quota Blocks

When a child runs out of quota, block access appropriately:

```javascript
let checkInterval;
let currentChild;

const startQuotaMonitoring = (childId) => {
  currentChild = childId;

  // Check quota every 5 minutes
  checkInterval = setInterval(async () => {
    const quota = await checkQuota(currentChild);

    if (!quota.allowed) {
      console.log('Quota exceeded - blocking');
      await blockAccess();

      // Notify user
      ipcMain.send('quota-exceeded', {
        childId: currentChild,
        message: 'Time limit reached'
      });
    } else if (quota.remaining < 300) {
      // Less than 5 minutes remaining
      ipcMain.send('quota-warning', {
        childId: currentChild,
        remaining: quota.remaining
      });
    }
  }, 300000);  // 5 minutes
};

const stopQuotaMonitoring = () => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
};

return {
  onLoad: (state) => {
    if (state && state.childId && state.enabled) {
      startQuotaMonitoring(state.childId);
    }
  },

  newState: (state) => {
    stopQuotaMonitoring();
    if (state && state.childId && state.enabled) {
      startQuotaMonitoring(state.childId);
    }
  }
};
```

### Allow2 Activity IDs

Common activity types:

| ID | Activity | Description |
|----|----------|-------------|
| 1 | Screen Time | General device usage |
| 2 | Social | Social media |
| 3 | Internet | Internet access |
| 4 | Communication | Email, messaging |
| 5 | Gaming | Gaming time |
| 6 | Education | Educational apps |
| 7 | Creativity | Creative apps |
| 8 | YouTube | YouTube watching |

---

## 8. Security Best Practices

### Never Hardcode Credentials

❌ **NEVER do this:**
```javascript
const API_KEY = 'sk_live_abc123xyz789';  // WRONG!
const password = 'mypassword123';        // WRONG!
```

✅ **DO this instead:**
```javascript
// Get from configuration (user enters)
const apiKey = config.credentials?.apiKey;

// Or from environment variables (development only)
const apiKey = process.env.SERVICE_API_KEY;
```

### Use Environment Variables for Development

For local testing, use environment variables:

```javascript
// In your plugin
const config = {
  apiKey: process.env.PLUGIN_API_KEY || '',
  baseUrl: process.env.PLUGIN_API_URL || 'https://api.example.com'
};
```

Create a `.env.example` file:
```
PLUGIN_API_KEY=your_key_here
PLUGIN_API_URL=https://api.example.com
```

Add `.env` to `.gitignore`:
```
.env
node_modules/
```

### Validate All Inputs

Never trust user input:

```javascript
const validateConfig = (config) => {
  const errors = [];

  // Check required fields
  if (!config.username) {
    errors.push('Username is required');
  }

  // Validate email format
  if (config.email && !isValidEmail(config.email)) {
    errors.push('Invalid email format');
  }

  // Validate numeric ranges
  if (config.childId && (config.childId < 1 || config.childId > 10)) {
    errors.push('Child ID must be between 1 and 10');
  }

  // Check for injection attempts
  if (config.command && /[;&|]/.test(config.command)) {
    errors.push('Invalid characters in command');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
};

// Use validation
ipcMain.handle('save-config', async (event, config) => {
  const validation = validateConfig(config);

  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors
    };
  }

  // Proceed with save
  configurationUpdate(config);
  return { success: true };
});
```

### Sanitize Outputs

Prevent XSS and injection attacks:

```javascript
const sanitize = require('sanitize-html');

// Sanitize HTML content
const safeHtml = sanitize(userContent, {
  allowedTags: ['b', 'i', 'em', 'strong'],
  allowedAttributes: {}
});

// Escape shell commands
const escapeShell = (cmd) => {
  return cmd.replace(/(["\s'$`\\])/g, '\\$1');
};

// Safe command execution
const executeCommand = async (command) => {
  const safeCommand = escapeShell(command);
  // Execute safely...
};
```

### Use Parameterized Queries

If your plugin uses a database:

```javascript
// ❌ NEVER concatenate user input
const query = `SELECT * FROM users WHERE id = ${userId}`;  // WRONG!

// ✅ Use parameterized queries
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);
```

### Handle API Errors Gracefully

```javascript
const callExternalAPI = async (endpoint, data) => {
  try {
    const response = await axios.post(endpoint, data, {
      timeout: 10000,  // 10 second timeout
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'User-Agent': 'Allow2Automate-Plugin/1.0'
      }
    });

    return { success: true, data: response.data };

  } catch (error) {
    // Log error (never expose sensitive data)
    console.error('API call failed:', {
      endpoint: endpoint,
      status: error.response?.status,
      message: error.message
    });

    // Return safe error message
    return {
      success: false,
      error: 'Unable to connect to service. Please check your credentials.'
    };
  }
};
```

### Request Minimal Permissions

Only request the permissions your plugin actually needs:

```javascript
// Document required permissions in README
## Required Permissions

This plugin requires:
- Network access (to communicate with PlayStation Network)
- File system read access (to check local cache)
- Allow2 API access (to check quotas)

## Does NOT require:
- Webcam or microphone access
- System modification privileges
- Access to other applications
```

---

## 9. Testing Your Plugin

### Local Development Setup

1. **Clone Allow2Automate repository**
   ```bash
   git clone https://github.com/Allow2/Allow2Automate.git
   cd Allow2Automate
   npm install
   ```

2. **Create your plugin directory**
   ```bash
   mkdir -p ~/Library/Application\ Support/Allow2Automate/allow2automate/plugIns
   cd ~/Library/Application\ Support/Allow2Automate/allow2automate/plugIns

   # Or on Linux
   mkdir -p ~/.config/Allow2Automate/allow2automate/plugIns
   cd ~/.config/Allow2Automate/allow2automate/plugIns

   # Or on Windows
   mkdir %APPDATA%\Allow2Automate\allow2automate\plugIns
   cd %APPDATA%\Allow2Automate\allow2automate\plugIns
   ```

3. **Link your plugin for development**
   ```bash
   # In your plugin directory
   cd /path/to/your/allow2automate-myplugin
   npm link

   # In Allow2Automate plugins directory
   cd ~/Library/Application\ Support/Allow2Automate/allow2automate/plugIns
   npm link allow2automate-myplugin
   ```

### Installing Plugin in Allow2Automate

**Method 1: Via UI (Recommended for testing)**

1. Start Allow2Automate in dev mode:
   ```bash
   cd /path/to/Allow2Automate
   npm run develop
   ```

2. Navigate to the Plugins tab
3. Click "Add Plugin"
4. Enter your plugin name: `allow2automate-myplugin`
5. Click Install

**Method 2: Manual Installation**

```bash
# Copy plugin to plugins directory
cp -r /path/to/allow2automate-myplugin \
  ~/Library/Application\ Support/Allow2Automate/allow2automate/plugIns/
```

### Debugging with DevTools

**Enable DevTools in your plugin's TabContent:**

```javascript
// In Allow2Automate/app/components/Plugin.js
// Line 100 is already there:
win.webContents.openDevTools();  // Opens DevTools automatically
```

**Add console logging:**

```javascript
// In your index.js
console.log('Plugin loaded');
console.log('Current state:', JSON.stringify(currentState, null, 2));

// In your TabContent.js
console.log('UI rendered with data:', data);
console.log('Config update triggered:', newConfig);
```

**View logs:**
```bash
# Main process logs (index.js)
# Visible in terminal where you ran `npm run develop`

# Renderer process logs (TabContent.js)
# Visible in DevTools Console (opened automatically)
```

### Testing Configuration UI

**Test checklist for your configuration UI:**

- [ ] All fields render correctly
- [ ] Form validation works
- [ ] Error messages display properly
- [ ] Save button saves configuration
- [ ] Configuration persists after reload
- [ ] IPC communication works
- [ ] Credentials are validated
- [ ] Loading states display correctly
- [ ] Success/error messages appear

**Example test workflow:**

```javascript
// In TabContent.js - Add test button
const runTests = async () => {
  console.log('Starting UI tests...');

  // Test 1: IPC communication
  console.log('Test 1: IPC invoke');
  const result = await ipcRenderer.invoke('test-ping');
  console.log('Result:', result);  // Should log 'pong'

  // Test 2: Configuration save
  console.log('Test 2: Config save');
  configurationUpdate({ test: 'data', timestamp: Date.now() });

  // Test 3: Configuration read
  console.log('Test 3: Config read');
  console.log('Current data:', data);

  console.log('Tests complete!');
};

// Add to your UI
<Button onClick={runTests}>Run Tests</Button>
```

### Testing Quota Enforcement

**Create a test harness:**

```javascript
// test-plugin.js - Run this separately
const allow2 = require('allow2');

const testQuotaCheck = async () => {
  const allow2Instance = allow2.setup({
    deviceToken: 'YOUR_TOKEN'
  });

  console.log('Testing quota check...');

  try {
    const result = await allow2Instance.check({
      childId: 1,  // Test child ID
      activity: 3,
      log: false   // Don't log during testing
    });

    console.log('Quota check successful:');
    console.log('- Allowed:', result.allowed);
    console.log('- Time remaining:', result.timeRemaining, 'seconds');

  } catch (error) {
    console.error('Quota check failed:', error.message);
  }
};

testQuotaCheck();
```

**Run the test:**
```bash
node test-plugin.js
```

### Unit Testing

For more robust testing, use a testing framework:

```bash
npm install --save-dev mocha chai
```

```javascript
// test/plugin.test.js
const { expect } = require('chai');
const myPlugin = require('../index.js');

describe('My Plugin', () => {
  it('should export a function', () => {
    expect(myPlugin).to.be.a('function');
  });

  it('should return onLoad and newState hooks', () => {
    const apis = {
      isMain: true,
      ipcMain: { on: () => {}, handle: () => {} },
      configurationUpdate: () => {}
    };

    const plugin = myPlugin(apis);

    expect(plugin).to.have.property('onLoad');
    expect(plugin).to.have.property('newState');
    expect(plugin.onLoad).to.be.a('function');
    expect(plugin.newState).to.be.a('function');
  });

  it('should handle configuration updates', () => {
    let savedConfig = null;

    const apis = {
      isMain: true,
      ipcMain: { on: () => {}, handle: () => {} },
      configurationUpdate: (config) => { savedConfig = config; }
    };

    const plugin = myPlugin(apis);

    // Trigger state change
    plugin.newState({ test: 'data' });

    // Verify configuration was updated
    // (Add actual logic based on your plugin)
  });
});
```

**Run tests:**
```bash
npx mocha test/plugin.test.js
```

---

## 10. Publishing Your Plugin

### Creating GitHub Repository

1. **Create repository on GitHub**
   - Go to https://github.com/new
   - Name: `allow2automate-myplugin`
   - Description: Brief description of your plugin
   - Choose public or private
   - Don't initialize with README (you have one)

2. **Push your code**
   ```bash
   cd /path/to/allow2automate-myplugin

   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/allow2automate-myplugin.git
   git push -u origin main
   ```

### Writing Good README.md

Your README is the first thing users see. Make it count!

**Template:**

```markdown
# Allow2Automate - PlayStation Plugin

> Control PlayStation Network access with Allow2 parental controls

## Features

- ✅ Monitor play time across all PlayStation devices
- ✅ Enforce Allow2 time quotas automatically
- ✅ Block/unblock access when quotas are exceeded
- ✅ Support for multiple children
- ✅ Real-time quota checking

## Installation

1. Open Allow2Automate
2. Navigate to the Plugins tab
3. Click "Add Plugin"
4. Enter: `allow2automate-playstation`
5. Click "Install"

## Setup

1. Go to Plugin Settings
2. Enter your PlayStation Network credentials
3. Select which child to monitor
4. Save settings

### Getting Allow2 Credentials

You need an Allow2 account. Sign up at [allow2.com](https://allow2.com).

## Configuration

| Setting | Description | Required |
|---------|-------------|----------|
| PSN Email | Your PlayStation Network email | Yes |
| PSN Password | Your PSN password (stored securely) | Yes |
| Child ID | Which child to monitor | Yes |
| Check Interval | How often to check quotas (minutes) | No |
| Auto Block | Automatically block when quota exceeded | No |

## How It Works

1. Plugin checks PSN play time every 5 minutes
2. Compares against Allow2 quotas
3. Blocks PSN access if quota exceeded
4. Reports usage back to Allow2

## Security

- Passwords are never stored in plain text
- All communication uses HTTPS
- Credentials stored locally on your computer only
- No data sent to third parties

## Troubleshooting

**Plugin not loading**
- Check that you entered credentials correctly
- Verify your PSN account is active
- Check Allow2Automate logs

**Quota not enforcing**
- Ensure child ID is correct
- Check Allow2 quotas are set
- Verify plugin is enabled

**Connection errors**
- Check internet connection
- Verify PSN is not down
- Check firewall settings

## Support

- GitHub Issues: https://github.com/yourusername/allow2automate-playstation/issues
- Email: support@example.com

## License

MIT License - see [LICENSE](LICENSE) file

## Credits

Created by [Your Name](https://github.com/yourusername)

Built with [Allow2](https://allow2.com) parental control platform
```

### Choosing a License

**Recommended licenses:**

**MIT License** (most popular, very permissive)
```
MIT License

Copyright (c) 2025 Your Name

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**ISC License** (very similar to MIT, shorter)
**Apache 2.0** (includes patent grant)
**GPL v3** (copyleft, requires derivatives to be open source)

Choose MIT unless you have specific requirements.

### Tagging Versions (Git Tags)

Use semantic versioning: `MAJOR.MINOR.PATCH`

```bash
# Tag a release
git tag -a v1.0.0 -m "First stable release"
git push origin v1.0.0

# For subsequent updates
git tag -a v1.0.1 -m "Bug fixes"
git push origin v1.0.1

git tag -a v1.1.0 -m "New features"
git push origin v1.1.0

git tag -a v2.0.0 -m "Breaking changes"
git push origin v2.0.0
```

**When to increment version numbers:**

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes, API changes
- **MINOR** (1.0.0 → 1.1.0): New features, backward compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, no new features

### Submitting to Registry (PR to Registry Repo)

1. **Fork the Allow2Automate registry repository**
   ```bash
   # Visit https://github.com/Allow2/allow2automate-registry
   # Click "Fork"

   git clone https://github.com/yourusername/allow2automate-registry.git
   cd allow2automate-registry
   ```

2. **Add your plugin metadata**
   ```bash
   # Edit plugins.json
   vim plugins.json
   ```

   Add your plugin:
   ```json
   {
     "plugins": [
       {
         "name": "allow2automate-playstation",
         "shortName": "PlayStation",
         "publisher": "yourusername",
         "description": "Control PlayStation Network access with Allow2",
         "repository": "https://github.com/yourusername/allow2automate-playstation",
         "version": "1.0.0",
         "keywords": ["playstation", "psn", "gaming"],
         "icon": "https://yoursite.com/icon.png",
         "verified": false
       }
     ]
   }
   ```

3. **Create pull request**
   ```bash
   git checkout -b add-playstation-plugin
   git add plugins.json
   git commit -m "Add PlayStation plugin to registry"
   git push origin add-playstation-plugin

   # Visit GitHub and create PR
   ```

4. **Wait for review**
   - Maintainers will review your plugin
   - May request changes
   - Once approved, will be merged

---

## 11. Example: PlayStation Plugin

### Complete Walkthrough

Let's build a complete PlayStation Network integration plugin step by step.

#### Step 1: Create Project Structure

```bash
mkdir allow2automate-playstation
cd allow2automate-playstation
npm init -y
```

#### Step 2: Install Dependencies

```bash
npm install allow2 axios
```

#### Step 3: Create package.json

```json
{
  "name": "allow2automate-playstation",
  "version": "1.0.0",
  "description": "Control PlayStation Network access with Allow2 parental controls",
  "main": "index.js",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "allow2Token": "YOUR_ALLOW2_TOKEN_HERE",
  "engines": {
    "allow2automate": ">=2.0.0"
  },
  "keywords": [
    "allow2automate",
    "playstation",
    "psn",
    "gaming",
    "parental-controls"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/allow2automate-playstation"
  },
  "license": "MIT",
  "dependencies": {
    "allow2": "^1.0.0",
    "axios": "^0.27.0"
  }
}
```

#### Step 4: Create index.js (Main Plugin Logic)

```javascript
// index.js - Main process plugin logic
const Allow2 = require('allow2');
const axios = require('axios');

let checkInterval;
let currentConfig = null;

// PlayStation Network API (simplified example)
class PSNClient {
  constructor(credentials) {
    this.email = credentials.email;
    this.apiToken = credentials.apiToken;
    this.baseUrl = 'https://api.playstation.com';  // Hypothetical
  }

  async getPlayTime(accountId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v1/users/${accountId}/playtime`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'User-Agent': 'Allow2Automate-PlayStation/1.0'
          }
        }
      );

      return {
        totalMinutes: response.data.totalMinutes,
        lastUpdated: response.data.lastUpdated
      };
    } catch (error) {
      console.error('Failed to get play time:', error.message);
      throw error;
    }
  }

  async blockAccount(accountId) {
    console.log(`Blocking PSN account: ${accountId}`);
    // Implementation: Call PSN API to block account
    // Or use parental controls API
  }

  async unblockAccount(accountId) {
    console.log(`Unblocking PSN account: ${accountId}`);
    // Implementation: Call PSN API to unblock account
  }
}

module.exports = function({ ipcMain, configurationUpdate }) {
  let psnClient = null;
  let allow2 = null;

  // Initialize Allow2
  const initAllow2 = () => {
    allow2 = Allow2.setup({
      // Token is from package.json
    });
  };

  // Check quota and enforce
  const checkAndEnforce = async () => {
    if (!currentConfig || !currentConfig.enabled) {
      return;
    }

    try {
      // Get current play time from PSN
      const playTime = await psnClient.getPlayTime(
        currentConfig.psnAccountId
      );

      console.log('Current play time:', playTime.totalMinutes, 'minutes');

      // Check Allow2 quota
      const quota = await allow2.check({
        childId: currentConfig.childId,
        activity: 5,  // Gaming activity
        log: true
      });

      console.log('Allow2 quota:', {
        allowed: quota.allowed,
        remaining: quota.timeRemaining
      });

      if (!quota.allowed) {
        // Quota exceeded - block
        console.log('Quota exceeded - blocking PSN access');
        await psnClient.blockAccount(currentConfig.psnAccountId);

        // Notify UI
        ipcMain.send('quota-exceeded', {
          childId: currentConfig.childId,
          message: 'Gaming time limit reached'
        });

      } else if (currentConfig.autoUnblock) {
        // Quota available - ensure unblocked
        await psnClient.unblockAccount(currentConfig.psnAccountId);
      }

      // Send status update to UI
      ipcMain.send('status-update', {
        playTime: playTime.totalMinutes,
        quotaRemaining: quota.timeRemaining,
        allowed: quota.allowed
      });

    } catch (error) {
      console.error('Check and enforce failed:', error);
      ipcMain.send('error', {
        message: error.message
      });
    }
  };

  // Start monitoring
  const startMonitoring = (config) => {
    stopMonitoring();  // Clear any existing interval

    currentConfig = config;
    psnClient = new PSNClient(config.credentials);

    // Initial check
    checkAndEnforce();

    // Periodic checks (every 5 minutes)
    const intervalMinutes = config.checkInterval || 5;
    checkInterval = setInterval(
      checkAndEnforce,
      intervalMinutes * 60 * 1000
    );

    console.log(`Started monitoring PSN (check every ${intervalMinutes} min)`);
  };

  // Stop monitoring
  const stopMonitoring = () => {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
      console.log('Stopped monitoring PSN');
    }
  };

  // IPC Handlers

  // Validate PSN credentials
  ipcMain.handle('validate-credentials', async (event, credentials) => {
    try {
      const client = new PSNClient(credentials);

      // Test API call
      await client.getPlayTime(credentials.accountId);

      return {
        valid: true,
        message: 'Credentials are valid'
      };

    } catch (error) {
      return {
        valid: false,
        message: 'Invalid credentials or PSN is unavailable'
      };
    }
  });

  // Manual quota check (from UI)
  ipcMain.handle('check-quota-now', async () => {
    await checkAndEnforce();
    return { success: true };
  });

  // Initialize
  initAllow2();

  // Return lifecycle hooks
  return {
    onLoad: (initialState) => {
      console.log('PlayStation plugin loaded');

      if (initialState && initialState.enabled) {
        console.log('Resuming with state:', initialState);
        startMonitoring(initialState);
      }
    },

    newState: (newState) => {
      console.log('Configuration updated:', newState);

      if (newState && newState.enabled) {
        startMonitoring(newState);
      } else {
        stopMonitoring();
      }
    }
  };
};
```

#### Step 5: Create TabContent.js (Configuration UI)

```javascript
// TabContent.js - Renderer process UI
import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Grid,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent
} from '@material-ui/core';

const TabContent = ({
  data,
  configurationUpdate,
  ipcRenderer,
  user
}) => {
  // Form state
  const [email, setEmail] = useState(data?.credentials?.email || '');
  const [password, setPassword] = useState('');
  const [psnAccountId, setPsnAccountId] = useState(data?.psnAccountId || '');
  const [childId, setChildId] = useState(data?.childId || '');
  const [autoUnblock, setAutoUnblock] = useState(data?.autoUnblock ?? true);
  const [checkInterval, setCheckInterval] = useState(data?.checkInterval || 5);

  // UI state
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState(null);
  const [status, setStatus] = useState(null);

  // Listen for status updates
  useEffect(() => {
    const handleStatusUpdate = (event, statusData) => {
      setStatus(statusData);
    };

    const handleError = (event, error) => {
      setMessage({ type: 'error', text: error.message });
    };

    const handleQuotaExceeded = (event, data) => {
      setMessage({
        type: 'warning',
        text: `Time limit reached for child ${data.childId}`
      });
    };

    ipcRenderer.on('status-update', handleStatusUpdate);
    ipcRenderer.on('error', handleError);
    ipcRenderer.on('quota-exceeded', handleQuotaExceeded);

    return () => {
      ipcRenderer.removeAllListeners('status-update');
      ipcRenderer.removeAllListeners('error');
      ipcRenderer.removeAllListeners('quota-exceeded');
    };
  }, [ipcRenderer]);

  // Validate credentials
  const handleValidate = async () => {
    setValidating(true);
    setMessage(null);

    try {
      const result = await ipcRenderer.invoke('validate-credentials', {
        email,
        password,
        accountId: psnAccountId
      });

      if (result.valid) {
        setMessage({
          type: 'success',
          text: 'Credentials validated successfully!'
        });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setValidating(false);
    }
  };

  // Save configuration
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Validate first
      const result = await ipcRenderer.invoke('validate-credentials', {
        email,
        password,
        accountId: psnAccountId
      });

      if (!result.valid) {
        setMessage({ type: 'error', text: result.message });
        setSaving(false);
        return;
      }

      // Save configuration
      configurationUpdate({
        enabled: true,
        credentials: {
          email,
          apiToken: result.apiToken  // Received from validation
        },
        psnAccountId,
        childId: parseInt(childId),
        autoUnblock,
        checkInterval: parseInt(checkInterval)
      });

      setMessage({
        type: 'success',
        text: 'Settings saved! Monitoring started.'
      });

    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  // Manual check
  const handleCheckNow = async () => {
    try {
      await ipcRenderer.invoke('check-quota-now');
      setMessage({ type: 'info', text: 'Quota check triggered' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        PlayStation Network Integration
      </Typography>

      <Typography variant="body2" color="textSecondary" paragraph>
        Control PlayStation access based on Allow2 time quotas
      </Typography>

      {message && (
        <Alert
          severity={message.type}
          onClose={() => setMessage(null)}
          style={{ marginBottom: 20 }}
        >
          {message.text}
        </Alert>
      )}

      {/* Status Card */}
      {status && (
        <Card style={{ marginBottom: 20, backgroundColor: '#f5f5f5' }}>
          <CardContent>
            <Typography variant="h6">Current Status</Typography>
            <Divider style={{ margin: '10px 0' }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Play Time Today
                </Typography>
                <Typography variant="h6">
                  {Math.floor(status.playTime / 60)} hours {status.playTime % 60} min
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Quota Remaining
                </Typography>
                <Typography variant="h6" color={status.allowed ? 'primary' : 'error'}>
                  {Math.floor(status.quotaRemaining / 60)} min
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Paper style={{ padding: 20 }}>
        <Grid container spacing={3}>
          {/* PSN Credentials */}
          <Grid item xs={12}>
            <Typography variant="h6">PlayStation Network Account</Typography>
            <Divider style={{ margin: '10px 0' }} />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="PSN Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="PSN Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="Only used for validation, not stored"
              required
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="PSN Account ID"
              value={psnAccountId}
              onChange={(e) => setPsnAccountId(e.target.value)}
              helperText="Your PlayStation Network account ID"
              required
            />
          </Grid>

          <Grid item xs={12}>
            <Button
              variant="outlined"
              onClick={handleValidate}
              disabled={validating || !email || !password}
            >
              {validating ? <CircularProgress size={24} /> : 'Validate Credentials'}
            </Button>
          </Grid>

          {/* Allow2 Settings */}
          <Grid item xs={12}>
            <Typography variant="h6">Allow2 Settings</Typography>
            <Divider style={{ margin: '10px 0' }} />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Allow2 Child ID"
              type="number"
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              helperText="Which child to monitor from Allow2"
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Check Interval (minutes)"
              type="number"
              value={checkInterval}
              onChange={(e) => setCheckInterval(e.target.value)}
              helperText="How often to check quotas"
              inputProps={{ min: 1, max: 60 }}
            />
          </Grid>

          {/* Options */}
          <Grid item xs={12}>
            <Typography variant="h6">Options</Typography>
            <Divider style={{ margin: '10px 0' }} />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoUnblock}
                  onChange={(e) => setAutoUnblock(e.target.checked)}
                  color="primary"
                />
              }
              label="Automatically unblock when quota available"
            />
          </Grid>

          {/* Actions */}
          <Grid item xs={12}>
            <Divider style={{ margin: '20px 0' }} />
            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                disabled={saving || !email || !psnAccountId || !childId}
              >
                {saving ? <CircularProgress size={24} /> : 'Save & Start Monitoring'}
              </Button>

              {data?.enabled && (
                <Button
                  variant="outlined"
                  onClick={handleCheckNow}
                >
                  Check Quota Now
                </Button>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default TabContent;
```

#### Step 6: Create README.md

```markdown
# Allow2Automate - PlayStation Plugin

Control PlayStation Network access with Allow2 parental controls.

## Features

- Monitor play time across PlayStation devices
- Enforce Allow2 gaming quotas
- Auto-block when time limit reached
- Auto-unblock when quota renews
- Real-time status monitoring

## Installation

See main guide above.

## Setup

1. Get your PSN account credentials
2. Get your Allow2 child ID
3. Configure in plugin settings
4. Save and start monitoring

## License

MIT
```

#### Step 7: Test Locally

```bash
# Link for development
npm link

# Copy to Allow2Automate plugins directory
cp -r . ~/Library/Application\ Support/Allow2Automate/allow2automate/plugIns/allow2automate-playstation/

# Run Allow2Automate
cd /path/to/Allow2Automate
npm run develop
```

---

## 12. Troubleshooting

### Common Errors and Solutions

#### Error: "Plugin not found"

**Cause:** Plugin name doesn't match or isn't installed

**Solution:**
```bash
# Check plugin name in package.json
grep "name" package.json

# Verify it starts with "allow2automate-"
# Check installation directory
ls ~/Library/Application\ Support/Allow2Automate/allow2automate/plugIns/
```

#### Error: "Module not found: react"

**Cause:** TabContent.js can't find React

**Solution:** React is provided by Allow2Automate, don't install it in your plugin. If using ES6 imports, make sure you're using Babel.

#### Error: "configurationUpdate is not a function"

**Cause:** API object not destructured correctly

**Solution:**
```javascript
// ❌ Wrong
module.exports = function(apis) {
  apis.configurationUpdate({ ... });  // undefined
}

// ✅ Correct
module.exports = function({ configurationUpdate }) {
  configurationUpdate({ ... });
}
```

#### Error: "IPC channel not registered"

**Cause:** IPC handler not set up correctly

**Solution:**
```javascript
// Make sure handler is registered BEFORE returning hooks
ipcMain.handle('my-channel', async () => {
  return { data: 'value' };
});

return {
  onLoad: () => {},
  newState: () => {}
};
```

#### Plugin loads but UI doesn't appear

**Cause:** TabContent.js has errors or isn't exported correctly

**Solution:**
```javascript
// Must be default export
export default TabContent;

// Not named export
// export { TabContent };  // ❌ Wrong
```

Check browser DevTools console for errors.

#### Configuration doesn't persist

**Cause:** Not calling configurationUpdate

**Solution:**
```javascript
// Call configurationUpdate to save
configurationUpdate({
  myData: 'value',
  timestamp: Date.now()
});

// State will be passed to onLoad/newState
```

### Debugging Tips

1. **Enable verbose logging**
   ```javascript
   console.log('Plugin:', 'Message');
   console.error('Error:', error);
   console.dir(object);
   ```

2. **Use debugger statement**
   ```javascript
   debugger;  // Pauses execution in DevTools
   ```

3. **Check main process console**
   ```bash
   # Terminal where you ran npm run develop shows main process logs
   ```

4. **Check renderer console**
   ```javascript
   // Open DevTools (automatically opens)
   // Look in Console tab
   ```

5. **Test IPC separately**
   ```javascript
   // In TabContent.js
   const testIPC = async () => {
     const result = await ipcRenderer.invoke('test');
     console.log(result);
   };
   ```

6. **Validate JSON**
   ```javascript
   try {
     JSON.parse(jsonString);
   } catch (error) {
     console.error('Invalid JSON:', error);
   }
   ```

### Where to Get Help

1. **GitHub Issues**
   - https://github.com/Allow2/Allow2Automate/issues
   - Search existing issues first
   - Provide error logs and steps to reproduce

2. **Allow2 Developer Forum**
   - https://developer.allow2.com/forum
   - Community support
   - Plugin development questions

3. **Email Support**
   - support@allow2.com
   - For account/API issues

4. **Stack Overflow**
   - Tag: `allow2automate`
   - For general programming questions

---

## 13. Best Practices

### Code Style Guidelines

**Use consistent formatting:**

```javascript
// Use 2-space indentation
const myFunction = () => {
  if (condition) {
    doSomething();
  }
};

// Use camelCase for variables
const myVariable = 'value';
const userSettings = {};

// Use PascalCase for classes/components
class PSNClient {}
const TabContent = () => {};

// Use UPPER_CASE for constants
const API_BASE_URL = 'https://api.example.com';
const MAX_RETRIES = 3;
```

**Use ESLint:**

```bash
npm install --save-dev eslint
npx eslint --init
```

`.eslintrc.js`:
```javascript
module.exports = {
  env: {
    node: true,
    es6: true
  },
  extends: 'eslint:recommended',
  rules: {
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always']
  }
};
```

### Documentation Standards

**Document all public functions:**

```javascript
/**
 * Check if child has quota available
 * @param {number} childId - Allow2 child ID
 * @param {number} activityId - Activity type (5 = gaming)
 * @returns {Promise<Object>} Quota status { allowed, remaining }
 * @throws {Error} If API call fails
 */
const checkQuota = async (childId, activityId) => {
  // Implementation
};
```

**Keep README up to date:**
- Update when adding features
- Document breaking changes
- Include migration guides

**Write a CHANGELOG:**

```markdown
# Changelog

## [1.1.0] - 2025-01-20
### Added
- Support for multiple PSN accounts
- Real-time quota notifications

### Fixed
- Bug where quota wasn't checked after midnight

## [1.0.1] - 2025-01-15
### Fixed
- Credentials validation error handling

## [1.0.0] - 2025-01-10
### Added
- Initial release
- PSN integration
- Quota enforcement
```

### Versioning Strategy

Follow **Semantic Versioning** (semver):

- **1.0.0** - Initial stable release
- **1.0.1** - Bug fix (patch)
- **1.1.0** - New feature (minor)
- **2.0.0** - Breaking change (major)

**When to bump version:**

```bash
# Bug fix
npm version patch  # 1.0.0 → 1.0.1

# New feature (backward compatible)
npm version minor  # 1.0.1 → 1.1.0

# Breaking change
npm version major  # 1.1.0 → 2.0.0
```

### Changelog Maintenance

Keep `CHANGELOG.md` updated:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
### Added
- Feature in development

## [1.2.0] - 2025-02-01
### Added
- Multi-account support
- Email notifications

### Changed
- Improved error messages

### Deprecated
- Old configuration format (will be removed in 2.0.0)

### Fixed
- Quota not updating at midnight
- Memory leak in interval handler

### Security
- Updated dependencies to patch vulnerabilities
```

### Supporting Users

**Respond to issues promptly:**
- Acknowledge issues within 24-48 hours
- Provide troubleshooting steps
- Ask for logs/screenshots
- Close resolved issues

**Create issue templates:**

`.github/ISSUE_TEMPLATE/bug_report.md`:
```markdown
---
name: Bug report
about: Report a bug
---

**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g., macOS 12.0]
- Allow2Automate version: [e.g., 2.0.0]
- Plugin version: [e.g., 1.0.1]

**Additional context**
Any other context about the problem.
```

---

## 14. Plugin Registry Submission

### Metadata JSON Format

When submitting to the registry, provide this metadata:

```json
{
  "name": "allow2automate-playstation",
  "shortName": "PlayStation",
  "publisher": "yourusername",
  "publisherName": "Your Name",
  "publisherEmail": "you@example.com",
  "description": "Control PlayStation Network access with Allow2 parental controls",
  "longDescription": "Monitor play time, enforce quotas, and automatically block/unblock PlayStation Network access based on Allow2 time limits. Supports multiple accounts and real-time monitoring.",
  "version": "1.0.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/allow2automate-playstation"
  },
  "homepage": "https://github.com/yourusername/allow2automate-playstation#readme",
  "bugs": "https://github.com/yourusername/allow2automate-playstation/issues",
  "keywords": [
    "allow2automate",
    "playstation",
    "psn",
    "gaming",
    "parental-controls"
  ],
  "category": "gaming",
  "icon": "https://yoursite.com/icon-128x128.png",
  "banner": "https://yoursite.com/banner-800x200.png",
  "screenshots": [
    "https://yoursite.com/screenshot1.png",
    "https://yoursite.com/screenshot2.png"
  ],
  "license": "MIT",
  "verified": false,
  "featured": false
}
```

### How to Submit PR

1. **Fork registry repository**
   ```bash
   git clone https://github.com/Allow2/allow2automate-registry.git
   cd allow2automate-registry
   ```

2. **Add your plugin to `plugins.json`**
   ```bash
   vim plugins.json
   # Add your plugin metadata to the array
   ```

3. **Validate JSON**
   ```bash
   # Make sure JSON is valid
   node -e "JSON.parse(require('fs').readFileSync('plugins.json'))"
   ```

4. **Commit and push**
   ```bash
   git checkout -b add-playstation-plugin
   git add plugins.json
   git commit -m "Add PlayStation plugin to registry"
   git push origin add-playstation-plugin
   ```

5. **Create Pull Request**
   - Visit GitHub
   - Click "New Pull Request"
   - Fill in description
   - Submit

### Review Process

**What reviewers check:**

1. ✅ Plugin follows naming convention
2. ✅ package.json has all required fields
3. ✅ README is clear and complete
4. ✅ Code follows security best practices
5. ✅ No hardcoded credentials
6. ✅ Plugin actually works (tested)
7. ✅ License is appropriate
8. ✅ Repository is public
9. ✅ No malicious code

**Timeline:**
- Initial review: 2-5 business days
- Requested changes: respond within 1 week
- Approval: 1-3 business days after fixes

### Getting "Verified" Badge

To get the verified badge:

1. **Submit plugin** (as above)
2. **Wait for approval** (merged to registry)
3. **Demonstrate quality:**
   - Active maintenance (respond to issues)
   - Multiple versions released
   - No critical bugs reported
   - Good documentation
   - Active users (downloads)

4. **Request verification:**
   - Email: plugins@allow2.com
   - Subject: "Verification Request: [plugin-name]"
   - Include:
     - Plugin name
     - GitHub repository
     - Stats (downloads, users)
     - Why it should be verified

**Verification criteria:**
- ✅ 6+ months active maintenance
- ✅ 100+ downloads
- ✅ No critical bugs in 3 months
- ✅ Responsive to user issues
- ✅ Good code quality
- ✅ Complete documentation

### Updating Plugin Information

**To update metadata:**

1. Fork registry repository (if not already)
2. Update your plugin entry in `plugins.json`
3. Submit PR with clear description of changes

**To update plugin code:**

1. Update your plugin repository
2. Bump version in package.json
3. Create git tag
4. Update registry with new version
5. Submit PR

---

## Conclusion

You now have everything you need to create, test, and publish Allow2Automate plugins!

### Quick Start Checklist

- [ ] Set up development environment (Node.js, Git, etc.)
- [ ] Get Allow2 developer token
- [ ] Create plugin project with proper structure
- [ ] Implement main logic in index.js
- [ ] Create configuration UI in TabContent.js
- [ ] Test plugin locally
- [ ] Write comprehensive README
- [ ] Publish to GitHub
- [ ] Submit to plugin registry
- [ ] Support users and maintain plugin

### Resources

- **Allow2Automate:** https://github.com/Allow2/Allow2Automate
- **Allow2 Developer:** https://developer.allow2.com/
- **Plugin Examples:** https://github.com/Allow2?q=allow2automate-
- **Issue Tracker:** https://github.com/Allow2/Allow2Automate/issues

### Need Help?

- 📧 Email: support@allow2.com
- 💬 Forum: https://developer.allow2.com/forum
- 🐛 Issues: https://github.com/Allow2/Allow2Automate/issues

---

**Happy Plugin Development! 🚀**

---

*Last updated: December 2025*
*Document version: 2.0.0*
*For Allow2Automate v2.0.0+*
