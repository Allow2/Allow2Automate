# Marketplace Debug Report

## Problem Analysis

The marketplace is showing "No plugins found" despite the plugin infrastructure being in place.

## Root Cause Identified

### Issue 1: Missing Registry Directory
**Location:** `/mnt/ai/automate/automate/registry/` does not exist
**Impact:** The `RegistryLoader` class in `/mnt/ai/automate/automate/app/registry.js` cannot find the registry file

**Evidence:**
```bash
ls: cannot access '/mnt/ai/automate/automate/registry/': No such file or directory
```

**Code Reference:**
- File: `/mnt/ai/automate/automate/app/registry.js` line 17
```javascript
this.registryPath = options.registryPath || path.join(__dirname, '../../registry/plugins.json');
```

### Issue 2: Data Flow Breakdown

**Complete Data Flow:**

1. **Main Process Initialization** (`/mnt/ai/automate/automate/app/main.js` lines 159-166):
```javascript
plugins.getLibrary((err, pluginLibrary) => {
    if (err) {
        console.log('plugins.getLibrary', err);
        return;  // ⚠️ SILENT FAILURE - Error logged but state not updated
    }
    actions.libraryReplace(pluginLibrary);  // ✅ Only called on success
});
```

2. **Plugin Loader** (`/mnt/ai/automate/automate/app/plugins.js` lines 185-195):
```javascript
plugins.getLibrary = async function(callback) {
    try {
        console.log('[Plugins] Loading library from registry...');
        const library = await registryLoader.getLibrary();
        console.log(`[Plugins] Loaded ${Object.keys(library).length} plugins from registry`);
        callback(null, library);
    } catch (error) {
        console.error('[Plugins] Error loading library from registry:', error);
        callback(error, null);  // ⚠️ Error passed but no fallback data
    }
};
```

3. **Registry Loader** (`/mnt/ai/automate/automate/app/registry.js` lines 31-85):
```javascript
async loadRegistry() {
    // Check if registry file exists
    if (!fs.existsSync(this.registryPath)) {
        console.warn(`[Registry] Registry file not found at ${this.registryPath}`);

        if (this.developmentMode) {
            console.log('[Registry] Development mode: using fallback data');
            return this.getFallbackRegistry();  // ✅ Has fallback
        }

        throw new Error(`Registry file not found: ${this.registryPath}`);  // ⚠️ Throws in production
    }
    // ... rest of loading logic
}
```

4. **Redux State** (`/mnt/ai/automate/automate/app/reducers/pluginLibrary.js` lines 4-20):
```javascript
export default handleActions({
    [actions.libraryReplace]: (state, action) => {
        return action.payload;  // Completely replaces state
    },
    // ...
}, {});  // ⚠️ INITIAL STATE IS EMPTY OBJECT
```

5. **Container Mapping** (`/mnt/ai/automate/automate/app/containers/MarketplacePage.js` lines 6-21):
```javascript
const mapStateToProps = (state, ownProps) => {
    return {
        pluginLibrary: state.pluginLibrary,  // ✅ Correctly mapped
        installedPlugins: state.installedPlugins,  // ✅ Correctly mapped
        marketplace: state.marketplace,
        // ... other props
    };
};
```

6. **Component Rendering** (`/mnt/ai/automate/automate/app/components/Marketplace.js` lines 81-102):
```javascript
getFilteredPlugins = () => {
    const { pluginLibrary } = this.props;

    if (!pluginLibrary || Object.keys(pluginLibrary).length === 0) {
        return [];  // ⚠️ Returns empty array when state is {}
    }
    // ... filtering logic
};
```

## Data Flow Diagram

```
[main.js] plugins.getLibrary()
    ↓
[plugins.js] registryLoader.getLibrary()
    ↓
[registry.js] loadRegistry()
    ↓ (FAILS - no registry file)
    ↓
[registry.js] getFallbackRegistry() (development mode only)
    ↓ (NOT CALLED - likely not in development mode)
    ↓
[plugins.js] callback(error, null)
    ↓
[main.js] console.log error, RETURNS (no state update)
    ↓
[Redux] pluginLibrary state remains {} (empty initial state)
    ↓
[Marketplace.js] getFilteredPlugins() returns [] (empty array)
    ↓
[UI] Shows "No plugins found"
```

## Issues Summary

### 1. Missing Registry File
- **File:** `/mnt/ai/automate/automate/registry/plugins.json`
- **Status:** Does not exist
- **Expected Path:** Calculated as `path.join(__dirname, '../../registry/plugins.json')` from `/mnt/ai/automate/automate/app/registry.js`

### 2. Silent Failure on Error
- **Location:** `/mnt/ai/automate/automate/app/main.js` line 162
- **Issue:** When `plugins.getLibrary()` fails, error is logged but:
  - No fallback data is provided
  - Redux state is never initialized
  - Marketplace receives empty `pluginLibrary` object

### 3. Environment Mode Detection
- **Issue:** Code may not be detecting development mode correctly
- **Code:** `this.developmentMode = options.developmentMode || process.env.NODE_ENV === 'development'`
- **Impact:** Fallback registry not used even in development

### 4. No Default/Fallback Data in Production
- **Issue:** If registry loading fails in production mode, there's no fallback
- **Impact:** Marketplace shows empty even if hardcoded plugins exist in code

## Console Output Analysis

**Expected to see:**
```
[Plugins] Loading library from registry...
[Registry] Registry file not found at /mnt/ai/automate/automate/registry/plugins.json
[Plugins] Error loading library from registry: Error: Registry file not found...
plugins.getLibrary Error: Registry file not found...
```

**What happens:**
1. Error logged to console
2. Callback returns with error
3. `actions.libraryReplace()` never called
4. Redux state `pluginLibrary` remains `{}`
5. Marketplace renders with empty data

## Required Debugging Steps

### 1. Check Console Logs
Look for these specific messages in the Electron console:
```javascript
'[Plugins] Loading library from registry...'
'[Registry] Registry file not found at...'
'plugins.getLibrary' // followed by error object
```

### 2. Check Redux State
Use Redux DevTools or add logging:
```javascript
// In childStore.js after store creation
console.log('Initial Redux State:', store.getState());
store.subscribe(() => {
    const state = store.getState();
    console.log('pluginLibrary state:', state.pluginLibrary);
    console.log('marketplace state:', state.marketplace);
});
```

### 3. Check Environment Mode
Add logging to verify mode detection:
```javascript
// In plugins.js constructor
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Development mode:', this.developmentMode);
```

## Solutions

### Solution 1: Create Registry File (Quick Fix)
Create the missing registry directory and file with sample data:

```bash
mkdir -p /mnt/ai/automate/automate/registry
```

Create `/mnt/ai/automate/automate/registry/plugins.json`:
```json
{
  "version": "1.0.0",
  "lastUpdated": "2024-12-24T00:00:00Z",
  "plugins": [
    {
      "id": "@allow2/allow2automate-wemo",
      "name": "allow2automate-wemo",
      "publisher": "allow2",
      "version": "0.0.4",
      "description": "Enable Allow2Automate the ability to control wemo devices",
      "category": "automation",
      "verified": true
    }
  ]
}
```

### Solution 2: Add Fallback in Main Process
Modify `/mnt/ai/automate/automate/app/main.js` to provide fallback data on error:

```javascript
plugins.getLibrary((err, pluginLibrary) => {
    if (err) {
        console.log('plugins.getLibrary error:', err);
        // Use hardcoded fallback from plugins.js
        const fallbackLibrary = {
            "@allow2/allow2automate-battle.net": { /* ... */ },
            "@allow2/allow2automate-ssh": { /* ... */ },
            "@allow2/allow2automate-wemo": { /* ... */ }
        };
        actions.libraryReplace(fallbackLibrary);
        return;
    }
    actions.libraryReplace(pluginLibrary);
});
```

### Solution 3: Fix Development Mode Detection
Ensure development mode is properly detected:

```javascript
// In app/plugins.js
const registryLoader = createRegistryLoader({
    developmentMode: true, // Force development mode for now
    cacheTTL: 60000
});
```

### Solution 4: Add Debugging Console Logs
Add these console.log statements to track data flow:

```javascript
// In app/main.js line 159
plugins.getLibrary((err, pluginLibrary) => {
    console.log('[Main] plugins.getLibrary callback - err:', err);
    console.log('[Main] plugins.getLibrary callback - library:',
        pluginLibrary ? Object.keys(pluginLibrary) : 'null');
    if (err) {
        console.log('[Main] ERROR - plugins.getLibrary failed:', err);
        return;
    }
    console.log('[Main] Dispatching libraryReplace with:', pluginLibrary);
    actions.libraryReplace(pluginLibrary);
});

// In app/components/Marketplace.js line 81
getFilteredPlugins = () => {
    const { pluginLibrary } = this.props;
    console.log('[Marketplace] getFilteredPlugins - pluginLibrary:', pluginLibrary);
    console.log('[Marketplace] pluginLibrary keys:',
        pluginLibrary ? Object.keys(pluginLibrary) : 'undefined');

    if (!pluginLibrary || Object.keys(pluginLibrary).length === 0) {
        console.log('[Marketplace] No plugins - returning empty array');
        return [];
    }
    // ... rest of method
};

// In app/containers/MarketplacePage.js line 6
const mapStateToProps = (state, ownProps) => {
    console.log('[MarketplacePage] Redux state.pluginLibrary:', state.pluginLibrary);
    return {
        pluginLibrary: state.pluginLibrary,
        // ...
    };
};
```

## Recommended Fix Order

1. **Immediate:** Add console logging to confirm diagnosis
2. **Quick Fix:** Create registry directory and file with sample data
3. **Short Term:** Add fallback data handling in main.js
4. **Long Term:** Implement proper error handling and user feedback

## Files to Modify

1. `/mnt/ai/automate/automate/app/main.js` - Add fallback handling (lines 159-166)
2. `/mnt/ai/automate/automate/app/components/Marketplace.js` - Add debug logging (line 81)
3. `/mnt/ai/automate/automate/app/containers/MarketplacePage.js` - Add debug logging (line 6)
4. Create `/mnt/ai/automate/automate/registry/plugins.json` - New file

## Testing Checklist

- [ ] Check Electron console for error messages
- [ ] Verify Redux DevTools shows pluginLibrary populated
- [ ] Confirm marketplace displays plugins
- [ ] Test search and filter functionality
- [ ] Verify install button functionality
