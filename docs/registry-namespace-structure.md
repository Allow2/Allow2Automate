# Registry Namespace Structure

## Overview

The plugin registry now supports a namespace-based folder structure for better organization and scalability. Plugins are organized under namespace directories (e.g., `@allow2/`, `@thirdparty/`) within the `registry/plugins/` folder.

## Directory Structure

```
/mnt/ai/automate/registry/
├── plugins.json                    # Master index with references
├── schema.json                     # JSON schema for validation
└── plugins/                        # Namespace directories
    ├── @allow2/                   # Allow2 official plugins
    │   ├── allow2automate-battle.net.json
    │   ├── allow2automate-ssh.json
    │   ├── allow2automate-wemo.json
    │   ├── allow2automate-playstation.json
    │   ├── allow2automate-cmd.json
    │   ├── allow2automate-plugin.json
    │   └── allow2automate-safefamily.json
    └── @thirdparty/               # Third-party plugins (future)
        └── [plugin-files.json]
```

## Master Registry Format (plugins.json)

The master `plugins.json` file now includes references to namespace plugin files:

```json
{
  "$schema": "./schema.json",
  "version": "1.0.0",
  "lastUpdated": "2025-12-23T10:18:00Z",
  "plugins": [
    {
      "id": "allow2automate-wemo",
      "name": "@allow2/allow2automate-wemo",
      "namespace": "@allow2",
      "pluginFile": "plugins/@allow2/allow2automate-wemo.json",
      "version": "0.0.4",
      "description": "...",
      // ... rest of plugin metadata
    }
  ],
  "namespaces": {
    "@allow2": {
      "name": "Allow2",
      "description": "Official Allow2 plugins",
      "homepage": "https://github.com/Allow2",
      "totalPlugins": 7
    }
  },
  "metadata": {
    "totalPlugins": 7,
    "totalNamespaces": 1,
    "namespaceOrganization": {
      "enabled": true,
      "structure": "plugins/@namespace/plugin-name.json"
    }
  }
}
```

## New Registry Loader Features

### 1. Namespace Scanning

The registry loader automatically scans namespace directories and loads individual plugin JSON files:

```javascript
// Automatically scans plugins/@allow2/, plugins/@thirdparty/, etc.
const registry = await registryLoader.loadRegistry();
```

### 2. Load Plugin by Namespace

Load a specific plugin by its full namespace identifier:

```javascript
// From plugins.js
plugins.loadPluginByNamespace('@allow2/allow2automate-wemo', (err, plugin) => {
    if (err) {
        console.error('Failed to load plugin:', err);
        return;
    }
    console.log('Loaded plugin:', plugin);
});
```

### 3. Merge Strategy

Plugins from namespace directories override master registry entries with the same ID:

- Master registry provides base metadata
- Namespace files provide detailed, up-to-date information
- Namespace versions take precedence when conflicts exist

### 4. Orphan Detection

Find plugins in namespace folders that aren't referenced in the master registry:

```javascript
plugins.findOrphanedPlugins((err, orphans) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log('Orphaned plugins:', orphans);
    // [{ id, name, file, namespace }]
});
```

## Error Handling

The loader includes robust error handling:

1. **Missing Namespace Directories**: Gracefully handled, logs warning
2. **Invalid Plugin Files**: Skipped with warning, doesn't fail entire load
3. **Namespace Mismatches**: Warns when plugin is in wrong namespace folder
4. **Missing Required Fields**: Validates `id`, `name`, `version` fields

## Backward Compatibility

The implementation maintains full backward compatibility:

1. **Flat Structure Support**: Still works if no namespace folders exist
2. **Legacy Methods**: All existing `plugins.getLibrary()` methods work unchanged
3. **Master-Only Mode**: If namespace folders don't exist, only master registry is used
4. **Gradual Migration**: Plugins can be migrated to namespaces incrementally

## Usage Examples

### Load All Plugins (including namespaced)

```javascript
// In app/main.js or elsewhere
plugins.getLibrary((err, pluginLibrary) => {
    if (err) {
        console.error('Error loading plugins:', err);
        return;
    }
    // pluginLibrary includes both master and namespaced plugins
    console.log(`Loaded ${Object.keys(pluginLibrary).length} plugins`);
});
```

### Search Plugins by Namespace

```javascript
plugins.searchRegistry({
    publisher: 'allow2',
    category: 'iot'
}, (err, results) => {
    if (err) {
        console.error('Search failed:', err);
        return;
    }
    console.log('Found plugins:', results);
});
```

### Reload Registry (Clear Cache)

```javascript
plugins.reloadRegistry((err, success) => {
    if (err) {
        console.error('Reload failed:', err);
        return;
    }
    console.log('Registry reloaded successfully');
});
```

## File Paths Reference

### Updated Files

1. **app/registry.js** (Lines 1-321)
   - Added `pluginsDir` path (line 19)
   - Added `pluginFileCache` (line 24)
   - Updated `loadRegistry()` with namespace support (lines 27-85)
   - Added `loadNamespacedPlugins()` (lines 87-122)
   - Added `loadNamespaceDirectory()` (lines 124-160)
   - Added `loadPluginFile()` (lines 162-195)
   - Added `loadPlugin()` method (lines 197-233)
   - Added `mergePlugins()` (lines 235-260)
   - Added `extractNamespace()` (lines 262-271)
   - Added `extractPluginName()` (lines 273-285)
   - Added `findOrphanedPlugins()` (lines 287-321)
   - Updated `reloadRegistry()` to clear plugin cache (line 440)

2. **app/plugins.js** (Lines 242-276)
   - Added `loadPluginByNamespace()` method (lines 242-261)
   - Added `findOrphanedPlugins()` method (lines 263-276)

3. **registry/plugins.json**
   - Added `namespace` field to each plugin
   - Added `pluginFile` field pointing to namespace location
   - Added `namespaces` section with namespace metadata
   - Added `metadata.namespaceOrganization` section

## Validation

The namespace structure validates:

1. **Plugin ID**: Must be unique across all namespaces
2. **Namespace Match**: Plugin name should match containing namespace folder
3. **Required Fields**: Each plugin file must have `id`, `name`, `version`
4. **JSON Format**: All plugin files must be valid JSON

## Best Practices

1. **Naming Convention**: Plugin files should match their ID
   - Example: `allow2automate-wemo.json` for ID `allow2automate-wemo`

2. **Namespace Folders**: Use organization/publisher namespaces
   - Official: `@allow2/`
   - Third-party: `@thirdparty/`, `@community/`
   - Enterprise: `@company-name/`

3. **Master Registry**: Keep master registry lightweight
   - Reference namespace files via `pluginFile` field
   - Include only essential metadata in master registry

4. **Version Control**: Namespace folders make it easier to:
   - Track individual plugin changes
   - Review plugin updates independently
   - Manage plugin ownership and permissions

## Migration Guide

To migrate existing plugins to namespace structure:

1. Create namespace directory: `mkdir -p registry/plugins/@allow2`
2. Move plugin JSON to namespace: Individual plugin files
3. Update master registry with `namespace` and `pluginFile` fields
4. Test with `plugins.getLibrary()` to ensure backward compatibility
5. Verify with `plugins.findOrphanedPlugins()` for consistency

## Performance

The namespace structure provides:

- **Lazy Loading**: Individual plugins can be loaded on-demand
- **Caching**: Plugin files are cached separately from master registry
- **Parallel Loading**: Multiple namespaces can be scanned in parallel
- **Reduced Memory**: Only needed plugins loaded into memory

## Future Enhancements

Planned features for namespace support:

1. **Namespace Permissions**: Role-based access per namespace
2. **Auto-Discovery**: Automatic namespace detection and registration
3. **Remote Namespaces**: Load plugins from remote namespace sources
4. **Namespace Versioning**: Support multiple versions per namespace
5. **Plugin Dependencies**: Cross-namespace dependency resolution
