# Plugin Icons Guide

## Overview

This guide explains how to add custom icons to your Allow2Automate plugins. Custom icons will appear in the left navigation panel and help users quickly identify your plugin.

## Current Status

**Infrastructure**: ✅ Ready
**Implementation**: 🔄 Pending (uses placeholder icon currently)

All plugins currently display the Material-UI `Extension` icon. Custom icon support is ready to be implemented.

## Where Icons Appear

Plugin icons are displayed in:

1. **Left Navigation Panel**: To the left of the plugin name
2. **Future**: Plugin marketplace, settings page, notifications

## Adding Icons to Your Plugin

### Option 1: Image File (Recommended)

**1. Create Your Icon**

- **Format**: PNG, SVG, or JPG
- **Size**: 48x48px recommended (will be scaled to 24x24px in navigation)
- **Location**: `img/plugin-icon.png` in your plugin directory
- **Transparency**: Use PNG with transparency for best results

**2. Add to package.json**

```json
{
  "name": "@allow2/allow2automate-wemo",
  "version": "0.0.5",
  "icon": "./img/plugin-icon.png",
  "files": [
    "dist",
    "img"
  ]
}
```

**3. Include in Distribution**

Ensure your `files` array in package.json includes the icon directory.

### Option 2: Material-UI Icon Name

Alternatively, reference a Material-UI icon by name:

```json
{
  "name": "@allow2/allow2automate-wemo",
  "icon": "Router",
  "iconType": "material-ui"
}
```

Available icons: https://mui.com/material-ui/material-icons/

### Option 3: Data URL (For Small Icons)

Embed the icon directly as base64:

```json
{
  "name": "@allow2/allow2automate-wemo",
  "icon": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
  "iconType": "data-url"
}
```

## Implementation (For Core Developers)

### Files to Modify

**1. LoggedIn.js** (Main navigation)

```javascript
// app/components/LoggedIn.js

// Add icon resolution helper
const getPluginIcon = (plugin) => {
    const pluginDir = plugin.installation && plugin.installation.local_path
        ? plugin.installation.local_path
        : path.join(pluginsDir, 'node_modules', plugin.name);

    // Check if plugin has custom icon
    if (plugin.icon) {
        if (plugin.iconType === 'material-ui') {
            // Return Material-UI icon component
            const IconComponent = require('@material-ui/icons')[plugin.icon];
            return IconComponent ? <IconComponent /> : <Extension />;
        } else if (plugin.iconType === 'data-url' || plugin.icon.startsWith('data:')) {
            // Data URL
            return <img src={plugin.icon} width={24} height={24} alt="" />;
        } else {
            // File path - resolve relative to plugin directory
            const iconPath = path.join(pluginDir, plugin.icon);
            return <img src={`file://${iconPath}`} width={24} height={24} alt="" />;
        }
    }

    // Fallback to default Extension icon
    return <Extension />;
};

// In the List rendering:
<ListItemIcon>
    {getPluginIcon(plugin)}
</ListItemIcon>
```

**2. Plugin.js** (Pass icon to TabContent)

```javascript
// app/components/Plugin.js

// In constructor, load icon metadata
const iconData = {
    icon: this.props.plugin.icon,
    iconType: this.props.plugin.iconType || 'file'
};

this.state = {
    hasError: false,
    pluginDir: pluginDir,
    iconData: iconData,
    isLoading: true
};

// Pass to TabContent
<TabContent
    plugin={this.props.plugin}
    pluginDir={this.state.pluginDir}
    iconData={this.state.iconData}
    // ... other props
/>
```

**3. Update Plugin Loading** (plugins.js)

```javascript
// app/plugins.js in getInstalled()

const packageJson = JSON.parse(jsonString);
packageJson.name = pluginName;
packageJson.shortName = extractShortName(pluginName);
packageJson.icon = packageJson.icon || null; // ✅ Load icon field
packageJson.iconType = packageJson.iconType || 'file'; // ✅ Load icon type
```

## Icon Guidelines

### Design

- **Simple & Recognizable**: Use clear, simple icons that work at small sizes
- **Consistent Style**: Match Material Design aesthetic
- **Sufficient Contrast**: Ensure icon is visible on light/dark backgrounds
- **Avoid Text**: Icons should be symbols, not words

### Technical

- **File Size**: Keep under 10KB (ideally under 5KB)
- **Format**: PNG with transparency or SVG
- **Resolution**: 48x48px @2x (96x96px physical pixels)
- **Color**: Single color or simple gradient

### Accessibility

- **Alt Text**: Icons are decorative (plugin name provides context)
- **Color Contrast**: Ensure 3:1 minimum contrast ratio
- **Not Sole Indicator**: Icon complements plugin name, not replaces it

## Examples

### Wemo Plugin

```json
{
  "name": "@allow2/allow2automate-wemo",
  "icon": "./img/wemo-icon.png",
  "files": ["dist", "img"]
}
```

Icon file: `/dev-plugins/allow2automate-wemo/img/wemo-icon.png`

### SSH Plugin (Material-UI)

```json
{
  "name": "@allow2/allow2automate-ssh",
  "icon": "Terminal",
  "iconType": "material-ui"
}
```

### Battle.net Plugin (Data URL)

```json
{
  "name": "@allow2/allow2automate-battle.net",
  "icon": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My...",
  "iconType": "data-url"
}
```

## Fallback Behavior

If no icon is specified or icon loading fails:

1. **Primary Fallback**: Material-UI `Extension` icon (current behavior)
2. **By Category**: Future enhancement - default icons by plugin category
   - Devices: `Devices`
   - Services: `Cloud`
   - Automation: `Settings`
   - Games: `SportsEsports`

## Testing Your Icon

1. **Install plugin** with icon field in package.json
2. **Restart app** to reload plugin metadata
3. **Check navigation** - icon should appear to left of plugin name
4. **Browser console** - check for icon loading errors
5. **Different screens** - verify icon scales correctly

## Troubleshooting

### Icon Not Showing

```bash
# Check if icon field is in metadata
grep -A 2 "\"icon\"" dev-plugins/your-plugin/package.json

# Check if icon file exists
ls -la dev-plugins/your-plugin/img/plugin-icon.png

# Check browser console for errors
# Look for: "Failed to load resource: file://..."
```

### Icon Too Large/Small

- Ensure source image is 48x48px
- Use PNG format (not JPG for transparency)
- Check if scaling CSS is applied correctly

### Icon Doesn't Update

```bash
# Clear plugin cache
rm -rf dev-data/store
# Or restart app with cleared cache
```

## Migration Checklist

For existing plugins:

- [ ] Create plugin icon (48x48px PNG)
- [ ] Save to `img/plugin-icon.png`
- [ ] Add `"icon": "./img/plugin-icon.png"` to package.json
- [ ] Add `"img"` to `files` array in package.json
- [ ] Test icon loads correctly
- [ ] Commit and publish update

## Future Enhancements

1. **Icon Themes**: Light/dark mode variants
2. **Animated Icons**: SVG animations for status changes
3. **Badge Overlays**: Notification badges on icons
4. **Custom Colors**: Allow plugins to specify icon color
5. **Icon Packs**: Curated icon sets for common plugin types

## Support

If you need help creating plugin icons:

- **Design Tools**: Figma, Sketch, or https://www.figma.com/community
- **Icon Libraries**: Material Icons, Font Awesome, Feather Icons
- **Conversion**: PNG to SVG - https://convertio.co/png-svg/
- **Optimization**: SVG optimization - https://jakearchibald.github.io/svgomg/

## Related Documentation

- `/docs/plugin-assets.md` - General asset handling
- `/docs/architecture/left-navigation-design.md` - Navigation architecture
- Material-UI Icons: https://mui.com/material-ui/material-icons/
