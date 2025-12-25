# Plugin Compliance Validation System

## Overview

The plugin compliance validation system ensures that all plugins in the Allow2Automate ecosystem follow best practices for dependency management, particularly regarding React and Material-UI dependencies.

## Why Compliance Matters

### The Problem

When plugins bundle React and Material-UI in their `dependencies` instead of `peerDependencies`, it leads to:

1. **Multiple React instances** - Different versions of React running simultaneously
2. **Invalid hook calls** - React hooks fail when multiple React instances exist
3. **Increased bundle size** - Duplicate libraries in the final build
4. **Version conflicts** - Different plugins may bundle different React/Material-UI versions

### The Solution

Plugins should declare React and Material-UI as `peerDependencies`:

```json
{
  "peerDependencies": {
    "react": "^16.12.0",
    "react-dom": "^16.12.0",
    "@material-ui/core": "^4.11.3"
  }
}
```

This tells npm/yarn: "I need these packages, but I'll use the versions provided by the host application."

## Validation Rules

### Critical Issues (Non-Compliant)

The validator checks for these issues that mark a plugin as **non-compliant**:

1. ✗ `react` in `dependencies` (should be in `peerDependencies`)
2. ✗ `react-dom` in `dependencies` (should be in `peerDependencies`)
3. ✗ `@material-ui/core` in `dependencies` (should be in `peerDependencies`)
4. ✗ `@mui/material` in `dependencies` (should be in `peerDependencies`)
5. ✗ `@material-ui/icons` in `dependencies` (should be in `peerDependencies`)
6. ✗ `@mui/icons-material` in `dependencies` (should be in `peerDependencies`)

### Warnings (Review Recommended)

These issues generate warnings but don't mark the plugin as non-compliant:

1. ⚠ Missing `react` in `peerDependencies` for React-based plugins
2. ⚠ `redux` in `dependencies` (consider `peerDependencies` if extending host store)
3. ⚠ `react-redux` in `dependencies` (consider `peerDependencies`)

## Compliance Schema

Each plugin in the registry now includes a `compliance` field:

```javascript
{
  name: "my-plugin",
  version: "1.0.0",
  // ... other fields ...
  compliance: {
    compliant: true,           // true, false, or null (unknown)
    validationErrors: [],      // Array of critical issues
    validationWarnings: [],    // Array of warnings
    lastChecked: "2025-12-24T..." // ISO timestamp
  }
}
```

### Compliance States

- **`compliant: true`** - Plugin follows all best practices
- **`compliant: false`** - Plugin has critical dependency issues
- **`compliant: null`** - No package.json found, unable to validate

## Using the Validation System

### Automatic Validation

Validation happens automatically when plugins are loaded:

```javascript
import RegistryLoader from './app/registry.js';

const registry = new RegistryLoader();
const library = await registry.getLibrary();

// Each plugin now has compliance metadata
library['@allow2/my-plugin'].compliance
// => { compliant: true, validationErrors: [], ... }
```

### Getting Compliance Reports

```javascript
// Get full compliance report
const report = await registry.getComplianceReport();

console.log(report.summary);
// => {
//   total: 10,
//   compliant: 7,
//   nonCompliant: 2,
//   unknown: 1
// }

// Get only non-compliant plugins
const nonCompliant = await registry.getNonCompliantPlugins();
nonCompliant.forEach(plugin => {
  console.log(plugin.name, plugin.issues);
});
```

### Running Tests

```bash
# Test compliance validation system
node scripts/test-plugin-compliance.js
```

## Console Output

The validation system provides detailed logging:

```
[Registry] ✅ Loaded package.json for @allow2/my-plugin
[Registry] ⚠️ Plugin @allow2/bad-plugin has compliance issues:
  - React should be in peerDependencies, not dependencies
  - @material-ui/core should be in peerDependencies, not dependencies

[Registry] Compliance summary:
  - Compliant: 7
  - Non-compliant: 2
  - Unknown: 1
```

## Fixing Non-Compliant Plugins

### Step 1: Move Dependencies

Update your plugin's `package.json`:

```json
{
  "name": "@allow2/my-plugin",
  "version": "1.0.0",
  "peerDependencies": {
    "react": "^16.12.0",
    "react-dom": "^16.12.0",
    "@material-ui/core": "^4.11.3"
  },
  "dependencies": {
    // Keep only plugin-specific dependencies here
    "lodash": "^4.17.21"
  }
}
```

### Step 2: Update Documentation

Add peer dependency requirements to your README:

```markdown
## Installation

```bash
npm install @allow2/my-plugin
```

**Peer Dependencies:**

This plugin requires the following peer dependencies:
- react: ^16.12.0
- react-dom: ^16.12.0
- @material-ui/core: ^4.11.3
```

### Step 3: Test

```bash
# Reinstall dependencies
npm install

# Test that your plugin still works
npm test

# Verify compliance
node scripts/test-plugin-compliance.js
```

## Integration with Plugin Manager

The plugin manager can use compliance data to:

1. **Warn users** about non-compliant plugins before installation
2. **Filter plugins** by compliance status
3. **Display badges** showing compliance status in the UI
4. **Block installation** of non-compliant plugins (optional strict mode)

Example:

```javascript
// Filter to show only compliant plugins
const compliantPlugins = Object.entries(library)
  .filter(([name, plugin]) => plugin.compliance.compliant === true);

// Warn before installing non-compliant plugin
if (plugin.compliance.compliant === false) {
  console.warn('⚠️ This plugin has dependency issues:');
  plugin.compliance.validationErrors.forEach(error => {
    console.warn(`  - ${error}`);
  });
}
```

## API Reference

### `validatePluginCompliance(plugin)`

Validates a plugin's dependency structure.

**Parameters:**
- `plugin` (Object) - Plugin metadata object with `dependencies` and `peerDependencies`

**Returns:**
```javascript
{
  compliant: boolean,      // true if no issues found
  issues: string[],        // Array of critical issues
  warnings: string[]       // Array of warnings
}
```

### `enrichPluginWithPackageInfo(plugin)`

Loads package.json from installed plugin and adds dependency information.

**Parameters:**
- `plugin` (Object) - Plugin metadata object

**Returns:** Promise<void>

### `getComplianceReport()`

Generates a comprehensive compliance report for all plugins.

**Returns:**
```javascript
Promise<{
  summary: {
    total: number,
    compliant: number,
    nonCompliant: number,
    unknown: number
  },
  compliantPlugins: Array,
  nonCompliantPlugins: Array,
  unknownPlugins: Array
}>
```

### `getNonCompliantPlugins()`

Returns array of non-compliant plugins with detailed issue information.

**Returns:**
```javascript
Promise<Array<{
  name: string,
  package: string,
  version: string,
  issues: string[],
  warnings: string[],
  packageJsonPath: string
}>>
```

## Best Practices

### For Plugin Developers

1. ✅ Always use `peerDependencies` for React and Material-UI
2. ✅ Keep `dependencies` for plugin-specific packages only
3. ✅ Test your plugin with different React/Material-UI versions
4. ✅ Document peer dependency requirements in README
5. ✅ Run compliance validation before publishing

### For Application Developers

1. ✅ Check plugin compliance before installation
2. ✅ Generate compliance reports regularly
3. ✅ Update non-compliant plugins when new versions are available
4. ✅ Consider strict mode to block non-compliant plugins

## Migration Guide

### For Existing Plugins

If you have an existing plugin with React in dependencies:

1. **Create a new version** (bump minor version)
2. **Move dependencies** to peerDependencies
3. **Update package.json** with peer dependencies
4. **Test thoroughly** with the host application
5. **Publish** the new compliant version
6. **Update documentation** with peer dependency requirements

Example git workflow:

```bash
# Create migration branch
git checkout -b fix/peer-dependencies

# Edit package.json (move React to peerDependencies)
vim package.json

# Test
npm install
npm test

# Commit
git add package.json
git commit -m "fix: Move React to peerDependencies for compliance"

# Bump version
npm version minor

# Publish
npm publish

# Create PR
git push origin fix/peer-dependencies
```

## Troubleshooting

### "No package.json found"

The validator couldn't find the plugin's package.json. Possible causes:

- Plugin not installed in node_modules
- Plugin using non-standard directory structure
- Package name mismatch between registry and npm

**Solution:** Ensure plugin is installed with `npm install <plugin-name>`

### "Multiple React instances detected"

Your application is running multiple versions of React.

**Solution:** Check which plugins have React in dependencies:

```bash
node scripts/test-plugin-compliance.js
```

Then update or remove non-compliant plugins.

## Future Enhancements

Planned improvements to the validation system:

- [ ] Automatic fix suggestions with code generation
- [ ] GitHub integration to check plugin repos
- [ ] Compliance scoring (0-100)
- [ ] Version compatibility matrix
- [ ] Automated PR creation for fixes
- [ ] CI/CD integration for plugin validation
- [ ] Web dashboard for compliance monitoring

## Resources

- [React Documentation - Multiple React Instances](https://reactjs.org/warnings/invalid-hook-call-warning.html)
- [npm peerDependencies](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#peerdependencies)
- [Material-UI Installation Guide](https://v4.mui.com/getting-started/installation/)
