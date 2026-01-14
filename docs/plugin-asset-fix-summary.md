# Plugin Asset Path Fix - Summary

## Issue

The wemo plugin was generating invalid image paths like:
```
/Users/andrew/ai/automate/automate/dev-plugins/allow2automate-wemo/dist/index.js/img/wemo_maker.png
```

**Root Cause:** Plugin components were not receiving the plugin directory path, making it impossible to correctly resolve asset paths.

## Solution

### 1. Enhanced Plugin.js (Host App)

**File:** `/mnt/ai/automate/automate/app/components/Plugin.js`

**Changes:**

1. **Added `pluginDir` to component state** (line 91):
```javascript
this.pluginDir = pluginDir;
this.state = {
    hasError: false,
    pluginDir: pluginDir,
    isLoading: true
};
```

2. **Passed `pluginDir` prop to TabContent** (line 311):
```javascript
<TabContent
    plugin={this.props.plugin}
    data={this.props.data}
    children={this.props.children}
    user={this.props.user}
    pluginDir={this.state.pluginDir}
    ipcRenderer={ipcRestricted}
    configurationUpdate={configurationUpdate}
    statusUpdate={statusUpdate}
    persist={persist}
    assign={this.assign.bind(this)}
    allow2={{ avatarURL: allow2AvatarURL }}
/>
```

### 2. Fixed Wemo Plugin TabContent

**File:** `/mnt/ai/automate/automate/dev-plugins/allow2automate-wemo/src/Components/TabContent.js`

**Changes:**

1. **Use `pluginDir` prop** (line 102):
```javascript
const pluginDir = this.props.pluginDir;
```

2. **Fixed image src paths with file:// protocol** (lines 129 and 181):

**Before:**
```javascript
src={ path.join(pluginPath, 'img', imageName + '.png') }
// Result: /path/to/plugin/dist/index.js/img/wemo_maker.png ❌
```

**After:**
```javascript
src={ `file://${path.join(pluginDir, 'img', imageName + '.png')}` }
// Result: file:///path/to/plugin/img/wemo_maker.png ✅
```

### 3. Created Documentation

**File:** `/mnt/ai/automate/automate/docs/plugin-assets.md`

Comprehensive guide covering:
- Plugin asset resolution patterns
- Recommended approaches (pluginDir, base64, CDN)
- Migration guide for existing plugins
- Common pitfalls and best practices
- Complete examples with rollup configuration

## Props Available to Plugin TabContent

| Prop | Type | Description | Usage |
|------|------|-------------|-------|
| `pluginDir` | string | Path to plugin directory | **✅ Use for asset resolution** |
| `plugin` | object | Plugin metadata | General plugin info |
| `data` | object | Plugin state data | Plugin configuration |
| `ipcRenderer` | object | IPC communication | Main ↔ Renderer messaging |
| `configurationUpdate` | function | Update plugin state | Persist configuration |
| `statusUpdate` | function | Update plugin status | Report connection status |

## Testing

Rebuild and test the wemo plugin:

```bash
cd dev-plugins/allow2automate-wemo
npm run build
```

**Verification:**
1. Launch Allow2Automate app
2. Open Wemo plugin configuration tab
3. Wemo device images should now display correctly
4. Check browser console - no more "file not found" errors

## For Other Plugins

All plugins now receive `pluginDir` prop:

```javascript
// In your TabContent component
const pluginDir = this.props.pluginDir;

// Use file:// protocol for images
<img src={`file://${path.join(pluginDir, 'img', 'icon.png')}`} />
```

### Robust Fix (Best Practice)

Install rollup-plugin-url:
```bash
npm install --save-dev @rollup/plugin-url
```

Update rollup.config.js:
```javascript
import url from '@rollup/plugin-url';

export default {
    plugins: [
        url({
            limit: 10 * 1024,  // Inline < 10KB as base64
            include: ['**/*.png', '**/*.jpg', '**/*.svg'],
            emitFiles: true
        }),
        // ... other plugins
    ]
};
```

Import and use:
```javascript
import icon from '../img/icon.png';

function TabContent() {
    return <img src={icon} />; // icon is base64 data URL
}
```

## Files Changed

1. ✅ `/mnt/ai/automate/automate/app/components/Plugin.js` - Added pluginDir prop
2. ✅ `/mnt/ai/automate/automate/dev-plugins/allow2automate-wemo/src/Components/TabContent.js` - Fixed asset paths
3. ✅ `/mnt/ai/automate/automate/dev-plugins/allow2automate-wemo/dist/index.js` - Rebuilt with fix
4. ✅ `/mnt/ai/automate/automate/docs/plugin-assets.md` - Comprehensive documentation
5. ✅ `/mnt/ai/automate/automate/docs/plugin-asset-fix-summary.md` - This summary

## References

- See `/docs/plugin-assets.md` for complete plugin asset handling guide
- Electron file:// protocol: https://www.electronjs.org/docs/latest/api/protocol
- Rollup plugin-url: https://github.com/rollup/plugins/tree/master/packages/url
