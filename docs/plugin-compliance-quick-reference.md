# Plugin Compliance - Quick Reference

## TL;DR

Move React and Material-UI from `dependencies` to `peerDependencies` in your plugin's `package.json`:

### ❌ Wrong (Non-Compliant)

```json
{
  "dependencies": {
    "react": "^16.12.0",
    "@material-ui/core": "^4.11.3"
  }
}
```

### ✅ Correct (Compliant)

```json
{
  "peerDependencies": {
    "react": "^16.12.0",
    "@material-ui/core": "^4.11.3"
  },
  "dependencies": {
    "lodash": "^4.17.21"
  }
}
```

## Quick Commands

```bash
# Test compliance validation
node scripts/test-plugin-compliance.js

# Compile app before testing
npm run private:compile
```

## API Quick Reference

```javascript
import RegistryLoader from './app/registry.js';

const registry = new RegistryLoader();

// Get library with compliance data
const library = await registry.getLibrary();
console.log(library['my-plugin'].compliance);

// Get compliance report
const report = await registry.getComplianceReport();
console.log(report.summary);
// => { total: 10, compliant: 8, nonCompliant: 1, unknown: 1 }

// Get only non-compliant plugins
const nonCompliant = await registry.getNonCompliantPlugins();
```

## Validation Rules Checklist

### Critical Issues (❌ Non-Compliant)

- [ ] `react` in dependencies
- [ ] `react-dom` in dependencies
- [ ] `@material-ui/core` in dependencies
- [ ] `@mui/material` in dependencies
- [ ] `@material-ui/icons` in dependencies
- [ ] `@mui/icons-material` in dependencies

### Warnings (⚠ Review)

- [ ] Missing `react` in peerDependencies for React plugins
- [ ] `redux` in dependencies
- [ ] `react-redux` in dependencies

## Compliance Schema

```typescript
interface PluginCompliance {
  compliant: boolean | null;   // true/false/null (unknown)
  validationErrors: string[];  // Critical issues
  validationWarnings: string[]; // Warnings
  lastChecked: string;         // ISO timestamp
}
```

## Console Output Examples

### Loading Plugins

```
[Registry] ✅ Loaded package.json for @allow2/my-plugin
[Registry] ⚠️ Plugin @allow2/bad-plugin has compliance issues:
  - React should be in peerDependencies, not dependencies

[Registry] Compliance summary:
  - Compliant: 6
  - Non-compliant: 1
  - Unknown: 0
```

### Test Script Output

```
📊 COMPLIANCE SUMMARY
═════════════════════════════════════
Total plugins:        7
✓ Compliant:         6
✗ Non-compliant:     1
? Unknown:           0

⚠️  NON-COMPLIANT PLUGINS
═════════════════════════════════════
1. bad-plugin
   Package: @namespace/bad-plugin
   Version: 1.0.0

   Issues:
   ✗ React should be in peerDependencies, not dependencies
```

## Common Scenarios

### Scenario 1: Installing a Plugin

```javascript
// Check compliance before install
const plugin = await registry.getPlugin('my-plugin');

if (plugin.compliance.compliant === false) {
  console.warn('⚠️ Non-compliant plugin detected!');
  console.warn('Issues:', plugin.compliance.validationErrors);

  // Decide: proceed anyway or cancel
}
```

### Scenario 2: Generating Reports

```javascript
// Get compliance report for all plugins
const report = await registry.getComplianceReport();

// Email non-compliant plugins to admin
if (report.summary.nonCompliant > 0) {
  sendEmail({
    subject: 'Non-Compliant Plugins Detected',
    body: `Found ${report.summary.nonCompliant} non-compliant plugins`,
    plugins: report.nonCompliantPlugins
  });
}
```

### Scenario 3: Fixing a Plugin

```bash
# 1. Move dependencies
vim package.json
# Move react/mui to peerDependencies

# 2. Test locally
npm install
npm test

# 3. Verify compliance
node scripts/test-plugin-compliance.js

# 4. Publish
npm version minor
npm publish
```

## Integration Examples

### Display Compliance Badge

```javascript
function ComplianceBadge({ plugin }) {
  if (plugin.compliance.compliant === true) {
    return <Badge color="success">✓ Compliant</Badge>;
  } else if (plugin.compliance.compliant === false) {
    return <Badge color="error">⚠ Issues</Badge>;
  } else {
    return <Badge color="default">? Unknown</Badge>;
  }
}
```

### Filter Plugins

```javascript
// Show only compliant plugins
const compliantPlugins = Object.entries(library)
  .filter(([name, plugin]) => plugin.compliance.compliant === true);

// Show plugins needing review
const needsReview = Object.entries(library)
  .filter(([name, plugin]) =>
    plugin.compliance.compliant === false ||
    plugin.compliance.validationWarnings.length > 0
  );
```

### Strict Mode

```javascript
// Block non-compliant installations
async function installPlugin(pluginName) {
  const plugin = await registry.getPlugin(pluginName);

  if (plugin.compliance.compliant === false) {
    throw new Error(
      `Cannot install non-compliant plugin: ${pluginName}\n` +
      `Issues:\n${plugin.compliance.validationErrors.join('\n')}`
    );
  }

  // Proceed with installation
}
```

## File Locations

- **Implementation**: `/mnt/ai/automate/automate/app/registry.js`
- **Test Script**: `/mnt/ai/automate/automate/scripts/test-plugin-compliance.js`
- **Full Docs**: `/mnt/ai/automate/automate/docs/plugin-compliance-validation.md`
- **Summary**: `/mnt/ai/automate/automate/docs/plugin-compliance-implementation-summary.md`

## Links

- [Full Documentation](./plugin-compliance-validation.md)
- [Implementation Summary](./plugin-compliance-implementation-summary.md)
- [React Multiple Instances Warning](https://reactjs.org/warnings/invalid-hook-call-warning.html)
- [npm peerDependencies Docs](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#peerdependencies)
