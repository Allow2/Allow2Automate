# Migration Guide: Moving to Shared Browser Automation

## Overview

This guide helps you migrate existing plugins from bundled Playwright to the shared dependency pattern.

**Benefits of Migration**:
- ✅ Plugin size reduced by ~300MB
- ✅ Faster marketplace installation (10x faster)
- ✅ Consistent Playwright version across all plugins
- ✅ Browser binaries installed once, not per plugin
- ✅ Better user experience

## Who Should Migrate?

Migrate if your plugin:
- Currently has `playwright` in `dependencies`
- Uses browser automation features
- Is distributed via marketplace
- Wants faster installation

## Pre-Migration Checklist

- [ ] Verify main app has Playwright v1.40.0 or later
- [ ] Check plugin uses Playwright v1.40.0 or compatible version
- [ ] Review plugin's browser automation code
- [ ] Have backup of current plugin code
- [ ] Test environment ready for validation

## Migration Steps

### Step 1: Verify Main App Has Playwright

Check if the main app already has Playwright installed:

```bash
cd /path/to/automate
npm list playwright
```

**Expected output**:
```
Allow2Automate@2.0.0 /path/to/automate
└── playwright@1.40.0
```

If not installed:
```bash
npm install playwright@^1.40.0
npx playwright install chromium
```

### Step 2: Update Plugin package.json

**Before** (bundled dependency):
```json
{
  "name": "@allow2/your-plugin",
  "version": "1.0.0",
  "dependencies": {
    "playwright": "^1.40.0",
    "react": "^16.14.0"
  },
  "peerDependencies": {
    "electron": ">=10.0.0"
  }
}
```

**After** (peer dependency):
```json
{
  "name": "@allow2/your-plugin",
  "version": "1.0.0",
  "peerDependencies": {
    "playwright": "^1.40.0",
    "electron": ">=10.0.0"
  },
  "dependencies": {
    // Only plugin-specific dependencies
  }
}
```

**Changes**:
1. Move `playwright` from `dependencies` to `peerDependencies`
2. Remove `playwright` from `dependencies`

### Step 3: Remove Bundled Playwright

Delete your plugin's local Playwright installation:

```bash
cd /path/to/your-plugin
rm -rf node_modules/playwright
npm install
```

This ensures npm doesn't install Playwright locally.

### Step 4: Verify Module Resolution

Test that Playwright is available from main app:

Create `test/playwright-resolution.js`:
```javascript
try {
    const { chromium } = require('playwright');
    console.log('✓ Playwright resolved successfully');
    console.log('✓ Chromium available:', chromium.name());
} catch (error) {
    console.error('✗ Playwright not available:', error.message);
    process.exit(1);
}
```

Run test:
```bash
node test/playwright-resolution.js
```

### Step 5: Test Browser Launch

Test that browser can launch:

Create `test/browser-launch.js`:
```javascript
const { chromium } = require('playwright');

async function testBrowserLaunch() {
    try {
        console.log('Launching browser...');
        const browser = await chromium.launch({ headless: true });
        console.log('✓ Browser launched successfully');

        const page = await browser.newPage();
        await page.goto('https://example.com');
        console.log('✓ Navigation successful');

        await browser.close();
        console.log('✓ Cleanup successful');

        console.log('\n✅ Browser automation working!');
    } catch (error) {
        console.error('✗ Browser launch failed:', error);
        process.exit(1);
    }
}

testBrowserLaunch();
```

Run test:
```bash
node test/browser-launch.js
```

### Step 6: Test Plugin Installation

Test the full installation workflow:

```bash
# Uninstall existing plugin
npm uninstall @allow2/your-plugin

# Install from marketplace (or local)
npm install @allow2/your-plugin

# Verify plugin loads
npm start
```

**What to check**:
- Installation time (should be much faster)
- No additional Playwright download
- Plugin loads without errors
- Browser automation features work

### Step 7: Update Plugin Documentation

Update your plugin's README.md:

```markdown
## Requirements

This plugin requires Allow2Automate v2.0.0 or later with Playwright support.

The host application provides Playwright as a shared dependency. You don't need to install it separately.

## Installation

Install from marketplace:
1. Open Allow2Automate
2. Go to Marketplace
3. Search for "Your Plugin"
4. Click Install

The plugin will install quickly without downloading browser binaries.
```

### Step 8: Bump Version

Since this is a breaking change for users on older hosts, bump your plugin version:

```json
{
  "version": "2.0.0"  // Major version bump
}
```

Document in CHANGELOG.md:
```markdown
## 2.0.0 (2024-XX-XX)

### Breaking Changes
- Requires Allow2Automate v2.0.0 or later
- Playwright moved to peer dependency for smaller plugin size

### Benefits
- Plugin size reduced by ~300MB
- 10x faster installation from marketplace
- Browser binaries installed by host app
```

## Example: Battle.net Plugin Migration

### Before Migration

**package.json**:
```json
{
  "name": "allow2automate-battle.net",
  "version": "1.0.0",
  "dependencies": {
    "playwright": "^1.40.0",
    "react": "^16.14.0"
  },
  "peerDependencies": {
    "electron": ">=10.0.0"
  }
}
```

**Installation**:
- Plugin size: ~305MB (including Playwright)
- Install time: 2-3 minutes
- Browser binaries: Downloaded per plugin

### After Migration

**package.json**:
```json
{
  "name": "allow2automate-battle.net",
  "version": "2.0.0",
  "peerDependencies": {
    "playwright": "^1.40.0",
    "electron": ">=10.0.0"
  },
  "dependencies": {}
}
```

**Installation**:
- Plugin size: ~5MB (code only)
- Install time: 10-15 seconds
- Browser binaries: Provided by host app

**Improvement**: 60x smaller, 12x faster installation!

## Code Changes Required?

### None for Basic Usage

If your code just requires Playwright:
```javascript
const { chromium } = require('playwright');
```

**No changes needed!** Module injection handles resolution automatically.

### Possible Changes for Advanced Usage

If you have Playwright-specific configuration:

**Before**:
```javascript
// Custom browser binary path
const browser = await chromium.launch({
    executablePath: '/custom/path/to/chrome'
});
```

**After**:
```javascript
// Use default binary from host app
const browser = await chromium.launch({
    // No executablePath needed
});
```

## Testing Migration

### Integration Test Checklist

Run these tests to verify migration:

- [ ] Plugin installs from marketplace
- [ ] Installation completes in <30 seconds
- [ ] No browser binary downloads during plugin install
- [ ] Plugin loads without errors
- [ ] Browser automation features work correctly
- [ ] Persistent sessions work (if applicable)
- [ ] No "Cannot find module" errors
- [ ] Plugin uninstalls cleanly

### Automated Test Script

Create `test/migration-validation.js`:

```javascript
const { chromium } = require('playwright');
const BrowserService = require('../src/services/BrowserService');

async function validateMigration() {
    console.log('Running migration validation tests...\n');

    const tests = [
        {
            name: 'Module Resolution',
            test: async () => {
                const { chromium } = require('playwright');
                return chromium.name() === 'chromium';
            }
        },
        {
            name: 'Browser Launch',
            test: async () => {
                const browser = await chromium.launch({ headless: true });
                await browser.close();
                return true;
            }
        },
        {
            name: 'Browser Service',
            test: async () => {
                const service = new BrowserService({ headless: true });
                await service.initialize();
                await service.cleanup();
                return true;
            }
        },
        {
            name: 'Page Navigation',
            test: async () => {
                const browser = await chromium.launch({ headless: true });
                const page = await browser.newPage();
                await page.goto('https://example.com');
                const title = await page.title();
                await browser.close();
                return title.length > 0;
            }
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, test } of tests) {
        try {
            const result = await test();
            if (result) {
                console.log(`✅ ${name}`);
                passed++;
            } else {
                console.log(`❌ ${name} - returned false`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ ${name} - ${error.message}`);
            failed++;
        }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

validateMigration()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
```

Run validation:
```bash
node test/migration-validation.js
```

## Common Migration Issues

### Issue 1: Plugin Still Bundles Playwright

**Symptom**: Plugin installation still takes long time, downloads browser binaries.

**Cause**: Playwright still in `dependencies` instead of `peerDependencies`.

**Solution**:
```bash
# Edit package.json, move playwright to peerDependencies
npm install --production
rm -rf node_modules/playwright
```

### Issue 2: Module Not Found

**Symptom**: `Error: Cannot find module 'playwright'`

**Cause**: Main app doesn't have Playwright installed, or module paths not injected.

**Solution**:
```bash
# Install in main app
cd /path/to/automate
npm install playwright

# Verify app/plugins.js includes Playwright in module.paths
```

### Issue 3: Version Mismatch

**Symptom**: Plugin works in development but fails in production.

**Cause**: Plugin requires different Playwright version than host provides.

**Solution**: Use version ranges in peerDependencies:
```json
{
  "peerDependencies": {
    "playwright": "^1.40.0"  // Allows 1.40.x - 1.x.x
  }
}
```

### Issue 4: Browser Binaries Missing

**Symptom**: `Error: Executable doesn't exist at ...`

**Cause**: Browser binaries not installed in main app.

**Solution**:
```bash
cd /path/to/automate
npx playwright install chromium
```

## Rollback Plan

If migration fails, you can rollback:

### Step 1: Revert package.json

```json
{
  "dependencies": {
    "playwright": "^1.40.0"
  },
  "peerDependencies": {
    "electron": ">=10.0.0"
  }
}
```

### Step 2: Reinstall Playwright

```bash
npm install playwright
npx playwright install chromium
```

### Step 3: Test

```bash
npm test
```

## Best Practices After Migration

### 1. Document Playwright Requirement

In README.md:
```markdown
## Requirements

- Allow2Automate v2.0.0+
- Host app provides Playwright v1.40.0+
```

### 2. Add Version Check

```javascript
function checkPlaywrightVersion() {
    try {
        const { version } = require('playwright/package.json');
        console.log('Playwright version:', version);
        return version >= '1.40.0';
    } catch {
        return false;
    }
}
```

### 3. Graceful Degradation

```javascript
async function initializeBrowser() {
    try {
        const { chromium } = require('playwright');
        return new BrowserService({ chromium });
    } catch (error) {
        console.error('Browser automation not available:', error);
        return null; // Fall back to non-automation features
    }
}
```

## Support

If you encounter issues during migration:

1. Check [Browser Automation Integration](./browser-automation-integration.md)
2. Review [Plugin Development Guide](./PLUGIN_BROWSER_AUTOMATION_GUIDE.md)
3. Test with provided validation scripts
4. Open issue on GitHub with error details

## Summary

✅ **Before Migration**:
- Large plugin size (~300MB)
- Slow installation (2-3 minutes)
- Browser binaries per plugin

✅ **After Migration**:
- Small plugin size (~5MB)
- Fast installation (10-15 seconds)
- Shared browser binaries

**Follow the steps, test thoroughly, and enjoy the benefits!**
