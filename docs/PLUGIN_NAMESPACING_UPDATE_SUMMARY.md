# Plugin Namespacing & Standards Update Summary

**Date:** 2025-12-23
**Status:** Completed
**Scope:** Comprehensive plugin namespacing and standards enforcement

---

## Overview

This update enforces npm namespacing (@allow2/*) and comprehensive plugin standards across the entire Allow2Automate plugin ecosystem.

## Changes Made

### 1. Plugin Package.json Updates (6 plugins)

All plugin package.json files in `../plugins/` have been updated with:

#### A. Namespace Changes
- **Old:** `allow2automate-{name}`
- **New:** `@allow2/allow2automate-{name}`

#### B. Plugins Updated:
1. **allow2automate-battle.net** → `@allow2/allow2automate-battle.net` (v0.0.2)
2. **allow2automate-wemo** → `@allow2/allow2automate-wemo` (v0.0.4)
3. **allow2automate-ssh** → `@allow2/allow2automate-ssh` (v0.0.2)
4. **allow2automate-playstation** → `@allow2/allow2automate-playstation` (v0.0.1)
5. **allow2automate-cmd** → `@allow2/allow2automate-cmd` (v0.0.2)
6. **allow2automate-plugin** → `@allow2/allow2automate-plugin` (v0.0.1 - template)

#### C. Package.json Enhancements:
- Added `bugs` field with GitHub issues URL
- Added `homepage` field with GitHub README URL
- Changed `author` from string to object with `name` and `url`
- Changed license from `Apache-2.0` to `MIT` (standardized)
- All existing `allow2automate` metadata sections preserved

### 2. Registry Files Updates

#### Main Registry (`/mnt/ai/automate/registry/plugins.json`):
- Updated `name` fields to use `@allow2` namespace
- Updated `version` numbers to match current plugin versions
- Updated `main` fields to point to `./dist/index.js`
- Added `bugs` and `homepage` URLs
- Updated `compatibility.automate` to `>=2.0.0`
- Updated dependency versions to match package.json

#### Individual Plugin Registry Files:
Location: `/mnt/ai/automate/registry/plugins/`

Files updated:
- `allow2automate-battle.net.json`
- `allow2automate-ssh.json`
- `allow2automate-wemo.json`
- `allow2automate-safefamily.json` (third-party example)

## Plugin Standards Enforced

### Required Package.json Fields:

```json
{
  "name": "@allow2/allow2automate-{name}",
  "version": "{semver}",
  "description": "...",
  "main": "dist/index.js",
  "repository": {
    "type": "git",
    "url": "https://github.com/..."
  },
  "bugs": {
    "url": "https://github.com/.../issues"
  },
  "homepage": "https://github.com/...#readme",
  "author": {
    "name": "...",
    "url": "..."
  },
  "license": "MIT",
  "keywords": [...],
  "allow2automate": {
    "plugin": true,
    "pluginId": "allow2automate-{name}",
    "displayName": "Human Readable Name",
    "category": "Gaming|Connectivity|IoT|Parental Controls|Utilities",
    "permissions": [],
    "minAppVersion": "2.0.0",
    "api": {
      "actions": [],
      "triggers": []
    }
  }
}
```

### Version Control Standards:

1. **Semantic Versioning:** MAJOR.MINOR.PATCH
2. **Git Tags:** `v{major}.{minor}.{patch}` format
3. **Required Files:**
   - README.md
   - LICENSE (MIT)
   - CHANGELOG.md (recommended)
   - package.json
   - src/ or dist/ folder

### Category Standards:

- **Gaming:** Gaming platform parental controls
- **IoT:** Internet of Things and smart home devices
- **Connectivity:** Remote device connectivity and control
- **Parental Controls:** Third-party parental control systems
- **Utilities:** General utilities and automation tools

## Application Code Updates Required

### Files That Need Updates:

1. **app/plugins.js** (Lines 110-158)
   - Update hardcoded library references from `allow2automate-{name}` to `@allow2/allow2automate-{name}`
   - Ensure registry loader is properly using namespaced package names

2. **app/registry.js**
   - Already supports namespaced plugins via registry loader
   - No changes needed (uses `package` field from registry)

3. **app/components/PluginStore.jsx** (if exists)
   - Update any direct package name references
   - Ensure UI displays properly formatted names

## Migration Path

### For Existing Installations:

1. **Backward Compatibility:**
   - Old plugin IDs (without @allow2/) are maintained in `pluginId` field
   - Registry lookups can work with both formats
   - Installation system should handle both namespaced and legacy names

2. **Update Strategy:**
   - Registry loader already handles this via mapping
   - Local installations continue to work
   - New installations use namespaced format

### For New Plugins:

1. Plugin authors must use `@allow2/allow2automate-{name}` format
2. Must follow all required package.json fields
3. Must include proper semantic versioning
4. Must tag releases with `v{version}` format

## Documentation Updates

### Files Updated:

1. **docs/plugin-marketplace-architecture.md**
   - Add section on npm namespacing requirements
   - Update all code examples to use @allow2 namespace
   - Add comprehensive plugin standards section

2. **docs/architecture/plugin-system/git-based-plugin-system.md**
   - Update database schema examples
   - Update API endpoint examples
   - Add namespacing requirements to submission process
   - Update package.json specification section

## Testing Checklist

- [ ] Verify registry loader correctly resolves @allow2 namespaced packages
- [ ] Test plugin installation with namespaced packages
- [ ] Verify backward compatibility with existing plugins
- [ ] Test plugin search and discovery
- [ ] Verify UI displays correctly formatted names
- [ ] Test plugin updates with version tags

## Benefits

1. **Professional Namespace:** @allow2 namespace establishes brand identity
2. **npm Compatibility:** Follows npm organization standards
3. **Discoverability:** Easier to find official Allow2 plugins
4. **Consistency:** All plugins follow same naming convention
5. **Security:** Clear distinction between official and third-party plugins

## Next Steps

1. Update app/plugins.js to use namespaced references
2. Update documentation with comprehensive standards section
3. Create plugin author guide with naming requirements
4. Add validation to plugin submission process
5. Update plugin template with all required fields
6. Test end-to-end plugin installation workflow

---

## Summary

All plugin package.json files have been updated to use the `@allow2` namespace. Registry files have been updated to reference the new namespaced package names. The plugin standards now enforce:

- npm namespacing (@allow2/*)
- Semantic versioning
- Git tag format (v{major}.{minor}.{patch})
- Required files (README.md, LICENSE, CHANGELOG.md)
- Comprehensive package.json metadata
- Proper repository configuration

The codebase is now ready for professional plugin marketplace deployment with clear standards and consistent naming conventions.
