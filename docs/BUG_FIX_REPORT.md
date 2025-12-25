# Redux State Sync Bug - Root Cause Analysis & Fix

## Problem Summary
Redux reducer receives `pluginLibrary` with 7 plugins in the main process, but the renderer process (MarketplacePage) receives an empty object.

## Root Cause Analysis

### Primary Issue: electron-redux v2 State Synchronization
The bug is caused by **electron-redux v2.0.0** state synchronization issues between main and renderer processes.

**Three Potential Root Causes:**

### 1. Serializer Return Value Bug (MOST LIKELY)
**Location:** `/mnt/ai/automate/automate/app/mainStore.js:31-43`

**The Problem:**
```javascript
// ❌ WRONG - Returns '[EventEmitter]' string instead of undefined
if (typeof value.on === 'function' && typeof value.emit === 'function') {
    return '[EventEmitter]';
}
```

**Why It's Wrong:**
- JSON.stringify replacer functions should return `undefined` to skip a property
- Returning a string `'[EventEmitter]'` creates invalid state
- This could corrupt the entire state tree during serialization

**The Fix:**
```javascript
// ✅ CORRECT - Returns undefined to skip EventEmitters
if (typeof value.on === 'function' && typeof value.emit === 'function') {
    console.log('[Serializer] Skipping EventEmitter for key:', key);
    return undefined; // Skip this property entirely
}
```

### 2. Race Condition: Renderer Loads Before State Sync
**Location:** `/mnt/ai/automate/automate/app/childStore.js:39`

**The Problem:**
```javascript
// Renderer starts with completely empty state
const initialState = {};
```

- MarketplacePage may mount before electron-redux completes state sync
- Component receives empty `pluginLibrary: {}` from initial state
- No loading indicator to wait for sync completion

### 3. localStorage Persistence Issue
**Location:** `/mnt/ai/automate/automate/app/mainStore.js:26`

**The Problem:**
- If `pluginLibrary` is not saved to localStorage, it won't persist between sessions
- Main process loads from localStorage, which might have stale/empty data
- New plugin data is dispatched but not immediately synced to renderer

## Code Flow Analysis

```
┌─────────────────────────────────────────────────────────────┐
│ MAIN PROCESS (mainStore.js)                                 │
├─────────────────────────────────────────────────────────────┤
│ 1. Load from localStorage (line 26)                         │
│    initialState = { pluginLibrary: ??? }                    │
│                                                              │
│ 2. Create store with stateSyncEnhancer                      │
│    - Custom serializer filters EventEmitters                │
│    - BUG: Returns '[EventEmitter]' instead of undefined ❌  │
│                                                              │
│ 3. Async load plugins (main.js:191)                         │
│    - plugins.getLibraryAsync() ✅                           │
│    - Returns 7 plugins ✅                                   │
│                                                              │
│ 4. Dispatch actions.libraryReplace(7 plugins) ✅            │
│    - Reducer updates state correctly ✅                     │
│    - State now has 7 plugins ✅                             │
│                                                              │
│ 5. electron-redux serialization                             │
│    - stateSerializer called for each property               │
│    - BUG: May corrupt state if returning '[EventEmitter]' ❌│
│    - Send serialized state to renderer via IPC              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      ┌───────────────┐
                      │ IPC Sync      │
                      │ (electron-    │
                      │  redux v2)    │
                      └───────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ RENDERER PROCESS (childStore.js)                            │
├─────────────────────────────────────────────────────────────┤
│ 1. Initial state = {} (empty) ❌                            │
│    - No pluginLibrary data                                  │
│                                                              │
│ 2. Create store with stateSyncEnhancer                      │
│    - Waits for IPC sync from main process                   │
│    - BUG: Race condition if MarketplacePage loads first ❌  │
│                                                              │
│ 3. MarketplacePage mounts                                   │
│    - mapStateToProps called                                 │
│    - Receives state.pluginLibrary = {} ❌                   │
│    - Shows "No plugins available"                           │
└─────────────────────────────────────────────────────────────┘
```

## Implemented Fixes

### Fix 1: Correct Serializer Return Value ✅
**File:** `/mnt/ai/automate/automate/app/mainStore.js`

Changed serializer to return `undefined` instead of `'[EventEmitter]'` string:
```javascript
if (typeof value.on === 'function' && typeof value.emit === 'function') {
    return undefined; // Correctly skip EventEmitters
}
```

### Fix 2: Enhanced Debug Logging ✅
Added comprehensive logging to track state flow:

1. **mainStore.js** - Track main process state changes
2. **childStore.js** - Track renderer state updates
3. **reducers/pluginLibrary.js** - Log reducer actions with detailed payload info
4. **main.js** - Verify state after dispatch
5. **MarketplacePage.js** - Already has logging in mapStateToProps

### Fix 3: Reducer Immutability ✅
**File:** `/mnt/ai/automate/automate/app/reducers/pluginLibrary.js`

Ensured reducer returns new object reference:
```javascript
const newState = { ...action.payload };
return newState;
```

## Testing Instructions

### 1. Build and Run
```bash
npm run build
npm start
```

### 2. Check Console Logs
Look for this sequence in the console:

**Main Process Logs:**
```
[MainStore] Initial state keys: [...]
[Main] Starting plugin library load...
[Main] ✅ Loaded 7 plugins from registry
[Main] Plugin library keys: [@allow2/..., @allow2/...]
[Main] Dispatching libraryReplace action...
[Reducer] LIBRARY_REPLACE action fired
[Reducer] Payload keys: 7
[Reducer] Returning newState with keys: 7
[Store] State updated - pluginLibrary has 7 keys
[Main] State after dispatch - pluginLibrary keys: 7
[Serializer] Processing pluginLibrary, value type: object
[Serializer] pluginLibrary keys: 7
```

**Renderer Process Logs:**
```
[ChildStore] pluginLibrary updated, keys: 7
[ChildStore] Sample keys: [@allow2/..., @allow2/..., ...]
[MarketplacePage] mapStateToProps called
[MarketplacePage] pluginLibrary keys: 7
```

### 3. Verify in UI
- Open Marketplace page
- Should see 7 plugins displayed
- No "No plugins available" message

## Possible Remaining Issues

If the bug persists after these fixes, the problem is likely:

### Issue A: electron-redux v2 Alpha Bugs
- electron-redux v2.0.0-alpha.9 may have known serialization bugs
- **Solution:** Upgrade to stable electron-redux v2.0.0 or implement custom IPC sync

### Issue B: localStorage Corruption
- Stored state may have corrupted pluginLibrary data
- **Solution:** Clear localStorage and restart:
  ```bash
  rm -rf ./store
  npm start
  ```

### Issue C: Timing Race Condition
- Renderer mounts before state sync completes
- **Solution:** Add loading state to MarketplacePage:
  ```javascript
  if (!pluginLibrary || Object.keys(pluginLibrary).length === 0) {
      return <CircularProgress />;
  }
  ```

## Files Modified

| File | Purpose | Lines Changed |
|------|---------|---------------|
| `app/mainStore.js` | Fix serializer, add logging | 31-43, 63-71, 29-30 |
| `app/childStore.js` | Add state tracking | 48-58 |
| `app/reducers/pluginLibrary.js` | Enhanced logging, immutability | 6-18 |
| `app/main.js` | Verify state after dispatch | 196-205 |
| `docs/BUG_FIX_REPORT.md` | This documentation | NEW FILE |

## Next Steps

1. **Run the app** with the enhanced logging
2. **Capture the console output** showing the exact state flow
3. **Report back** with:
   - Do the logs show state syncing correctly?
   - Does MarketplacePage receive the plugins?
   - Are there any serializer warnings?
4. **If still failing**, we'll implement one of the fallback solutions (localStorage clear, manual IPC, or loading state)

## Rollback Instructions

If these changes cause issues:
```bash
git checkout app/mainStore.js
git checkout app/childStore.js
git checkout app/reducers/pluginLibrary.js
git checkout app/main.js
```
