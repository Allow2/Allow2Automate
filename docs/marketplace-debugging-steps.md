# Marketplace Debugging Steps - Exact Implementation

## CRITICAL FINDING

**The registry file is missing:** `/mnt/ai/automate/automate/registry/plugins.json`

This causes the entire plugin loading chain to fail silently.

## Step-by-Step Debugging Implementation

### Step 1: Add Console Logging (NO FILE CHANGES YET)

Open Electron DevTools Console and run the app. You should see these errors:

```
[Plugins] Loading library from registry...
[Registry] Registry file not found at /path/to/automate/registry/plugins.json
[Plugins] Error loading library from registry: Error: Registry file not found...
plugins.getLibrary Error: Registry file not found: /path/to/automate/registry/plugins.json
```

### Step 2: Verify Environment Mode

Add temporary logging to check if development mode is active:

**File:** `/mnt/ai/automate/automate/app/plugins.js` (line 14-17)

Add after line 17:
```javascript
console.log('[Plugins] Environment Check:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  developmentMode:', registryLoader.developmentMode);
```

Expected output:
```
[Plugins] Environment Check:
  NODE_ENV: development (or production)
  developmentMode: true (or false)
```

### Step 3: Verify Redux State

Add to Redux store configuration to monitor state changes:

**File:** `/mnt/ai/automate/automate/app/childStore.js` (after line 46)

Add after `const store = createStore(...)`:
```javascript
// Debug: Log initial state
console.log('[Redux] Initial State - pluginLibrary:', store.getState().pluginLibrary);

// Debug: Subscribe to state changes
store.subscribe(() => {
    const state = store.getState();
    if (state.pluginLibrary !== undefined) {
        console.log('[Redux] pluginLibrary updated:',
            Object.keys(state.pluginLibrary || {}).length, 'plugins');
    }
});
```

### Step 4: Track Data Flow Through Main Process

**File:** `/mnt/ai/automate/automate/app/main.js` (line 159)

Replace lines 159-166 with:
```javascript
console.log('[Main] Starting plugin library load...');
plugins.getLibrary((err, pluginLibrary) => {
    console.log('[Main] getLibrary callback received');
    console.log('[Main]   Error:', err);
    console.log('[Main]   Library:', pluginLibrary ? Object.keys(pluginLibrary) : null);

    if (err) {
        console.error('[Main] ❌ ERROR loading plugins:', err.message);
        console.log('[Main] pluginLibrary state will remain empty!');
        return;
    }

    console.log('[Main] ✅ Dispatching libraryReplace with',
        Object.keys(pluginLibrary).length, 'plugins');
    actions.libraryReplace(pluginLibrary);
});
```

### Step 5: Track Data in Marketplace Component

**File:** `/mnt/ai/automate/automate/app/components/Marketplace.js`

Add to `getFilteredPlugins` method (line 81):
```javascript
getFilteredPlugins = () => {
    const { pluginLibrary } = this.props;

    console.log('[Marketplace] getFilteredPlugins called');
    console.log('[Marketplace]   pluginLibrary:', pluginLibrary);
    console.log('[Marketplace]   pluginLibrary type:', typeof pluginLibrary);
    console.log('[Marketplace]   pluginLibrary keys:',
        pluginLibrary ? Object.keys(pluginLibrary) : 'undefined');

    if (!pluginLibrary || Object.keys(pluginLibrary).length === 0) {
        console.warn('[Marketplace] ⚠️ No plugins available - returning empty array');
        return [];
    }

    // ... rest of method
```

Add to `render` method (line 127):
```javascript
render() {
    const { pluginLibrary, showCloseButton, onClose } = this.props;
    console.log('[Marketplace] Rendering with pluginLibrary:',
        pluginLibrary ? Object.keys(pluginLibrary).length + ' plugins' : 'undefined');

    // ... rest of method
```

### Step 6: Track Data in Container

**File:** `/mnt/ai/automate/automate/app/containers/MarketplacePage.js`

Modify `mapStateToProps` (line 6):
```javascript
const mapStateToProps = (state, ownProps) => {
    console.log('[MarketplacePage] mapStateToProps called');
    console.log('[MarketplacePage]   state.pluginLibrary:',
        state.pluginLibrary ? Object.keys(state.pluginLibrary).length + ' plugins' : 'empty/undefined');
    console.log('[MarketplacePage]   state.installedPlugins:',
        state.installedPlugins ? Object.keys(state.installedPlugins).length + ' plugins' : 'empty/undefined');

    return {
        pluginLibrary: state.pluginLibrary,
        installedPlugins: state.installedPlugins,
        marketplace: state.marketplace,
        searchQuery: state.marketplace.searchQuery,
        categoryFilter: state.marketplace.categoryFilter,
        selectedPlugin: state.marketplace.selectedPlugin,
        isLoading: state.marketplace.isLoading,
        featuredPlugins: state.marketplace.featuredPlugins,
        installationStatus: state.marketplace.installationStatus,
        showCloseButton: ownProps.showCloseButton,
        onClose: ownProps.onClose
    };
};
```

## Expected Console Output Sequence

### CURRENT (BROKEN) FLOW:
```
[Plugins] Environment Check:
  NODE_ENV: production
  developmentMode: false

[Main] Starting plugin library load...
[Plugins] Loading library from registry...
[Registry] Registry file not found at /mnt/ai/automate/automate/registry/plugins.json
[Plugins] Error loading library from registry: Error: Registry file not found...
[Main] getLibrary callback received
[Main]   Error: Error: Registry file not found: /mnt/ai/automate/automate/registry/plugins.json
[Main]   Library: null
[Main] ❌ ERROR loading plugins: Registry file not found: /mnt/ai/automate/automate/registry/plugins.json
[Main] pluginLibrary state will remain empty!

[Redux] Initial State - pluginLibrary: {}

[MarketplacePage] mapStateToProps called
[MarketplacePage]   state.pluginLibrary: empty/undefined
[Marketplace] Rendering with pluginLibrary: undefined
[Marketplace] getFilteredPlugins called
[Marketplace]   pluginLibrary: {}
[Marketplace]   pluginLibrary type: object
[Marketplace]   pluginLibrary keys: []
[Marketplace] ⚠️ No plugins available - returning empty array
```

### FIXED FLOW (after creating registry or enabling dev mode):
```
[Plugins] Environment Check:
  NODE_ENV: development
  developmentMode: true

[Main] Starting plugin library load...
[Plugins] Loading library from registry...
[Registry] Registry file not found at /mnt/ai/automate/automate/registry/plugins.json
[Registry] Development mode: using fallback data
[Plugins] Loaded 4 plugins from registry
[Main] getLibrary callback received
[Main]   Error: null
[Main]   Library: ["@allow2/allow2automate-battle.net", "@allow2/allow2automate-ssh", "@allow2/allow2automate-wemo", "mcafee-safefamily"]
[Main] ✅ Dispatching libraryReplace with 4 plugins

[Redux] pluginLibrary updated: 4 plugins

[MarketplacePage] mapStateToProps called
[MarketplacePage]   state.pluginLibrary: 4 plugins
[Marketplace] Rendering with pluginLibrary: 4 plugins
[Marketplace] getFilteredPlugins called
[Marketplace]   pluginLibrary: {...}
[Marketplace]   pluginLibrary keys: ["@allow2/allow2automate-battle.net", "@allow2/allow2automate-ssh", "@allow2/allow2automate-wemo", "mcafee-safefamily"]
```

## Quick Fixes (Choose One)

### Fix 1: Force Development Mode (FASTEST)

**File:** `/mnt/ai/automate/automate/app/plugins.js` (line 14)

Change line 14 from:
```javascript
const registryLoader = createRegistryLoader({
    developmentMode: process.env.NODE_ENV === 'development',
    cacheTTL: 60000
});
```

To:
```javascript
const registryLoader = createRegistryLoader({
    developmentMode: true, // Force development mode to use fallback data
    cacheTTL: 60000
});
```

### Fix 2: Create Registry File

Create the directory and file:

```bash
mkdir -p /mnt/ai/automate/automate/registry
```

Create `/mnt/ai/automate/automate/registry/plugins.json`:
```json
{
  "metadata": {
    "version": "1.0.0",
    "lastUpdated": "2024-12-24T00:00:00Z",
    "totalPlugins": 4
  },
  "plugins": [
    {
      "id": "@allow2/allow2automate-battle.net",
      "name": "battle.net",
      "package": "@allow2/allow2automate-battle.net",
      "version": "0.0.2",
      "description": "Enable Allow2Automate management of Battle.Net parental controls",
      "publisher": "allow2",
      "category": "gaming",
      "verified": true,
      "keywords": ["allow2automate", "battle.net", "wow", "world of warcraft"],
      "repository": {
        "type": "git",
        "url": "https://github.com/Allow2/allow2automate-battle.net"
      },
      "main": "./dist/index.js",
      "downloads": 1500,
      "rating": 4.5
    },
    {
      "id": "@allow2/allow2automate-ssh",
      "name": "ssh",
      "package": "@allow2/allow2automate-ssh",
      "version": "0.0.2",
      "description": "Enable Allow2Automate the ability to use ssh to configure devices",
      "publisher": "allow2",
      "category": "connectivity",
      "verified": true,
      "keywords": ["allow2automate", "allow2", "ssh"],
      "repository": {
        "type": "git",
        "url": "https://github.com/Allow2/allow2automate-ssh"
      },
      "main": "./dist/index.js",
      "downloads": 800,
      "rating": 4.2
    },
    {
      "id": "@allow2/allow2automate-wemo",
      "name": "wemo",
      "package": "@allow2/allow2automate-wemo",
      "version": "0.0.4",
      "description": "Enable Allow2Automate the ability to control wemo devices",
      "publisher": "allow2",
      "category": "iot",
      "verified": true,
      "keywords": ["allow2automate", "allow2", "wemo"],
      "repository": {
        "type": "git",
        "url": "https://github.com/Allow2/allow2automate-wemo"
      },
      "main": "./dist/index.js",
      "downloads": 1200,
      "rating": 4.7
    },
    {
      "id": "mcafee-safefamily",
      "name": "safefamily",
      "package": "mcafee-safefamily",
      "version": "1.0.0",
      "description": "Enable Allow2Automate management of McAfee Safe Family parental controls",
      "publisher": "mcafee",
      "category": "parental-control",
      "verified": false,
      "keywords": ["allow2automate", "mcafee", "safefamily"],
      "repository": {
        "type": "git",
        "url": "https://github.com/McAfee/allow2automate-safefamily"
      },
      "main": "./dist/index.js",
      "downloads": 500,
      "rating": 3.8
    }
  ]
}
```

### Fix 3: Add Fallback in Main Process

**File:** `/mnt/ai/automate/automate/app/main.js` (line 159)

Replace lines 159-166:
```javascript
plugins.getLibrary((err, pluginLibrary) => {
    if (err) {
        console.log('plugins.getLibrary', err);

        // Fallback to hardcoded library on error
        const fallbackLibrary = {
            "@allow2/allow2automate-battle.net": {
                name: "battle.net",
                publisher: "allow2",
                version: "0.0.2",
                description: "Enable Allow2Automate management of Battle.Net parental controls",
                category: "gaming"
            },
            "@allow2/allow2automate-ssh": {
                name: "ssh",
                publisher: "allow2",
                version: "0.0.2",
                description: "Enable Allow2Automate the ability to use ssh to configure devices",
                category: "connectivity"
            },
            "@allow2/allow2automate-wemo": {
                name: "wemo",
                publisher: "allow2",
                version: "0.0.4",
                description: "Enable Allow2Automate the ability to control wemo devices",
                category: "iot"
            }
        };

        console.log('[Main] Using fallback library with', Object.keys(fallbackLibrary).length, 'plugins');
        actions.libraryReplace(fallbackLibrary);
        return;
    }
    actions.libraryReplace(pluginLibrary);
});
```

## Verification Steps

After implementing a fix:

1. **Restart the Electron app completely**
2. **Open DevTools Console** (View → Toggle Developer Tools)
3. **Look for log messages** showing plugin loading
4. **Navigate to Marketplace**
5. **Verify plugins are displayed**

## File Locations Summary

| File | Line | Purpose |
|------|------|---------|
| `/mnt/ai/automate/automate/app/main.js` | 159 | Initial plugin load - FAILS SILENTLY |
| `/mnt/ai/automate/automate/app/plugins.js` | 185 | Plugin loader - calls registry |
| `/mnt/ai/automate/automate/app/registry.js` | 31-85 | Registry loader - throws error if no file |
| `/mnt/ai/automate/automate/app/reducers/pluginLibrary.js` | 1-20 | Redux reducer - starts empty |
| `/mnt/ai/automate/automate/app/containers/MarketplacePage.js` | 6 | Maps state to props |
| `/mnt/ai/automate/automate/app/components/Marketplace.js` | 81 | Filters plugins - returns [] if empty |

## Root Cause

The **entire issue** stems from:
1. Missing registry file at `/mnt/ai/automate/automate/registry/plugins.json`
2. Production mode not using fallback data
3. Silent error handling in main.js that doesn't populate state on failure

**The fix is simple:** Either create the registry file, force development mode, or add fallback handling.
