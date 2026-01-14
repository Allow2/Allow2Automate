# Plugin Asset Management

## Overview

This document explains how plugins should package and reference static assets (images, CSS, fonts, etc.) in the Allow2Automate platform.

## The Problem

Plugins are dynamically loaded at runtime, and their assets need to be accessible from both:
- **Main Process** (Node.js environment)
- **Renderer Process** (Chromium/Electron browser environment)

Asset paths must work across different installation scenarios:
- Development plugins (local file paths)
- Installed plugins (in node_modules)
- Different platforms (Windows, macOS, Linux)

## Current Architecture

### Plugin Loading

When a plugin is loaded:

1. **Main Process** (plugins.js):
   - Plugin main process code is loaded via `require(fullPath)`
   - `fullPath` = `/path/to/plugins/node_modules/@allow2/allow2automate-wemo/`

2. **Renderer Process** (Plugin.js):
   - Plugin UI component (TabContent) is loaded dynamically
   - `pluginPath` prop is passed to TabContent
   - `pluginDir` contains the plugin directory
   - `pluginPath` contains the full path to entry point (e.g., `dist/index.js`)

### Available Props in TabContent

Your TabContent component receives these props:

```javascript
<TabContent
    plugin={this.props.plugin}           // Plugin metadata
    data={this.props.data}               // Plugin state data
    pluginDir={this.props.pluginDir}     // ✅ Plugin directory path for assets
    ipcRenderer={ipcRestricted}          // IPC communication
    configurationUpdate={...}            // State updates
    // ... other props
/>
```

## Asset Resolution Patterns

### Pattern 1: Using pluginDir (Recommended)

**RECOMMENDED:** Always use `pluginDir` prop for asset paths.

```javascript
// ✅ CORRECT: Use pluginDir prop
import React from 'react';
import path from 'path';

function TabContent({ pluginDir }) {
    const imagePath = path.join(pluginDir, 'img', 'device.png');

    return (
        <img src={`file://${imagePath}`} alt="Device" />
    );
}
```

**File Protocol:** In Electron renderer, always use `file://` protocol for local files:

```javascript
<img src={`file://${absolutePath}`} />
```

### Pattern 2: Base64 Data URLs (Best for Small Assets)

Bundle assets as base64-encoded data URLs using rollup plugins. This eliminates path resolution issues entirely.

**Install rollup plugin:**
```bash
npm install --save-dev @rollup/plugin-url
```

**Configure rollup.config.js:**
```javascript
import url from '@rollup/plugin-url';

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/index.js',
        format: 'cjs'
    },
    plugins: [
        url({
            // Inline files smaller than 10kb as base64
            limit: 10 * 1024,
            include: ['**/*.png', '**/*.jpg', '**/*.svg'],
            emitFiles: true,
            fileName: 'assets/[name][extname]'
        }),
        // ... other plugins
    ]
};
```

**Use in your code:**
```javascript
import wemoMaker from '../img/wemo_maker.png';

function TabContent() {
    return (
        // wemoMaker is now a data URL: "data:image/png;base64,..."
        <img src={wemoMaker} alt="Wemo Maker" />
    );
}
```

**Pros:**
- No path resolution needed
- Works across all platforms
- Assets bundled in single file

**Cons:**
- Increases bundle size (base64 is ~33% larger)
- Not ideal for large images (> 50KB)

### Pattern 3: Copy Assets During Build

Copy assets to dist folder and reference relatively.

**Install rollup plugin:**
```bash
npm install --save-dev rollup-plugin-copy
```

**Configure rollup.config.js:**
```javascript
import copy from 'rollup-plugin-copy';

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/index.js',
        format: 'cjs'
    },
    plugins: [
        copy({
            targets: [
                { src: 'img/*', dest: 'dist/img' }
            ]
        }),
        // ... other plugins
    ]
};
```

**Package.json files field:**
```json
{
    "files": [
        "dist/**/*"
    ]
}
```

**Use in code:**
```javascript
import path from 'path';

function TabContent({ pluginDir }) {
    // Assets are in dist/img/
    const imagePath = path.join(pluginDir, 'dist', 'img', 'device.png');
    return <img src={`file://${imagePath}`} />;
}
```

### Pattern 4: External CDN URLs

For common icons/images, use external CDN URLs:

```javascript
function TabContent() {
    return (
        <img
            src="https://cdn.example.com/devices/wemo-maker.png"
            alt="Wemo Maker"
        />
    );
}
```

**Pros:**
- No bundling needed
- Shared caching

**Cons:**
- Requires internet connection
- External dependency

## Recommended Approach by Asset Type

| Asset Type | Recommended Pattern | Alternative |
|------------|-------------------|-------------|
| Icons (< 10KB) | Base64 Data URLs | pluginDir + file:// |
| Images (10-50KB) | Base64 Data URLs | pluginDir + file:// |
| Images (> 50KB) | Copy to dist + pluginDir | CDN URLs |
| CSS Files | Base64 or Copy to dist | Inline in component |
| Fonts | Copy to dist + pluginDir | CDN URLs |

## Complete Example: Wemo Plugin Fix

### Implementation

**TabContent.js:**
```javascript
import path from 'path';

function TabContent({ pluginDir, /* ...other props */ }) {
    const imageName = 'wemo_maker';
    const imagePath = path.join(pluginDir, 'img', imageName + '.png');

    return (
        <img
            width="40"
            height="40"
            src={`file://${imagePath}`}
            alt={imageName}
        />
    );
}
```

### Alternative: Use Base64 (Recommended for small images)

**rollup.config.js:**
```javascript
import url from '@rollup/plugin-url';

export default {
    input: 'src/index.js',
    output: [
        { file: 'dist/index.js', format: 'cjs' },
        { file: 'dist/index.mjs', format: 'es' }
    ],
    plugins: [
        url({
            limit: 10 * 1024,  // 10KB limit
            include: ['**/*.png', '**/*.jpg', '**/*.svg'],
            emitFiles: true
        }),
        // ... other plugins
    ]
};
```

**constants.js:**
```javascript
import wemoMaker from '../img/wemo_maker.png';
import wemoSwitch from '../img/wemo_switch.png';

export const deviceImages = {
    'Maker': wemoMaker,
    'Switch': wemoSwitch,
    // ... other devices
};
```

**TabContent.js:**
```javascript
import { deviceImages } from '../constants';

function TabContent() {
    const imageName = 'Maker';
    const imageDataUrl = deviceImages[imageName];

    return (
        <img
            width="40"
            height="40"
            src={imageDataUrl}  // ✅ Data URL, no path needed
            alt={imageName}
        />
    );
}
```

## Plugin Development

### Using pluginDir for Assets

```javascript
// TabContent.js
import path from 'path';

function TabContent({ pluginDir }) {
    // Direct file path with file:// protocol
    const imagePath = path.join(pluginDir, 'img', 'icon.png');

    return (
        <img src={`file://${imagePath}`} alt="Icon" />
    );
}
```

## Best Practices

1. **Always use `pluginDir` prop for file path resolution**
2. **Use `file://` protocol for local file URLs in Electron**
3. **Prefer base64 data URLs for small assets (< 10KB)**
4. **Test assets on all platforms (Windows, macOS, Linux)**
5. **Include all asset directories in package.json `files` field**
6. **Document asset requirements in plugin README**

## Common Pitfalls

### ❌ Absolute paths without file:// protocol
```javascript
// WRONG: Browser won't load local files without file:// protocol
<img src="/Users/user/plugins/wemo/img/icon.png" />
```

### ❌ Relative paths from dist/
```javascript
// WRONG: Relative paths don't work in dynamically loaded modules
<img src="./img/icon.png" />
```

### ✅ Correct patterns
```javascript
// CORRECT: pluginDir + file:// protocol
<img src={`file://${path.join(pluginDir, 'img', 'icon.png')}`} />

// CORRECT: Base64 data URL
import icon from '../img/icon.png';
<img src={icon} />
```

## Testing Your Plugin Assets

1. **Development Mode:** Test with local plugin path
2. **Installed Mode:** Test after `npm install` in plugins directory
3. **Cross-Platform:** Test on Windows, macOS, and Linux
4. **Packaged App:** Test in built Electron app (not just dev mode)

## Support

If you encounter asset loading issues:

1. Check browser console for file:// protocol errors
2. Verify paths with `console.log(pluginDir, pluginPath)`
3. Inspect rollup build output in `dist/`
4. Check package.json `files` field includes assets

## References

- [Electron File Protocol](https://www.electronjs.org/docs/latest/api/protocol#protocolregisterfileprotocolscheme-handler)
- [Rollup Plugin URL](https://github.com/rollup/plugins/tree/master/packages/url)
- [Rollup Plugin Copy](https://github.com/vladshcherbin/rollup-plugin-copy)
