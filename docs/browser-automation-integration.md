# Browser Automation Integration - Playwright Shared Dependency

## Executive Summary

This document covers the integration of Playwright as a shared dependency for plugins that require browser automation capabilities. The Battle.net plugin uses Playwright for automating parental control management on the Battle.net Parent Portal.

**Current Status**: Playwright is a direct dependency of the Battle.net plugin. For optimal marketplace distribution, it should be moved to the main app as a shared dependency.

## Integration Status

### Current Configuration (Battle.net Plugin)

**File**: `/plugins/allow2automate-battle.net/package.json`
```json
{
  "dependencies": {
    "playwright": "^1.40.0",
    "react": "^16.14.0"
  },
  "peerDependencies": {
    "electron": ">=10.0.0"
  }
}
```

**Usage**: `/plugins/allow2automate-battle.net/src/services/BrowserService.js:165`
```javascript
const { chromium } = require('playwright');
```

### Issues Identified

1. **Large Dependency Size**: Playwright with browser binaries is ~300MB
2. **Plugin Size**: Each plugin bundles its own Playwright copy
3. **Version Conflicts**: Multiple plugins could use different Playwright versions
4. **Installation Time**: Browser binaries download during plugin install
5. **User Experience**: Long install times from marketplace

## Recommended Architecture

### Option 1: Shared Dependency (Recommended)

Move Playwright to main app as shared dependency, similar to React/Material-UI pattern.

**Main App** (`package.json`):
```json
{
  "dependencies": {
    "playwright": "^1.40.0",
    "react": "^16.12.0",
    "react-dom": "^16.12.0",
    "@material-ui/core": "^4.11.3"
  }
}
```

**Plugin** (`plugins/allow2automate-battle.net/package.json`):
```json
{
  "peerDependencies": {
    "playwright": "^1.40.0",
    "electron": ">=10.0.0"
  },
  "dependencies": {
    // Only plugin-specific dependencies
  }
}
```

**Benefits**:
- Plugin size reduced by ~300MB
- Faster marketplace installation
- Consistent Playwright version across all plugins
- Browser binaries installed once
- Follows established shared dependency pattern

### Option 2: Peer Dependency Only (Current)

Keep Playwright as plugin dependency but document browser binary requirements.

**Benefits**:
- Plugin self-contained
- No main app changes needed

**Drawbacks**:
- Large plugin size
- Slow marketplace installation
- User must wait for browser binaries to download

## Integration Test Checklist

### 1. Module Injection Verification

Test that Playwright can be required from plugin code when installed as peer dependency:

```javascript
// Test in plugin code
try {
  const { chromium } = require('playwright');
  console.log('✓ Playwright available:', chromium.name());
} catch (error) {
  console.error('✗ Playwright not available:', error.message);
}
```

**Expected Result**: Playwright loads successfully from main app's node_modules.

### 2. Browser Binary Availability

Test that browser binaries are accessible after main app installation:

```javascript
// Test browser launch
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true });
console.log('✓ Browser launched successfully');
await browser.close();
```

**Expected Result**: Chromium launches without downloading additional binaries.

### 3. Plugin Installation from Marketplace

Test plugin installation workflow:

```bash
# From marketplace UI
1. Browse to Battle.net plugin
2. Click "Install"
3. Observe installation progress
4. Check no browser binary downloads occur
5. Verify plugin loads successfully
```

**Expected Result**:
- Installation completes in <30 seconds
- No additional downloads after plugin files
- Plugin initializes without errors

### 4. Module Resolution Path

Test that Module.wrap injection works for Playwright:

```javascript
// In app/plugins.js, verify playwright is included
const playwrightPath = path.dirname(require.resolve('playwright'));
console.log('Playwright path:', playwrightPath);
console.log('Injecting into module.paths:', path.join(playwrightPath, '..'));
```

**Expected Result**: Playwright path is added to module resolution paths.

### 5. Cross-Plugin Compatibility

Test multiple plugins using Playwright:

```javascript
// Plugin A and Plugin B both use Playwright
const { chromium: chromiumA } = require('playwright');
const { chromium: chromiumB } = require('playwright');
console.log('Same instance?', chromiumA === chromiumB); // Should be true
```

**Expected Result**: Both plugins resolve to same Playwright instance.

### 6. Browser Pool Isolation

Test that multiple plugins can run browsers independently:

```javascript
// Plugin A
const browserA = await chromium.launch();

// Plugin B
const browserB = await chromium.launch();

// Both should work independently
console.log('Browser A contexts:', browserA.contexts().length);
console.log('Browser B contexts:', browserB.contexts().length);
```

**Expected Result**: Each plugin gets isolated browser instance.

## Common Issues and Solutions

### Issue 1: "Cannot find module 'playwright'"

**Cause**: Playwright not installed in main app, or module paths not injected.

**Solution**:
```bash
# Install in main app
npm install playwright

# Verify module paths in app/plugins.js
const playwrightPath = path.dirname(require.resolve('playwright'));
module.paths.push(path.join(playwrightPath, '..'));
```

### Issue 2: "Executable doesn't exist at ..."

**Cause**: Browser binaries not installed.

**Solution**:
```bash
# Install browser binaries for Playwright
npx playwright install chromium

# Or during npm install
npm install playwright && npx playwright install
```

### Issue 3: Plugin Install Hangs

**Cause**: Plugin trying to download browser binaries during install.

**Solution**:
- Move Playwright to peerDependencies in plugin
- Remove Playwright from plugin dependencies
- Ensure main app has Playwright installed

### Issue 4: Version Mismatch

**Cause**: Plugin requires different Playwright version than main app provides.

**Solution**:
- Update plugin's peerDependencies to match main app version
- Use version ranges: `"playwright": "^1.40.0"` (allows 1.40.x - 1.x.x)
- Document compatible version in plugin README

### Issue 5: Playwright Not Exposed to Plugins

**Cause**: Module.wrap doesn't include Playwright path.

**Solution**:
```javascript
// In app/plugins.js
const playwrightPath = path.dirname(require.resolve('playwright'));

(function(moduleWrapCopy) {
    Module.wrap = function(script) {
        const pathInjectionScript = [
            `module.paths.push('${ourModulesPath}');`,
            `module.paths.push('${path.join(playwrightPath, '..')}');`,
            // ... other paths
        ].join('');

        script = pathInjectionScript + script;
        return moduleWrapCopy(script);
    };
})(Module.wrap);
```

## Example Plugin Code Using Browser Automation

### Basic Browser Launch

```javascript
// plugin.js
const { chromium } = require('playwright');

async function automateTask() {
    const browser = await chromium.launch({
        headless: true,
        timeout: 30000
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto('https://example.com');
        const title = await page.title();
        console.log('Page title:', title);
    } finally {
        await browser.close();
    }
}
```

### Persistent Browser Session (Battle.net Pattern)

```javascript
// BrowserService.js
const { chromium } = require('playwright');

class BrowserService {
    constructor(options = {}) {
        this.headless = options.headless ?? true;
        this.browser = null;
        this.context = null;
    }

    async initialize() {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: this.headless,
                timeout: 30000
            });

            this.context = await this.browser.newContext({
                viewport: { width: 1280, height: 720 },
                userAgent: 'Mozilla/5.0...'
            });
        }
    }

    async navigate(url) {
        if (!this.context) {
            await this.initialize();
        }

        const page = await this.context.newPage();
        await page.goto(url);
        return page;
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
        }
    }
}

module.exports = BrowserService;
```

### Using Browser Automation in Plugin Lifecycle

```javascript
// index.js
const BrowserService = require('./services/BrowserService');

function plugin(context) {
    let browserService = null;

    return {
        onLoad: async (state) => {
            browserService = new BrowserService({ headless: true });
            await browserService.initialize();
            console.log('Browser service initialized');
        },

        onUnload: async (callback) => {
            if (browserService) {
                await browserService.cleanup();
                console.log('Browser service cleaned up');
            }
            callback(null);
        },

        // Your plugin methods...
        async performAutomation(params) {
            const page = await browserService.navigate(params.url);
            // Automation logic...
            await page.close();
        }
    };
}

module.exports = { plugin };
```

## Browser Automation API Quick Reference

### Playwright Core Concepts

```javascript
const { chromium, firefox, webkit } = require('playwright');

// Launch browser
const browser = await chromium.launch({
    headless: true,              // Run without UI
    slowMo: 0,                   // Slow down operations (ms)
    timeout: 30000,              // Default timeout
    args: ['--no-sandbox']       // Chrome args
});

// Create context (isolated session)
const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0...',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['geolocation']
});

// Create page
const page = await context.newPage();

// Navigation
await page.goto('https://example.com');
await page.waitForLoadState('domcontentloaded');

// Selectors
await page.click('button#submit');
await page.fill('input[name="username"]', 'user123');
await page.selectOption('select#country', 'US');

// Waiting
await page.waitForSelector('.result', { timeout: 5000 });
await page.waitForURL('**/success');
await page.waitForFunction(() => document.readyState === 'complete');

// Extraction
const text = await page.textContent('.title');
const value = await page.inputValue('input#email');
const html = await page.innerHTML('.content');

// Cleanup
await page.close();
await context.close();
await browser.close();
```

### Common Patterns

**Form Filling**:
```javascript
await page.fill('input[name="username"]', 'user123');
await page.fill('input[name="password"]', 'pass456');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');
```

**Data Extraction**:
```javascript
const items = await page.$$eval('.item', elements =>
    elements.map(el => ({
        title: el.querySelector('.title').textContent,
        price: el.querySelector('.price').textContent
    }))
);
```

**Screenshot/PDF**:
```javascript
await page.screenshot({ path: 'screenshot.png' });
await page.pdf({ path: 'page.pdf', format: 'A4' });
```

**Error Handling**:
```javascript
try {
    await page.goto('https://example.com', { timeout: 10000 });
} catch (error) {
    if (error.name === 'TimeoutError') {
        console.error('Page load timeout');
    }
}
```

## Official Documentation Links

- **Playwright Official Docs**: https://playwright.dev/docs/intro
- **API Reference**: https://playwright.dev/docs/api/class-playwright
- **Best Practices**: https://playwright.dev/docs/best-practices
- **Electron Integration**: https://playwright.dev/docs/api/class-electron
- **Troubleshooting**: https://playwright.dev/docs/troubleshooting

## Testing Your Integration

### Manual Test Script

Create `/test/playwright-integration-test.js`:

```javascript
const { chromium } = require('playwright');

async function testPlaywrightIntegration() {
    console.log('Starting Playwright integration test...');

    try {
        // Test 1: Module availability
        console.log('✓ Playwright module loaded');

        // Test 2: Browser launch
        const browser = await chromium.launch({ headless: true });
        console.log('✓ Browser launched');

        // Test 3: Page navigation
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto('https://example.com');
        console.log('✓ Page navigation successful');

        // Test 4: DOM interaction
        const title = await page.title();
        console.log('✓ DOM interaction successful:', title);

        // Test 5: Cleanup
        await browser.close();
        console.log('✓ Cleanup successful');

        console.log('\n✅ All tests passed!');
        return true;
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        return false;
    }
}

// Run test
testPlaywrightIntegration()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
```

**Run test**:
```bash
node test/playwright-integration-test.js
```

## Performance Considerations

### Resource Usage

- **Memory**: Each browser instance ~50-100MB
- **CPU**: Moderate during page rendering
- **Disk**: Browser binaries ~300MB (one-time)

### Optimization Tips

1. **Reuse browser instances**: Don't launch new browser for each operation
2. **Use persistent contexts**: Keep session cookies between operations
3. **Minimize page loads**: Navigate only when necessary
4. **Close unused pages**: Free memory by closing completed pages
5. **Use headless mode**: Faster rendering without UI overhead

### Battle.net Plugin Optimizations

The Battle.net plugin implements several optimizations:

- **Persistent browser session**: Browser stays open during plugin lifecycle
- **Session caching**: Reuses authentication cookies
- **Token URL rate limiting**: Minimizes external API calls
- **Smart keepalive**: Maintains session without excessive navigation
- **Graceful cleanup**: Properly closes browser on plugin unload

## Security Considerations

### Sandbox Isolation

Playwright browsers run in sandbox mode by default. For Electron apps:

```javascript
const browser = await chromium.launch({
    args: [
        '--no-sandbox',           // Required for Electron
        '--disable-setuid-sandbox'
    ]
});
```

### User Data Protection

Never log or expose sensitive data from automated sessions:

```javascript
// ❌ BAD
console.log('Password:', await page.inputValue('#password'));

// ✅ GOOD
const passwordFilled = await page.inputValue('#password') !== '';
console.log('Password filled:', passwordFilled);
```

### Token Storage

Store tokens securely using electron-settings or encrypted storage:

```javascript
const settings = require('electron-settings');

// Save token (encrypted by electron-settings)
await settings.set('battlenet.token', token);

// Retrieve token
const token = await settings.get('battlenet.token');
```

## Migration Path for Existing Plugins

If you have a plugin with Playwright as a dependency:

### Step 1: Update Main App

```bash
cd /path/to/automate
npm install playwright
npx playwright install chromium
```

### Step 2: Update Plugin package.json

```json
{
  "name": "your-plugin",
  "peerDependencies": {
    "playwright": "^1.40.0"
  },
  "dependencies": {
    // Remove playwright from here
  }
}
```

### Step 3: Verify Module Injection

Check that `app/plugins.js` includes Playwright in module paths (see Issue 5 solution above).

### Step 4: Test Installation

1. Uninstall existing plugin
2. Reinstall from marketplace
3. Verify browser automation works
4. Check installation time is faster

### Step 5: Update Documentation

Update your plugin's README to note that Playwright is provided by the host app.

## Conclusion

Browser automation via Playwright is a powerful capability for plugins. By following the shared dependency pattern established for React and Material-UI, we can:

- Reduce plugin size dramatically (~300MB savings)
- Speed up marketplace installation
- Ensure version consistency
- Improve user experience

The Battle.net plugin demonstrates effective use of Playwright for complex automation tasks while maintaining good performance through session persistence and smart caching strategies.
