# Plugin Pairing API

This document describes how plugins should implement device-to-child pairing using the Allow2 API.

## Overview

When a plugin manages devices that need to be assigned to children, it uses the **Pairing API** provided by the main Allow2Automate application. The main process handles all authentication with Allow2, while plugins are responsible for:

1. Managing their own device data
2. Requesting child assignment via the child picker UI
3. Storing pairing data in their plugin configuration

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Plugin                                │
│  - Discovers/manages devices                                 │
│  - Triggers child picker: this.props.assign(device, token)   │
│  - Calls globalIpc.invoke('pairDevice', {...})               │
│  - Stores pairing in configurationUpdate()                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Main Process                              │
│  - Has user's authenticated access_token                     │
│  - openChildPicker: Shows picker, returns selection          │
│  - pairDevice: Calls Allow2 API with auth                    │
│  - Returns API response to plugin                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Allow2 API                                 │
│  POST /rest/pairDevice                                       │
│  - Auth: Bearer {user.access_token}                          │
│  - Body: { device, name, token, childId }                    │
│  - Returns: pairing data with ChildId, etc.                  │
└─────────────────────────────────────────────────────────────┘
```

## Getting Your Plugin Token

**IMPORTANT**: Each plugin must obtain its own unique token from the Allow2 Developer Portal.

### Steps to Get Your Token

1. Go to [https://developer.allow2.com](https://developer.allow2.com)
2. Sign in or create a developer account
3. Register your plugin as a new "Device Type"
4. Copy the generated token
5. Hardcode the token in your plugin's constants

### Why Tokens Are Required

- **Analytics**: Track device usage per plugin in your developer dashboard
- **Categorization**: Proper device categorization in the Allow2 system
- **Identification**: Your plugin is identified separately from others

### Example Token Configuration

Create a `constants.js` file in your plugin:

```javascript
/**
 * Allow2 Developer Portal Device Token
 *
 * This token identifies your plugin in the Allow2 system.
 * Get your token at: https://developer.allow2.com
 */
const PLUGIN_TOKEN = 'YOUR_TOKEN_HERE';  // Replace with your actual token

export { PLUGIN_TOKEN };
```

## Props Available to Plugins

The Plugin wrapper component provides these props for pairing:

| Prop | Type | Description |
|------|------|-------------|
| `assign(device, token, options)` | Function | Opens child picker and returns result |
| `globalIpc` | Object | IPC interface for `pairDevice`/`unpairDevice` |
| `configurationUpdate(newData)` | Function | Persists plugin configuration |
| `data` | Object | Current plugin configuration (includes pairings) |
| `children` | Object | Map of children by ID |

## API Reference

### `assign(device, token, options)`

Opens the child picker modal and returns the user's selection.

**Parameters:**
- `device` (Object): Device being assigned
  - `device.UDN` or similar unique identifier
  - `device.friendlyName` for display
- `token` (String): Your plugin's Allow2 Developer Portal token
- `options` (Object): Optional settings
  - `currentSelection` (String): Currently assigned child ID
  - `allowClear` (Boolean): Show "Clear Assignment" button (default: true)

**Returns:** Promise resolving to:
```javascript
// User selected a child
{ selected: true, childId: '123', childName: 'Tommy' }

// User cleared assignment
{ cleared: true }

// User cancelled
{ cancelled: true }
```

### `globalIpc.invoke('pairDevice', options)`

Calls the Allow2 API to create a pairing.

**Parameters:**
```javascript
{
    deviceId: 'device-unique-id',   // Unique device identifier
    deviceName: 'Device Name',      // Human-readable name
    token: 'YOUR_PLUGIN_TOKEN',     // Your developer portal token
    childId: '123'                  // Selected child ID
}
```

**Returns:** Promise resolving to:
```javascript
// Success
{ success: true, pairing: { ChildId: '123', ... } }

// Failure
{ success: false, error: 'Error message' }
```

### `globalIpc.invoke('unpairDevice', options)`

Removes a device pairing.

**Parameters:**
```javascript
{
    deviceId: 'device-unique-id'    // Device to unpair
}
```

**Returns:** Promise resolving to:
```javascript
{ success: true }
// or
{ success: false, error: 'Error message' }
```

### `configurationUpdate(newData)`

Persists plugin configuration including pairings.

**Note**: Plugins are responsible for storing their own pairing data. The main process does NOT maintain global pairing state.

## Complete Implementation Example

```javascript
import React, { Component } from 'react';
import { PLUGIN_TOKEN } from '../constants';

class TabContent extends Component {
    async assign(device) {
        // Get current pairing for this device
        const pairings = this.props.data.pairings || {};
        const currentPairing = pairings[device.UDN];
        const currentChildId = currentPairing?.ChildId || null;

        // Open child picker
        const result = await this.props.assign(device, PLUGIN_TOKEN, {
            currentSelection: currentChildId,
            allowClear: !!currentPairing
        });

        // Handle cancellation
        if (result.cancelled) {
            return;
        }

        // Handle clearing assignment
        if (result.cleared) {
            const unpairResult = await this.props.globalIpc.invoke('unpairDevice', {
                deviceId: device.UDN
            });

            if (unpairResult.success) {
                // Remove from local config
                const newPairings = { ...pairings };
                delete newPairings[device.UDN];

                this.props.configurationUpdate({
                    ...this.props.data,
                    pairings: newPairings
                });
            }
            return;
        }

        // Handle new selection
        if (result.selected && result.childId) {
            const pairResult = await this.props.globalIpc.invoke('pairDevice', {
                deviceId: device.UDN,
                deviceName: device.friendlyName,
                token: PLUGIN_TOKEN,
                childId: result.childId
            });

            if (pairResult.success) {
                // Store in local config
                const newPairings = {
                    ...pairings,
                    [device.UDN]: pairResult.pairing
                };

                this.props.configurationUpdate({
                    ...this.props.data,
                    pairings: newPairings
                });
            } else {
                console.error('Failed to pair:', pairResult.error);
                // TODO: Show error to user
            }
        }
    }

    render() {
        const pairings = this.props.data.pairings || {};
        const devices = Object.values(this.props.data.devices || {});

        return (
            <div>
                {devices.map(device => {
                    const paired = pairings[device.UDN];
                    const child = paired && this.props.children[paired.ChildId];

                    return (
                        <div key={device.UDN}>
                            <span>{device.friendlyName}</span>
                            <span>{child ? child.name : 'Not assigned'}</span>
                            <button onClick={() => this.assign(device)}>
                                {paired ? 'Reassign' : 'Assign'}
                            </button>
                        </div>
                    );
                })}
            </div>
        );
    }
}

export default TabContent;
```

## Data Storage Structure

Plugins should store pairings in their configuration namespace:

```javascript
// Plugin configuration structure
{
    "your-plugin-name": {
        devices: {
            "device-uuid-1": { /* device data */ },
            "device-uuid-2": { /* device data */ }
        },
        pairings: {
            "device-uuid-1": {
                ChildId: "123",
                // Additional pairing data from Allow2 API
            }
        }
    }
}
```

## Error Handling

Always handle potential errors:

```javascript
try {
    const pairResult = await this.props.globalIpc.invoke('pairDevice', {...});

    if (!pairResult.success) {
        // Handle API error
        console.error('Pairing failed:', pairResult.error);
        // Show user-friendly error message
    }
} catch (error) {
    // Handle IPC/network error
    console.error('Error calling pairDevice:', error);
}
```

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Not logged in" | User not authenticated | Prompt user to log in |
| "Missing required parameters" | Missing deviceId, token, or childId | Ensure all params provided |
| "API error: 401" | Invalid or expired token | Check your developer portal token |
| "API error: 403" | User doesn't have permission | User needs Allow2 subscription |

## Best Practices

1. **Always use your own token**: Don't reuse tokens from other plugins
2. **Store pairings locally**: Use `configurationUpdate()` to persist
3. **Handle all result types**: cancelled, cleared, and selected
4. **Provide feedback**: Show success/error messages to users
5. **Check existing pairings**: Pass `currentSelection` to highlight current assignment
6. **Graceful degradation**: Handle cases where children list is empty

## Migration from Global Pairings

If your plugin previously used global pairings state, migrate to plugin-specific storage:

```javascript
// OLD (deprecated)
// Pairings stored in state.pairings

// NEW (recommended)
// Pairings stored in state.configurations[pluginName].pairings
```

The main app automatically migrated WeMo pairings. New plugins should always use the plugin-specific storage pattern.
