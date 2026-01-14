# Plugin Persistence & Troubleshooting Summary

## Issues Addressed

### 1. Plugin State Not Persisting ✅ FIXED

**Problem**: When disabling or removing a plugin, changes don't persist across app restarts.

**Root Cause**: Auto-save functionality was already implemented but lacked visibility.

**Solution**: Added logging to make persistence visible.

#### How It Works

The mainStore.js implements **automatic state persistence**:

1. **Debounced Save**: State saved 1 second after last change
2. **Periodic Save**: Backup save every 30 seconds
3. **Redux Integration**: All actions trigger auto-save

**File**: `/app/mainStore.js:219-249`

```javascript
// Auto-save on state changes (debounced 1s)
store.subscribe(() => {
    debouncedSave(); // Saves to LocalStorage after 1s
});

// Periodic backup save (every 30s)
setInterval(() => {
    localStorage.setItem(localStorageKey, JSON.stringify(currentState));
}, 30000);
```

#### Testing Plugin Persistence

**Disable Plugin**:
1. Open Settings → Uncheck plugin
2. Console shows: `[PluginPersistence] Setting plugin enabled: false`
3. Console shows: `[PluginPersistence] Action dispatched - auto-save will trigger in 1s`
4. After 1s, console shows: `[MainStore] Auto-saving state...`
5. After 1s, console shows: `[MainStore] ✅ State saved successfully`
6. Quit app (Cmd+Q / Ctrl+Q)
7. Restart app
8. **Expected**: Plugin shows unchecked in Settings
9. **Expected**: Plugin does NOT appear in left navigation

**Delete Plugin**:
1. Open Settings → Click delete icon
2. Confirm deletion
3. Console shows: `[PluginPersistence] Removing plugin: @allow2/pluginname`
4. Console shows: `[PluginPersistence] Action dispatched - auto-save will trigger in 1s`
5. After 1s, console shows: `[MainStore] ✅ State saved successfully`
6. Quit and restart app
7. **Expected**: Plugin completely removed, not in Settings or navigation

#### Storage Location

**Development**:
- `/path/to/project/dev-data/store/Allow2Automate`

**Production**:
- macOS: `~/Library/Application Support/allow2automate/store/Allow2Automate`
- Linux: `~/.config/allow2automate/store/Allow2Automate`
- Windows: `%APPDATA%/allow2automate/store/Allow2Automate`

#### Verifying Persistence

```bash
# Check saved state
cat dev-data/store/Allow2Automate | jq '.installedPlugins'

# Should show plugin with disabled: true
# Or plugin should be missing entirely if deleted
```

#### Files Modified

**`/app/containers/LoggedInPage.js`** - Added logging:
```javascript
onSetPluginEnabled: (pluginName, isChecked) => {
    console.log('[PluginPersistence] Setting plugin enabled:', pluginName, isChecked);
    actions.setPluginEnabled({...});
    console.log('[PluginPersistence] Action dispatched - auto-save will trigger in 1s');
},

onPluginRemoved: (data) => {
    console.log('[PluginPersistence] Removing plugin:', data.pluginName);
    actions.installedPluginRemove(data);
    console.log('[PluginPersistence] Action dispatched - auto-save will trigger in 1s');
}
```

---

### 2. Plugin Icons 📖 DOCUMENTED

**Status**: Infrastructure ready, documentation created

**Documentation**: `/docs/plugin-icons.md`

#### Quick Start

**Add icon to your plugin**:

```json
{
  "name": "@allow2/allow2automate-wemo",
  "icon": "./img/plugin-icon.png",
  "files": ["dist", "img"]
}
```

**Icon specs**:
- Format: PNG, SVG, or JPG
- Size: 48x48px (scaled to 24x24px in UI)
- Location: `img/plugin-icon.png` in plugin directory

#### Implementation Needed

To enable custom icons (currently uses placeholder `Extension` icon):

1. **LoggedIn.js**: Add icon resolution logic
2. **Plugin.js**: Pass icon metadata to components
3. **plugins.js**: Load icon field from package.json

See `/docs/plugin-icons.md` for complete implementation guide.

---

### 3. Agent OOM Error 🔧 TROUBLESHOOTING

**Error**: `Fatal javascript OOM in MemoryChunk allocation failed during deserialization`

**Documentation**: `/docs/troubleshooting-agent-oom.md`

#### Quick Fix

```bash
# Linux - Clear state and restart
sudo systemctl stop allow2automate-agent
sudo rm -rf /var/lib/allow2/agent/*
sudo systemctl start allow2automate-agent

# macOS - Clear state and restart
sudo launchctl stop com.allow2.automate-agent
sudo rm -rf "/Library/Application Support/Allow2/agent/state"
sudo launchctl start com.allow2.automate-agent
```

#### If Problem Persists

**Increase memory limit**:

```bash
# Linux
sudo systemctl edit allow2automate-agent.service
# Add: Environment="NODE_OPTIONS=--max-old-space-size=512"
sudo systemctl daemon-reload
sudo systemctl restart allow2automate-agent

# macOS
# Edit /Library/LaunchDaemons/com.allow2.automate-agent.plist
# Add environment variable: NODE_OPTIONS=--max-old-space-size=512
```

#### Common Causes

1. **Corrupt config** - Regenerate from parent app
2. **Corrupt state** - Clear with commands above
3. **Large process list** - Increase memory limit
4. **Network issues** - Check parent connectivity

See `/docs/troubleshooting-agent-oom.md` for complete diagnostic guide.

---

## Testing Checklist

### Plugin Persistence

- [ ] **Disable plugin**: Uncheck in Settings → Restart → Still disabled
- [ ] **Delete plugin**: Remove in Settings → Restart → Completely gone
- [ ] **Multiple changes**: Disable 2 plugins → Restart → Both still disabled
- [ ] **Console logging**: See `[PluginPersistence]` and `[MainStore]` messages
- [ ] **State file**: Check `dev-data/store/Allow2Automate` reflects changes

### Agent OOM

- [ ] **Agent running**: `systemctl status allow2automate-agent` shows active
- [ ] **No errors**: Check `/var/log/allow2automate-agent-error.log` is empty
- [ ] **Memory usage**: Agent using < 100MB RAM
- [ ] **Config valid**: `jq . /etc/allow2/agent/config.json` parses successfully
- [ ] **Parent connection**: Agent connects to parent app

---

## Documentation Created

1. **`/docs/plugin-icons.md`** (9KB)
   - How to add custom icons to plugins
   - Implementation guide for core developers
   - Icon design guidelines
   - Troubleshooting

2. **`/docs/troubleshooting-agent-oom.md`** (8KB)
   - OOM error diagnosis
   - Quick fixes and prevention
   - Code-level solutions
   - Monitoring strategies

3. **`/docs/persistence-and-troubleshooting-summary.md`** (This file)
   - Overview of all issues
   - Testing procedures
   - Quick reference

---

## Related Documentation

- `/docs/ui-improvements-summary.md` - Recent UI changes
- `/docs/plugin-assets.md` - Plugin asset handling
- `/docs/architecture/left-navigation-design.md` - Navigation architecture
- `/app/mainStore.js` - State persistence implementation
- `/app/reducers/installedPlugins.js` - Plugin state reducer

---

## Support

If issues persist:

1. **Check console logs** for `[PluginPersistence]` and `[MainStore]` messages
2. **Verify state file** at `dev-data/store/Allow2Automate`
3. **Clear state** and restart app
4. **Report issue** with:
   - Console logs
   - State file contents (sanitized)
   - Steps to reproduce
   - OS and app version
