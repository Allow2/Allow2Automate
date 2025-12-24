# Registry Integration Documentation

## Overview

The automate project now integrates with a centralized plugin registry for dynamic plugin discovery and management. This integration replaces hardcoded plugin definitions with a flexible, registry-based approach.

## Architecture

### Components

1. **Registry Loader** (`app/registry.js`)
   - Loads plugin metadata from `../registry/plugins.json`
   - Implements caching for performance (60-second TTL)
   - Provides fallback data for development mode
   - Handles search, filtering, and plugin discovery

2. **Plugin Manager** (`app/plugins.js`)
   - Updated to use registry loader
   - Maintains backward compatibility
   - Adds new registry-specific methods

### File Structure

```
/mnt/ai/automate/
├── automate/
│   └── app/
│       ├── registry.js          # Registry loader
│       ├── plugins.js           # Plugin manager (updated)
│       └── docs/
│           └── REGISTRY_INTEGRATION.md
└── registry/
    └── plugins.json            # Central plugin registry
```

## Features

### 1. Dynamic Plugin Discovery

Plugins are now loaded from the registry instead of being hardcoded:

```javascript
// Before (hardcoded)
plugins.library = {
    "allow2automate-battle.net": { ... }
};

// After (registry-based)
const library = await registryLoader.getLibrary();
```

### 2. Development Mode Fallback

When `plugins.json` is not available (e.g., during development), the system automatically falls back to hardcoded data:

```javascript
const registryLoader = createRegistryLoader({
    developmentMode: process.env.NODE_ENV === 'development',
    cacheTTL: 60000
});
```

### 3. Caching

Registry data is cached for 60 seconds to improve performance and reduce I/O operations:

- Cache automatically refreshes after TTL expires
- Manual cache bypass available via `reloadRegistry()`

### 4. Search & Filtering

New search capabilities for plugin discovery:

```javascript
plugins.searchRegistry({
    category: 'gaming',
    publisher: 'allow2',
    verified: true,
    sort: 'downloads'
}, callback);
```

## API Reference

### Registry Loader

#### `createRegistryLoader(options)`

Creates a new registry loader instance.

**Options:**
- `registryPath`: Path to plugins.json (default: `../registry/plugins.json`)
- `developmentMode`: Enable fallback mode (default: from NODE_ENV)
- `cacheTTL`: Cache duration in ms (default: 60000)

#### `loadRegistry()`

Loads registry data from file or cache.

**Returns:** Promise<Object> - Registry data with metadata and plugins array

#### `getLibrary()`

Gets plugin library in legacy format for backward compatibility.

**Returns:** Promise<Object> - Plugin library object

#### `searchPlugins(criteria)`

Searches plugins by criteria.

**Criteria:**
- `category`: Filter by category
- `keyword`: Filter by keyword
- `publisher`: Filter by publisher
- `verified`: Filter by verification status
- `sort`: Sort by 'downloads', 'rating', or 'name'

**Returns:** Promise<Array> - Filtered plugins

#### `getPlugin(pluginName)`

Gets details for a specific plugin.

**Returns:** Promise<Object|null> - Plugin details or null

#### `reloadRegistry()`

Reloads registry data, bypassing cache.

**Returns:** Promise<Object> - Fresh registry data

### Plugin Manager (Updated)

#### `plugins.getLibrary(callback)`

**Changed:** Now async, loads from registry
**Signature:** `async function(callback)`
**Callback:** `(error, library) => void`

#### `plugins.searchRegistry(criteria, callback)`

**New:** Search plugins in registry
**Signature:** `async function(criteria, callback)`
**Callback:** `(error, results) => void`

#### `plugins.getPluginDetails(pluginName, callback)`

**New:** Get plugin details from registry
**Signature:** `async function(pluginName, callback)`
**Callback:** `(error, plugin) => void`

#### `plugins.reloadRegistry(callback)`

**New:** Reload registry (bypass cache)
**Signature:** `async function(callback)`
**Callback:** `(error, success) => void`

## Registry Format

### Expected Structure

```json
{
  "metadata": {
    "version": "1.0.0",
    "lastUpdated": "2025-12-23T10:00:00.000Z",
    "totalPlugins": 4
  },
  "plugins": [
    {
      "name": "battle.net",
      "package": "allow2automate-battle.net",
      "version": "1.0.0",
      "description": "Enable Allow2Automate management of WoW parental controls",
      "publisher": "allow2",
      "category": "gaming",
      "keywords": ["allow2automate", "battle.net", "wow"],
      "repository": {
        "type": "git",
        "url": "https://github.com/Allow2/allow2automate-battle.net"
      },
      "main": "./lib/battle.net",
      "verified": true,
      "downloads": 1500,
      "rating": 4.5
    }
  ]
}
```

### Required Fields

Each plugin must have:
- `name`: Plugin identifier
- `version`: Semantic version
- `description`: Plugin description
- `publisher`: Publisher identifier

### Optional Fields

- `package`: NPM package name (defaults to name)
- `category`: Plugin category
- `keywords`: Search keywords array
- `repository`: Repository information
- `main`: Entry point file path
- `verified`: Verification status
- `downloads`: Download count
- `rating`: User rating

## Error Handling

### Missing Registry File

When `plugins.json` is not found:

1. **Development Mode:** Falls back to hardcoded data
2. **Production Mode:** Throws error and fails gracefully

### Invalid Registry Format

Validation checks for:
- Presence of `plugins` array
- Required fields in each plugin entry
- Valid JSON structure

### Network/IO Errors

All errors are caught and logged with context:

```javascript
try {
    const library = await registryLoader.getLibrary();
} catch (error) {
    console.error('[Registry] Error loading registry:', error);
    // Fallback or error handling
}
```

## Usage Examples

### Loading Plugin Library

```javascript
// Traditional callback style (backward compatible)
plugins.getLibrary((error, library) => {
    if (error) {
        console.error('Failed to load library:', error);
        return;
    }
    console.log('Available plugins:', Object.keys(library));
});
```

### Searching Plugins

```javascript
// Find gaming plugins by allow2
plugins.searchRegistry({
    category: 'gaming',
    publisher: 'allow2',
    sort: 'downloads'
}, (error, results) => {
    if (error) {
        console.error('Search failed:', error);
        return;
    }
    console.log('Found plugins:', results);
});
```

### Getting Plugin Details

```javascript
// Get details for specific plugin
plugins.getPluginDetails('battle.net', (error, plugin) => {
    if (error) {
        console.error('Failed to get plugin:', error);
        return;
    }
    console.log('Plugin info:', plugin);
});
```

### Manual Registry Reload

```javascript
// Force reload registry (bypass cache)
plugins.reloadRegistry((error, success) => {
    if (error) {
        console.error('Reload failed:', error);
        return;
    }
    console.log('Registry reloaded successfully');
});
```

## Migration Guide

### For Developers

1. **No changes required** for existing code using `plugins.getLibrary()`
2. **Optional**: Use new search methods for advanced filtering
3. **Optional**: Call `reloadRegistry()` when registry updates

### For Plugin Authors

1. Ensure plugin metadata is registered in `../registry/plugins.json`
2. Include all required fields (name, version, description, publisher)
3. Add optional metadata for better discovery (category, keywords, rating)

## Testing

### Manual Testing

```bash
# Test registry loading
node -e "
const { createRegistryLoader } = require('./app/registry');
const loader = createRegistryLoader({ developmentMode: true });
loader.getLibrary().then(lib => console.log(lib));
"

# Test search functionality
node -e "
const { createRegistryLoader } = require('./app/registry');
const loader = createRegistryLoader({ developmentMode: true });
loader.searchPlugins({ category: 'gaming' }).then(r => console.log(r));
"
```

### Development Mode

Set `NODE_ENV=development` to enable fallback data when registry is unavailable:

```bash
NODE_ENV=development npm run develop
```

## Performance

### Caching Strategy

- **Cache Duration:** 60 seconds (configurable)
- **Cache Bypass:** Available via `reloadRegistry()`
- **Memory Impact:** Minimal (~1-5KB for typical registry)

### Optimization Tips

1. Adjust cache TTL based on update frequency
2. Use search/filter methods to reduce data transfer
3. Monitor registry file size (recommend <100KB)

## Troubleshooting

### Common Issues

**Issue:** "Registry file not found"
- **Solution:** Ensure `../registry/plugins.json` exists or enable development mode

**Issue:** "Invalid registry format"
- **Solution:** Validate JSON structure and ensure `plugins` array exists

**Issue:** "Plugin not found"
- **Solution:** Check plugin name matches registry entry and cache is fresh

### Debug Logging

Enable detailed logging:

```javascript
console.log('[Registry] Loading from:', registryLoader.registryPath);
console.log('[Registry] Cache status:', {
    cached: !!registryLoader.cache,
    age: Date.now() - registryLoader.cacheTimestamp
});
```

## Future Enhancements

Planned features:
- [ ] Remote registry support (HTTP/HTTPS)
- [ ] Registry versioning and migrations
- [ ] Plugin dependency resolution
- [ ] Automatic updates and notifications
- [ ] Registry validation tools
- [ ] Plugin signing and verification

## Contributing

When modifying registry integration:

1. Maintain backward compatibility
2. Update documentation
3. Add tests for new features
4. Follow existing code style
5. Update CHANGELOG

## License

Same as parent project (CUSTOM).
