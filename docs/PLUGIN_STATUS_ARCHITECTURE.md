# Plugin Status Notification System - Architecture Design

**Version:** 1.0
**Date:** 2025-12-25
**Status:** Design Document

## Executive Summary

This document describes the architecture for a plugin status notification system that enables Allow2Automate plugins to communicate their operational status (configured, connected, working, error states) to the main application, with visual indicators displayed on plugin tabs in the UI.

The design follows an **event-driven push model** where plugins actively report status changes via IPC, ensuring real-time feedback to users about plugin health.

---

## 1. System Overview

### 1.1 Goals

1. **Real-time Status Communication**: Plugins push status updates to main application immediately when state changes
2. **Visual Feedback**: Users see warning/error icons on plugin tabs for non-working plugins
3. **Backward Compatibility**: Existing plugins without status support continue to work
4. **Extensible States**: Support multiple status states beyond simple working/not-working
5. **Type Safety**: Well-defined status interface contract for plugin developers

### 1.2 Non-Goals

- Automatic plugin remediation (fixing plugin issues automatically)
- Historical status tracking/logging (focus on current state only)
- Cross-plugin dependency health monitoring
- Network connectivity diagnostics (plugins handle their own diagnostics)

### 1.3 Architecture Principles

1. **Push over Pull**: Plugins notify host when status changes (event-driven)
2. **Default to Invalid**: Plugins start in "unconfigured" state until they report otherwise
3. **Fail-Safe UI**: Missing status information shows as warning, not error
4. **Minimal Plugin Burden**: Simple API for plugin developers to implement

---

## 2. Status State Model

### 2.1 Status States

Plugins can report the following status states:

```typescript
enum PluginStatus {
  UNCONFIGURED = 'unconfigured',    // Plugin needs initial configuration
  CONFIGURED = 'configured',         // Configured but not connected/active
  CONNECTED = 'connected',           // Connected and operational
  DISCONNECTED = 'disconnected',     // Was connected, lost connection
  ERROR = 'error',                   // Error state requiring attention
  WARNING = 'warning'                // Working but with issues/degradation
}
```

### 2.2 Status Data Structure

```typescript
interface PluginStatusData {
  status: PluginStatus;              // Current status state
  message?: string;                  // Human-readable status message
  timestamp: number;                 // When status was set (Unix timestamp)
  details?: {                        // Optional structured details
    errorCode?: string;              // Machine-readable error code
    errorMessage?: string;           // Detailed error message
    metadata?: Record<string, any>;  // Plugin-specific metadata
  };
}
```

### 2.3 Status Transitions

Valid status transitions:

```
UNCONFIGURED → CONFIGURED → CONNECTED
             ↓              ↓        ↓
             ERROR ←--------+--------+
                            ↓
                      DISCONNECTED → CONNECTED
                            ↓
                          ERROR
```

---

## 3. IPC Protocol Specification

### 3.1 Channel Naming Convention

All plugin status IPC communication uses namespaced channels:

```
<pluginName>.status.update    // Plugin → Main (status update)
<pluginName>.status.query     // Main → Plugin (request current status)
<pluginName>.status.response  // Plugin → Main (response to query)
```

**Examples:**
- `@allow2/allow2automate-wemo.status.update`
- `allow2automate-ssh.status.update`

### 3.2 IPC Message Formats

#### 3.2.1 Status Update (Plugin → Main)

**Channel:** `<pluginName>.status.update`

**Message:**
```javascript
{
  status: 'connected',           // PluginStatus enum value
  message: 'Connected to 3 devices',
  timestamp: 1735152000000,
  details: {
    errorCode: null,
    metadata: {
      deviceCount: 3
    }
  }
}
```

#### 3.2.2 Status Query (Main → Plugin)

**Channel:** `<pluginName>.status.query`

**Message:** `{}` (empty object)

#### 3.2.3 Status Response (Plugin → Main)

**Channel:** `<pluginName>.status.response`

**Message:** Same as Status Update

### 3.3 IPC Communication Flow

```
┌─────────────┐                    ┌──────────────┐
│   Plugin    │                    │  Main Process│
│  (Renderer) │                    │   (Node.js)  │
└─────────────┘                    └──────────────┘
       │                                   │
       │  1. Plugin loads/connects         │
       │                                   │
       │  2. status.update                 │
       ├──────────────────────────────────>│
       │     { status: 'connected' }       │
       │                                   │
       │                             3. Dispatch Redux
       │                                action
       │                                   │
       │  4. Redux state updated           │
       │  5. UI re-renders with status     │
       │                                   │
       │  6. Connection lost               │
       │                                   │
       │  7. status.update                 │
       ├──────────────────────────────────>│
       │     { status: 'disconnected' }    │
       │                                   │
```

---

## 4. Redux State Management

### 4.1 State Structure

Add new `pluginStatus` reducer to track status for all plugins:

```javascript
// State shape
{
  pluginStatus: {
    '@allow2/allow2automate-wemo': {
      status: 'connected',
      message: 'Connected to 3 WeMo devices',
      timestamp: 1735152000000,
      details: {
        metadata: { deviceCount: 3 }
      }
    },
    'allow2automate-ssh': {
      status: 'unconfigured',
      message: 'SSH credentials not configured',
      timestamp: 1735152000000
    }
  }
}
```

### 4.2 Redux Actions

#### New Actions (`app/actions/pluginStatus.js`)

```javascript
import { createAction } from 'redux-actions';

export default {
  // Update status for a single plugin
  pluginStatusUpdate: createAction('PLUGIN_STATUS_UPDATE',
    (pluginName, statusData) => ({ pluginName, statusData })
  ),

  // Clear status for a plugin (when uninstalled)
  pluginStatusClear: createAction('PLUGIN_STATUS_CLEAR',
    (pluginName) => ({ pluginName })
  ),

  // Initialize all plugin statuses (on app start)
  pluginStatusInit: createAction('PLUGIN_STATUS_INIT',
    (statusMap) => statusMap
  )
};
```

### 4.3 Redux Reducer

#### New Reducer (`app/reducers/pluginStatus.js`)

```javascript
import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({
  [actions.pluginStatusUpdate]: (state, action) => {
    const { pluginName, statusData } = action.payload;
    return {
      ...state,
      [pluginName]: {
        ...statusData,
        timestamp: statusData.timestamp || Date.now()
      }
    };
  },

  [actions.pluginStatusClear]: (state, action) => {
    const { pluginName } = action.payload;
    const newState = { ...state };
    delete newState[pluginName];
    return newState;
  },

  [actions.pluginStatusInit]: (state, action) => {
    return { ...action.payload };
  },

  // Clear status when plugin is uninstalled
  [actions.installedPluginRemove]: (state, action) => {
    const pluginName = action.payload.pluginName;
    const newState = { ...state };
    delete newState[pluginName];
    return newState;
  }
}, {});
```

### 4.4 Selectors

#### New Selectors (`app/selectors.js`)

```javascript
import { createSelector } from 'reselect';

// Get status for a specific plugin
export const pluginStatusSelector = (state, pluginName) => {
  return state.pluginStatus && state.pluginStatus[pluginName];
};

// Get status for all installed plugins
export const installedPluginStatusSelector = createSelector(
  [state => state.installedPlugins, state => state.pluginStatus],
  (installedPlugins, pluginStatus) => {
    const result = {};
    Object.keys(installedPlugins || {}).forEach(pluginName => {
      result[pluginName] = pluginStatus && pluginStatus[pluginName] || {
        status: 'unconfigured',
        message: 'Status not reported',
        timestamp: Date.now()
      };
    });
    return result;
  }
);

// Check if plugin has a problem (not connected)
export const pluginHasIssueSelector = (state, pluginName) => {
  const status = pluginStatusSelector(state, pluginName);
  if (!status) return true; // No status = issue

  const problemStates = ['unconfigured', 'disconnected', 'error', 'warning'];
  return problemStates.includes(status.status);
};
```

---

## 5. Plugin Interface Specification

### 5.1 Plugin Status API

Plugins receive status update API via the main process initialization:

```javascript
// Plugin main process code (plugin's index.js)
module.exports = function(pluginInterface) {
  const {
    isMain,
    ipcMain,
    configurationUpdate,
    statusUpdate  // NEW: Status update function
  } = pluginInterface;

  // Report status
  statusUpdate({
    status: 'connected',
    message: 'Connected successfully',
    details: {
      metadata: { someData: 123 }
    }
  });

  return {
    onLoad: (configuration) => {
      // Check configuration and update status
      if (!configuration || !configuration.apiKey) {
        statusUpdate({
          status: 'unconfigured',
          message: 'API key not configured'
        });
      } else {
        // Try to connect...
        connectToService(configuration).then(() => {
          statusUpdate({
            status: 'connected',
            message: 'Service connected'
          });
        }).catch(err => {
          statusUpdate({
            status: 'error',
            message: 'Connection failed',
            details: {
              errorCode: 'CONNECTION_FAILED',
              errorMessage: err.message
            }
          });
        });
      }
    },

    // Plugin lifecycle methods...
    newState: (newConfiguration) => {
      // Configuration changed, update status
    }
  };
};
```

### 5.2 Renderer Process Status API

Plugins in the renderer process can also update status via IPC:

```javascript
// Plugin renderer code (TabContent component)
class MyPluginTab extends React.Component {
  componentDidMount() {
    const { ipcRenderer, plugin } = this.props;

    // Update status from renderer
    ipcRenderer.send('status.update', {
      status: 'connected',
      message: 'UI loaded successfully'
    });
  }

  handleConnectionError(error) {
    this.props.ipcRenderer.send('status.update', {
      status: 'error',
      message: 'Connection error',
      details: {
        errorMessage: error.message
      }
    });
  }
}
```

### 5.3 Status Update Helper

Plugins can use a helper utility for consistent status updates:

```javascript
// Helper utility (can be published as npm package)
class PluginStatusManager {
  constructor(ipcRenderer, pluginName) {
    this.ipcRenderer = ipcRenderer;
    this.pluginName = pluginName;
    this.currentStatus = null;
  }

  update(status, message, details = {}) {
    const statusData = {
      status,
      message,
      timestamp: Date.now(),
      details
    };

    this.currentStatus = statusData;
    this.ipcRenderer.send('status.update', statusData);
  }

  setUnconfigured(message) {
    this.update('unconfigured', message);
  }

  setConnected(message, metadata) {
    this.update('connected', message, { metadata });
  }

  setError(message, errorCode, errorMessage) {
    this.update('error', message, { errorCode, errorMessage });
  }

  setDisconnected(message) {
    this.update('disconnected', message);
  }

  getCurrentStatus() {
    return this.currentStatus;
  }
}
```

---

## 6. Main Process Implementation

### 6.1 IPC Handler Registration

Modify `app/plugins.js` to register status IPC handlers:

```javascript
// In plugins.getInstalled() function, after creating installedPlugin

const pluginName = parts[0];

// Create status update function for plugin
const statusUpdate = function(statusData) {
  console.log(`[PluginStatus] ${pluginName} status:`, statusData.status);

  // Validate status data
  const validStatuses = ['unconfigured', 'configured', 'connected',
                         'disconnected', 'error', 'warning'];
  if (!validStatuses.includes(statusData.status)) {
    console.warn(`[PluginStatus] Invalid status for ${pluginName}:`, statusData.status);
    return;
  }

  // Dispatch Redux action to update status
  actions.pluginStatusUpdate(pluginName, {
    status: statusData.status,
    message: statusData.message || '',
    timestamp: statusData.timestamp || Date.now(),
    details: statusData.details || {}
  });

  // Persist to store
  store.save();
};

// Pass statusUpdate to plugin
const installedPlugin = loadedPlugin.plugin({
  isMain: true,
  ipcMain: ipcRestricted,
  configurationUpdate: configurationUpdate,
  statusUpdate: statusUpdate  // NEW
});

// Register IPC handler for status updates from renderer
ipcMain.on(`${pluginName}.status.update`, (event, statusData) => {
  statusUpdate(statusData);
});

// Initialize plugin with unconfigured status
statusUpdate({
  status: 'unconfigured',
  message: 'Plugin loaded, awaiting configuration'
});

// Call plugin's onLoad (which may update status)
let currentPluginState = currentState[pluginName];
installedPlugin.onLoad && installedPlugin.onLoad(currentPluginState);
```

### 6.2 Status Query Support

Allow main process to query plugin status:

```javascript
ipcMain.on(`${pluginName}.status.query`, (event) => {
  const currentStatus = store.getState().pluginStatus[pluginName];
  event.reply(`${pluginName}.status.response`, currentStatus);
});
```

---

## 7. UI Implementation

### 7.1 Tab Status Icons

Modify `app/components/LoggedIn.js` to show status icons on tabs:

```javascript
import { Warning, Error, CheckCircle, Help } from '@material-ui/icons';

// Inside render(), in the Tab mapping:
{ plugins.map(function (plugin) {
    const pluginStatus = this.props.pluginStatus &&
                        this.props.pluginStatus[plugin.name];

    // Determine icon based on status
    let statusIcon = null;
    if (!pluginStatus || pluginStatus.status === 'unconfigured') {
      statusIcon = <Help style={{ color: '#FFA500', fontSize: 18 }} />;
    } else if (pluginStatus.status === 'error') {
      statusIcon = <Error style={{ color: '#F44336', fontSize: 18 }} />;
    } else if (pluginStatus.status === 'warning' ||
               pluginStatus.status === 'disconnected') {
      statusIcon = <Warning style={{ color: '#FF9800', fontSize: 18 }} />;
    } else if (pluginStatus.status === 'connected') {
      statusIcon = <CheckCircle style={{ color: '#4CAF50', fontSize: 18 }} />;
    }

    return (
      <Tab
        label={
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {statusIcon}
            {plugin.shortName || plugin.name}
          </span>
        }
        key={plugin.name}
        value={plugin.name}
      />
    );
  }.bind(this))
}
```

### 7.2 Status Tooltip

Add tooltip to show detailed status message:

```javascript
import { Tooltip } from '@material-ui/core';

<Tab
  label={
    <Tooltip
      title={pluginStatus ? pluginStatus.message : 'Status unknown'}
      placement="bottom"
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {statusIcon}
        {plugin.shortName || plugin.name}
      </span>
    </Tooltip>
  }
  key={plugin.name}
  value={plugin.name}
/>
```

### 7.3 Status Panel in Plugin Tab

Add a status panel at the top of each plugin's tab content:

```javascript
// New component: app/components/PluginStatusBanner.js
import React from 'react';
import { Alert, AlertTitle } from '@material-ui/core';

export default function PluginStatusBanner({ status }) {
  if (!status || status.status === 'connected') {
    return null; // Don't show banner for connected plugins
  }

  const severityMap = {
    unconfigured: 'warning',
    error: 'error',
    warning: 'warning',
    disconnected: 'warning',
    configured: 'info'
  };

  const severity = severityMap[status.status] || 'info';

  return (
    <Alert severity={severity} style={{ marginBottom: 16 }}>
      <AlertTitle>{status.status.toUpperCase()}</AlertTitle>
      {status.message}
      {status.details && status.details.errorMessage && (
        <div style={{ marginTop: 8, fontSize: '0.875em' }}>
          {status.details.errorMessage}
        </div>
      )}
    </Alert>
  );
}
```

### 7.4 Container Integration

Modify `app/containers/MarketplacePage.js` (or create new container) to connect status to components:

```javascript
import { connect } from 'react-redux';
import { pluginStatusSelector, installedPluginStatusSelector } from '../selectors';

const mapStateToProps = (state, ownProps) => {
  return {
    // Existing props...
    pluginStatus: installedPluginStatusSelector(state)
  };
};
```

---

## 8. Migration Strategy

### 8.1 Backward Compatibility

**Plugins without status support:**
- Default to `unconfigured` status
- No breaking changes to existing plugin API
- Plugins continue to function normally

**Detection:**
```javascript
// In plugins.js
installedPlugin.supportsStatus = typeof installedPlugin.onLoad === 'function';
```

### 8.2 Migration Phases

**Phase 1: Core Implementation (Week 1)**
1. Implement Redux actions, reducer, selectors
2. Add IPC handlers in main process
3. Update plugin loading to provide statusUpdate API
4. Add basic UI indicators (icons on tabs)

**Phase 2: Enhanced UI (Week 2)**
1. Add status tooltips
2. Implement status banner component
3. Add status panel in plugin settings
4. Create status legend/help documentation

**Phase 3: Plugin Updates (Week 3-4)**
1. Update official plugins (@allow2/allow2automate-wemo, -ssh, etc.)
2. Create plugin developer guide
3. Publish status helper utility package
4. Community plugin migration support

**Phase 4: Advanced Features (Future)**
1. Status history/logging
2. Status-based plugin auto-disable
3. Health check dashboard
4. Status aggregation for multiple plugin instances

### 8.3 Rollback Plan

If issues arise:
1. Status feature is **additive** - can be disabled without breaking plugins
2. Remove status indicators from UI
3. Keep status Redux state (no harm if unused)
4. Document issues and re-plan

---

## 9. Testing Strategy

### 9.1 Unit Tests

```javascript
// Test Redux reducer
describe('pluginStatus reducer', () => {
  it('should update status for a plugin', () => {
    const state = {};
    const action = pluginStatusUpdate('test-plugin', {
      status: 'connected',
      message: 'Test'
    });
    const newState = pluginStatusReducer(state, action);
    expect(newState['test-plugin'].status).to.equal('connected');
  });

  it('should clear status when plugin removed', () => {
    const state = { 'test-plugin': { status: 'connected' } };
    const action = installedPluginRemove({ pluginName: 'test-plugin' });
    const newState = pluginStatusReducer(state, action);
    expect(newState['test-plugin']).to.be.undefined;
  });
});
```

### 9.2 Integration Tests

```javascript
// Test IPC communication
describe('Plugin status IPC', () => {
  it('should receive status update from plugin', (done) => {
    const { ipcRenderer } = require('electron');

    ipcRenderer.send('test-plugin.status.update', {
      status: 'connected',
      message: 'Test connection'
    });

    setTimeout(() => {
      const state = store.getState();
      expect(state.pluginStatus['test-plugin'].status).to.equal('connected');
      done();
    }, 100);
  });
});
```

### 9.3 Manual Test Cases

1. **Plugin Installation**
   - Install new plugin
   - Verify default "unconfigured" status
   - Configure plugin
   - Verify status changes to "connected"

2. **Connection Loss**
   - Disconnect network/service
   - Verify status changes to "disconnected"
   - Verify warning icon appears on tab
   - Reconnect
   - Verify status returns to "connected"

3. **Error States**
   - Provide invalid configuration
   - Verify error status and message
   - Correct configuration
   - Verify recovery to connected

4. **Multiple Plugins**
   - Install 3+ plugins
   - Set different statuses
   - Verify each tab shows correct icon
   - Verify tooltips show correct messages

---

## 10. Example Implementation

### 10.1 Example Plugin: WeMo

```javascript
// @allow2/allow2automate-wemo/index.js (main process)
module.exports = function(pluginInterface) {
  const { ipcMain, configurationUpdate, statusUpdate } = pluginInterface;

  let wemoClient = null;
  let deviceCount = 0;

  return {
    onLoad: function(configuration) {
      if (!configuration || !configuration.devices) {
        statusUpdate({
          status: 'unconfigured',
          message: 'No WeMo devices configured'
        });
        return;
      }

      // Attempt to discover devices
      statusUpdate({
        status: 'configured',
        message: 'Discovering WeMo devices...'
      });

      discoverWemoDevices().then(devices => {
        deviceCount = devices.length;

        if (deviceCount === 0) {
          statusUpdate({
            status: 'warning',
            message: 'No WeMo devices found on network',
            details: {
              metadata: { deviceCount: 0 }
            }
          });
        } else {
          statusUpdate({
            status: 'connected',
            message: `Connected to ${deviceCount} WeMo device(s)`,
            details: {
              metadata: { deviceCount }
            }
          });
        }
      }).catch(err => {
        statusUpdate({
          status: 'error',
          message: 'Failed to discover WeMo devices',
          details: {
            errorCode: 'DISCOVERY_FAILED',
            errorMessage: err.message
          }
        });
      });
    },

    newState: function(newConfiguration) {
      // Re-check status when configuration changes
      this.onLoad(newConfiguration);
    }
  };
};
```

### 10.2 Example Plugin: SSH

```javascript
// allow2automate-ssh/index.js (main process)
const SSH = require('ssh2').Client;

module.exports = function(pluginInterface) {
  const { ipcMain, configurationUpdate, statusUpdate } = pluginInterface;

  let sshConnection = null;

  function testConnection(config) {
    return new Promise((resolve, reject) => {
      const conn = new SSH();

      conn.on('ready', () => {
        conn.end();
        resolve();
      });

      conn.on('error', (err) => {
        reject(err);
      });

      conn.connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password
      });
    });
  }

  return {
    onLoad: function(configuration) {
      if (!configuration || !configuration.host || !configuration.username) {
        statusUpdate({
          status: 'unconfigured',
          message: 'SSH host and credentials not configured'
        });
        return;
      }

      statusUpdate({
        status: 'configured',
        message: 'Testing SSH connection...'
      });

      testConnection(configuration).then(() => {
        statusUpdate({
          status: 'connected',
          message: `Connected to ${configuration.host}`,
          details: {
            metadata: {
              host: configuration.host,
              port: configuration.port || 22
            }
          }
        });
      }).catch(err => {
        statusUpdate({
          status: 'error',
          message: 'SSH connection failed',
          details: {
            errorCode: 'SSH_CONNECTION_FAILED',
            errorMessage: err.message
          }
        });
      });
    }
  };
};
```

---

## 11. Security Considerations

### 11.1 IPC Channel Security

- **Namespace Isolation**: Each plugin uses namespaced channels preventing cross-plugin interference
- **Input Validation**: Validate all status data before storing in Redux
- **No Sensitive Data**: Status messages should not contain passwords, API keys, or sensitive user data

### 11.2 Status Data Sanitization

```javascript
function sanitizeStatusData(statusData) {
  const validStatuses = ['unconfigured', 'configured', 'connected',
                         'disconnected', 'error', 'warning'];

  return {
    status: validStatuses.includes(statusData.status)
            ? statusData.status
            : 'unconfigured',
    message: typeof statusData.message === 'string'
             ? statusData.message.substring(0, 200)
             : '',
    timestamp: Number(statusData.timestamp) || Date.now(),
    details: sanitizeDetails(statusData.details || {})
  };
}

function sanitizeDetails(details) {
  // Remove any potentially sensitive keys
  const sensitiveKeys = ['password', 'apiKey', 'token', 'secret'];
  const sanitized = { ...details };

  sensitiveKeys.forEach(key => {
    delete sanitized[key];
    if (sanitized.metadata) {
      delete sanitized.metadata[key];
    }
  });

  return sanitized;
}
```

---

## 12. Performance Considerations

### 12.1 Status Update Throttling

Prevent excessive status updates:

```javascript
class ThrottledStatusUpdater {
  constructor(statusUpdateFn, throttleMs = 1000) {
    this.statusUpdateFn = statusUpdateFn;
    this.throttleMs = throttleMs;
    this.lastUpdate = 0;
    this.pendingUpdate = null;
  }

  update(statusData) {
    const now = Date.now();

    if (now - this.lastUpdate >= this.throttleMs) {
      // Update immediately
      this.statusUpdateFn(statusData);
      this.lastUpdate = now;
      this.pendingUpdate = null;
    } else {
      // Queue update
      this.pendingUpdate = statusData;

      // Schedule delayed update
      setTimeout(() => {
        if (this.pendingUpdate) {
          this.statusUpdateFn(this.pendingUpdate);
          this.lastUpdate = Date.now();
          this.pendingUpdate = null;
        }
      }, this.throttleMs - (now - this.lastUpdate));
    }
  }
}
```

### 12.2 Redux State Size

- Status data is lightweight (< 1KB per plugin)
- For 50 plugins: ~50KB total status state
- Negligible impact on Redux performance

---

## 13. Documentation Requirements

### 13.1 Plugin Developer Guide

Create `/docs/PLUGIN_STATUS_GUIDE.md` with:
1. Status API overview
2. Code examples for each status state
3. Best practices for status updates
4. Common pitfalls and solutions

### 13.2 User Documentation

Update user manual with:
1. Status icon legend (what each icon means)
2. Troubleshooting steps for common status issues
3. Screenshots of status indicators

---

## 14. Open Questions & Future Enhancements

### 14.1 Open Questions

1. **Status Persistence**: Should status survive app restarts, or reset to "unconfigured"?
   - **Recommendation**: Reset on app restart, plugins should re-report status

2. **Status Aggregation**: For plugins with multiple instances, how to aggregate status?
   - **Recommendation**: Phase 2 feature, show individual instance statuses

3. **Auto-remediation**: Should app attempt to reconnect disconnected plugins?
   - **Recommendation**: Plugin-specific, not enforced by framework

### 14.2 Future Enhancements

1. **Status Dashboard**: Dedicated view showing all plugin statuses
2. **Status Notifications**: Desktop notifications for status changes
3. **Health Checks**: Periodic automated health checks
4. **Status API**: REST API for external monitoring systems
5. **Analytics**: Track status change patterns for plugin reliability metrics

---

## 15. Success Metrics

### 15.1 Technical Metrics

- Plugin status update latency: < 100ms
- UI re-render performance: No jank when status updates
- IPC overhead: < 5% CPU usage
- Memory footprint: < 100KB for status system

### 15.2 User Experience Metrics

- User awareness of plugin issues: > 90% via status indicators
- Time to identify plugin problem: < 30 seconds
- User satisfaction with status visibility: > 4/5 rating

---

## 16. Architecture Decision Records

### ADR-001: Event-Driven Push Model

**Decision**: Use push-based status updates instead of polling

**Rationale**:
- Lower latency (immediate updates)
- Reduced CPU/network overhead
- Simpler plugin implementation
- Aligns with Electron's IPC architecture

**Consequences**:
- Plugins must implement status updates
- No status available until plugin reports
- Requires IPC channel management

---

### ADR-002: Default to Unconfigured State

**Decision**: All plugins start in "unconfigured" state

**Rationale**:
- Fail-safe approach (assume problem until proven otherwise)
- Encourages plugins to report status early
- Clear indication when plugin hasn't implemented status
- Prevents false "working" status

**Consequences**:
- Plugins without status appear as issues
- May cause initial confusion for legacy plugins
- Requires documentation for backward compatibility

---

### ADR-003: Redux for Status State Management

**Decision**: Store status in Redux state, not local component state

**Rationale**:
- Centralized state management
- Enables status queries from any component
- Persists across component re-renders
- Integrates with existing architecture

**Consequences**:
- Redux actions/reducers needed
- State serialization considerations
- Must sync across main/renderer processes

---

## 17. Appendix

### A. File Changes Summary

**New Files:**
- `/app/actions/pluginStatus.js` - Redux actions
- `/app/reducers/pluginStatus.js` - Redux reducer
- `/app/components/PluginStatusBanner.js` - Status banner UI
- `/docs/PLUGIN_STATUS_GUIDE.md` - Plugin developer guide
- `/app/utils/PluginStatusManager.js` - Helper utility (optional)

**Modified Files:**
- `/app/plugins.js` - Add status IPC handlers
- `/app/components/LoggedIn.js` - Add status icons to tabs
- `/app/components/Plugin.js` - Pass status to plugin components
- `/app/reducers/index.js` - Register pluginStatus reducer
- `/app/actions/index.js` - Export pluginStatus actions
- `/app/selectors.js` - Add status selectors

### B. Code Size Estimation

- Redux actions: ~50 lines
- Redux reducer: ~80 lines
- IPC handlers: ~120 lines
- UI components: ~200 lines
- Selectors: ~60 lines
- Helper utilities: ~150 lines
- **Total: ~660 lines of code**

### C. Dependencies

No new dependencies required. Uses existing:
- `electron` (IPC)
- `redux`, `redux-actions`, `react-redux`
- `@material-ui/core`, `@material-ui/icons`
- `reselect`

---

## Revision History

| Version | Date       | Author           | Changes                          |
|---------|------------|------------------|----------------------------------|
| 1.0     | 2025-12-25 | Claude (Sonnet 4.5) | Initial architecture design   |

---

**END OF DOCUMENT**
