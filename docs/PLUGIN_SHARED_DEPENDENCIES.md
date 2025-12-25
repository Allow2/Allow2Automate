# Plugin Shared Dependencies

## Overview

The Allow2Automate host application now provides shared React and Material-UI dependencies to dynamically loaded plugins. This prevents plugins from needing to bundle their own copies of these large dependencies, reducing plugin size and preventing version conflicts.

## Implementation

### 1. Main Process (app/main.js)

The main process configures shared module paths using `Module.globalPaths`:

```javascript
const Module = require('module');

// Get paths to shared dependencies
const reactPath = path.dirname(require.resolve('react'));
const reactDomPath = path.dirname(require.resolve('react-dom'));
const muiCorePath = path.dirname(require.resolve('@material-ui/core'));
const muiIconsPath = path.dirname(require.resolve('@material-ui/icons'));
const reduxPath = path.dirname(require.resolve('redux'));
const reactReduxPath = path.dirname(require.resolve('react-redux'));

// Add to global module resolution paths
const sharedModulePaths = [
    path.join(reactPath, '..'),
    path.join(reactDomPath, '..'),
    path.join(muiCorePath, '..', '..'),
    path.join(reduxPath, '..'),
    path.join(reactReduxPath, '..')
];

sharedModulePaths.forEach(modulePath => {
    if (!Module.globalPaths.includes(modulePath)) {
        Module.globalPaths.push(modulePath);
    }
});
```

### 2. Preload Script (app/preload.js)

The preload script configures the same shared paths for the renderer process:

- Identical configuration to main.js
- Wrapped in try-catch for error handling
- Logs configuration for debugging

### 3. Plugin Loader (app/plugins.js)

The plugin loader uses `Module.wrap` to inject module paths into every loaded module:

```javascript
(function(moduleWrapCopy) {
    Module.wrap = function(script) {
        const pathInjectionScript = [
            `module.paths.push('${ourModulesPath}');`,
            `module.paths.push('${path.join(reactDomPath, '..')}');`,
            // ... more paths
        ].join('');

        script = pathInjectionScript + script;
        return moduleWrapCopy(script);
    };
})(Module.wrap);
```

This ensures that every module loaded by plugins can resolve shared dependencies.

### 4. Plugin Installation (app/containers/MarketplacePage.js)

The npm install command has been updated to remove `--legacy-peer-deps`:

```javascript
// Before:
const npmCommand = `npm install --legacy-peer-deps --prefix "${pluginsDir}" "${installUrl}"`;

// After:
const npmCommand = `npm install --prefix "${pluginsDir}" "${installUrl}"`;
```

This allows npm to properly resolve peer dependencies from the host application.

## Shared Dependencies

The following dependencies are available to all plugins:

### React & UI
- `react` (v16.12.0)
- `react-dom` (v16.12.0)
- `@material-ui/core` (v4.11.3)
- `@material-ui/icons` (v4.11.2)

### State Management
- `redux` (v4.0.0)
- `react-redux` (v5.1.2)
- `redux-actions` (v2.6.5)
- `redux-thunk` (v2.3.0)

### Other
- `prop-types` (v15.7.2)

## Plugin Development Guidelines

### Using Shared Dependencies

Plugins should declare these as **peerDependencies** in their package.json:

```json
{
  "name": "@allow2/my-plugin",
  "version": "1.0.0",
  "peerDependencies": {
    "react": "^16.12.0",
    "react-dom": "^16.12.0",
    "@material-ui/core": "^4.11.3",
    "@material-ui/icons": "^4.11.2",
    "redux": "^4.0.0",
    "react-redux": "^5.1.2"
  },
  "dependencies": {
    // Only plugin-specific dependencies here
  }
}
```

### Example Plugin

```javascript
// plugin.js
const React = require('react');
const { Button } = require('@material-ui/core');
const { connect } = require('react-redux');

function MyPluginComponent() {
    return React.createElement(Button, {
        variant: 'contained',
        color: 'primary'
    }, 'My Plugin');
}

module.exports = {
    plugin: (api) => ({
        onLoad: (state) => {
            console.log('Plugin loaded with shared dependencies!');
        },
        renderComponent: () => MyPluginComponent
    })
};
```

## Troubleshooting

### Module Not Found Errors

If plugins cannot find shared modules:

1. Check console logs in developer tools for module path configuration
2. Verify the plugin's package.json has correct peerDependencies
3. Ensure the host application has the required dependencies installed
4. Try reinstalling the plugin

### Version Conflicts

If you encounter version conflicts:

1. Check that the plugin's peerDependencies match the host versions
2. Update the plugin to be compatible with the host's dependency versions
3. Consider using version ranges in peerDependencies (e.g., `^16.0.0`)

## Benefits

1. **Smaller Plugin Size**: Plugins don't bundle React/Material-UI (can save 1-2MB per plugin)
2. **Faster Installation**: Less code to download and install
3. **Consistent UI**: All plugins use the same React/Material-UI version
4. **No Version Conflicts**: Single source of truth for shared dependencies
5. **Better Performance**: Only one copy of React in memory

## Technical Details

### Module Resolution Order

When a plugin requires a module, Node.js checks:

1. Plugin's own node_modules
2. Injected shared module paths (via Module.wrap)
3. Global module paths (via Module.globalPaths)
4. NODE_PATH environment variable
5. Parent directory node_modules (standard Node.js resolution)

### Electron-Plugin-Manager Integration

The electron-plugin-manager library works seamlessly with this approach because:

1. It uses Node's standard `require()` mechanism
2. Module path injection happens before plugin loading
3. Module.wrap is called for every module load

## Future Enhancements

Consider adding:

1. Version compatibility checking
2. Automated plugin dependency validation
3. Shared dependency version pinning
4. Plugin development CLI with shared deps pre-configured
