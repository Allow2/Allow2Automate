# Plugin Development Guide: Browser Automation with Playwright

## Quick Start

This guide shows you how to use Playwright browser automation in your Allow2Automate plugin.

## Prerequisites

- Node.js 14 or later
- Allow2Automate host application with Playwright installed
- Basic understanding of async/await JavaScript

## When to Use Browser Automation

Use Playwright in your plugin when you need to:

- Automate web portals (parental controls, device management, etc.)
- Scrape data from websites
- Control web-based devices or services
- Perform headless browser testing
- Interact with sites that don't have APIs

**Examples**:
- Battle.net Parent Portal automation
- Router web interface control
- Smart home device web panels
- ISP parental control portals

## Step 1: Declare Playwright as Peer Dependency

In your plugin's `package.json`:

```json
{
  "name": "@allow2/your-plugin-name",
  "version": "1.0.0",
  "description": "Your plugin description",
  "main": "src/index.js",
  "peerDependencies": {
    "playwright": "^1.40.0",
    "electron": ">=10.0.0"
  },
  "dependencies": {
    // Only plugin-specific dependencies
  }
}
```

**Why peer dependency?**
- Host app provides Playwright (~300MB with binaries)
- Reduces your plugin size dramatically
- Ensures version consistency
- Faster marketplace installation

## Step 2: Require Playwright in Your Plugin

In your plugin code:

```javascript
// src/services/BrowserService.js
const { chromium } = require('playwright');

// Or if you need multiple browsers:
const { chromium, firefox, webkit } = require('playwright');
```

**No installation needed!** The host app's module injection system makes Playwright available automatically.

## Step 3: Create a Browser Service

Create a reusable service for browser operations:

```javascript
// src/services/BrowserService.js
const { chromium } = require('playwright');

class BrowserService {
    constructor(options = {}) {
        this.headless = options.headless ?? true;
        this.timeout = options.timeout ?? 30000;
        this.browser = null;
        this.context = null;
    }

    /**
     * Initialize browser and context
     */
    async initialize() {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: this.headless,
                timeout: this.timeout,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            });

            this.context = await this.browser.newContext({
                viewport: { width: 1280, height: 720 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });
        }
    }

    /**
     * Navigate to URL and return page
     */
    async navigate(url) {
        if (!this.context) {
            await this.initialize();
        }

        const page = await this.context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return page;
    }

    /**
     * Cleanup browser resources
     */
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

## Step 4: Integrate with Plugin Lifecycle

Use the browser service in your main plugin file:

```javascript
// src/index.js
const BrowserService = require('./services/BrowserService');

function plugin(context) {
    let browserService = null;
    let state = {};

    return {
        /**
         * Called when plugin loads
         */
        onLoad: async (loadState) => {
            console.log('Initializing browser service...');

            state = loadState || {};

            browserService = new BrowserService({
                headless: true,
                timeout: 30000
            });

            await browserService.initialize();
            console.log('Browser service ready');
        },

        /**
         * Called when plugin unloads
         */
        onUnload: async (callback) => {
            console.log('Cleaning up browser service...');

            if (browserService) {
                await browserService.cleanup();
            }

            callback(null);
        },

        /**
         * Your automation method
         */
        async automateTask(params) {
            try {
                const page = await browserService.navigate(params.url);

                // Perform automation
                await page.fill('input#username', params.username);
                await page.fill('input#password', params.password);
                await page.click('button[type="submit"]');

                // Wait for result
                await page.waitForSelector('.success-message');

                const result = await page.textContent('.success-message');

                await page.close();

                return { success: true, result };
            } catch (error) {
                console.error('Automation failed:', error);
                return { success: false, error: error.message };
            }
        }
    };
}

module.exports = { plugin };
```

## Common Patterns

### Pattern 1: Form Automation

```javascript
async function loginToPortal(page, credentials) {
    // Navigate to login page
    await page.goto('https://portal.example.com/login');

    // Fill credentials
    await page.fill('input[name="username"]', credentials.username);
    await page.fill('input[type="password"]', credentials.password);

    // Submit form
    await page.click('button#login');

    // Wait for redirect
    await page.waitForURL('**/dashboard', { timeout: 5000 });

    return { success: true };
}
```

### Pattern 2: Data Extraction

```javascript
async function getDeviceStatus(page) {
    await page.goto('https://device.example.com/status');

    // Extract data from table
    const devices = await page.$$eval('table.devices tbody tr', rows => {
        return rows.map(row => ({
            name: row.querySelector('td.name').textContent,
            status: row.querySelector('td.status').textContent,
            lastSeen: row.querySelector('td.time').textContent
        }));
    });

    return devices;
}
```

### Pattern 3: Update Settings

```javascript
async function updateTimeLimit(page, childId, minutes) {
    // Navigate to child settings
    await page.goto(`https://portal.example.com/child/${childId}`);

    // Update time limit
    await page.fill('input#daily-minutes', minutes.toString());
    await page.click('button#save-settings');

    // Wait for confirmation
    await page.waitForSelector('.alert-success', { timeout: 5000 });

    const message = await page.textContent('.alert-success');

    return { success: true, message };
}
```

### Pattern 4: Persistent Session

```javascript
class PersistentBrowserService extends BrowserService {
    constructor(options) {
        super(options);
        this.sessionCookies = null;
    }

    async authenticate(credentials) {
        const page = await this.navigate('https://portal.example.com/login');

        await page.fill('input[name="username"]', credentials.username);
        await page.fill('input[type="password"]', credentials.password);
        await page.click('button#login');

        await page.waitForURL('**/dashboard');

        // Save session cookies
        this.sessionCookies = await this.context.cookies();

        await page.close();

        return { success: true };
    }

    async restoreSession() {
        if (this.sessionCookies) {
            await this.context.addCookies(this.sessionCookies);
            return true;
        }
        return false;
    }

    async isSessionValid() {
        try {
            const page = await this.navigate('https://portal.example.com/dashboard');
            const url = page.url();
            await page.close();

            // If redirected to login, session expired
            return !url.includes('/login');
        } catch (error) {
            return false;
        }
    }
}
```

## Error Handling

Always wrap browser operations in try-catch:

```javascript
async function safeAutomation(page, operations) {
    try {
        await operations(page);
        return { success: true };
    } catch (error) {
        console.error('Automation error:', error);

        // Check specific error types
        if (error.name === 'TimeoutError') {
            return { success: false, error: 'Operation timed out' };
        }

        if (error.message.includes('Target closed')) {
            return { success: false, error: 'Browser closed unexpectedly' };
        }

        return { success: false, error: error.message };
    }
}
```

## Performance Best Practices

### 1. Reuse Browser Instances

❌ **Don't**: Create new browser for each operation
```javascript
async function badPattern() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    // ... do work
    await browser.close();
}
```

✅ **Do**: Reuse browser across operations
```javascript
class GoodPattern {
    async initialize() {
        this.browser = await chromium.launch();
    }

    async doWork() {
        const page = await this.browser.newPage();
        // ... do work
        await page.close(); // Only close page
    }
}
```

### 2. Use Persistent Contexts

Keep authentication cookies between operations:

```javascript
async initialize() {
    this.browser = await chromium.launch();
    this.context = await this.browser.newContext();
    // Context persists, reuse it for all pages
}
```

### 3. Minimize Page Loads

Only navigate when necessary:

```javascript
// ✅ Good: Check if already on correct page
if (!page.url().includes('/settings')) {
    await page.goto('https://portal.example.com/settings');
}

// ❌ Bad: Always navigate
await page.goto('https://portal.example.com/settings');
```

### 4. Close Unused Pages

```javascript
async function withPage(operation) {
    const page = await this.context.newPage();
    try {
        return await operation(page);
    } finally {
        await page.close(); // Always close
    }
}
```

## Security Considerations

### 1. Never Log Sensitive Data

```javascript
// ❌ BAD
console.log('Username:', username);
console.log('Password:', password);

// ✅ GOOD
console.log('Authenticating user...');
console.log('Authentication successful');
```

### 2. Store Tokens Securely

Use electron-settings for encrypted storage:

```javascript
const settings = require('electron-settings');

// Save token
await settings.set('plugin.token', token);

// Retrieve token
const token = await settings.get('plugin.token');
```

### 3. Validate URLs

```javascript
function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:'; // Only allow HTTPS
    } catch {
        return false;
    }
}
```

## Testing Your Plugin

Create a test script:

```javascript
// test/browser-automation.test.js
const BrowserService = require('../src/services/BrowserService');

async function testBrowserService() {
    console.log('Testing browser service...');

    const service = new BrowserService({ headless: true });

    try {
        await service.initialize();
        console.log('✓ Browser initialized');

        const page = await service.navigate('https://example.com');
        console.log('✓ Navigation successful');

        const title = await page.title();
        console.log('✓ Page interaction successful:', title);

        await page.close();
        await service.cleanup();
        console.log('✓ Cleanup successful');

        console.log('\n✅ All tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testBrowserService();
```

## Debugging Tips

### 1. Run with Headful Browser

```javascript
const service = new BrowserService({
    headless: false // See what's happening
});
```

### 2. Take Screenshots

```javascript
await page.screenshot({ path: 'debug.png' });
```

### 3. Use Slow Motion

```javascript
const browser = await chromium.launch({
    headless: false,
    slowMo: 1000 // Slow down by 1 second
});
```

### 4. Log Page Console

```javascript
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
```

## Real-World Example: Battle.net Plugin

The Battle.net plugin demonstrates advanced Playwright usage:

**Features**:
- Persistent browser session (stays open during plugin lifecycle)
- Session cookie caching
- Smart token URL usage (rate limiting)
- Automatic session validation
- Keepalive mechanism
- Graceful cleanup

**File**: `/plugins/allow2automate-battle.net/src/services/BrowserService.js`

Study this implementation for production-grade patterns.

## Troubleshooting

### "Cannot find module 'playwright'"

**Cause**: Host app doesn't have Playwright installed.

**Solution**: Verify main app has Playwright in dependencies:
```bash
cd /path/to/automate
npm install playwright
```

### "Executable doesn't exist at ..."

**Cause**: Browser binaries not installed.

**Solution**:
```bash
npx playwright install chromium
```

### "Browser closed unexpectedly"

**Cause**: Browser crashed or was killed.

**Solution**: Check system resources, add error handling:
```javascript
try {
    await page.goto(url);
} catch (error) {
    if (error.message.includes('Target closed')) {
        // Re-initialize browser
        await this.initialize();
    }
}
```

### Timeout Errors

**Cause**: Page load or selector wait exceeded timeout.

**Solution**: Increase timeout or use better selectors:
```javascript
await page.waitForSelector('.result', { timeout: 10000 });
```

## Resources

- **Playwright Documentation**: https://playwright.dev/docs/intro
- **API Reference**: https://playwright.dev/docs/api/class-playwright
- **Browser Automation Integration**: [/docs/browser-automation-integration.md](./browser-automation-integration.md)
- **Shared Dependencies Guide**: [/docs/PLUGIN_SHARED_DEPENDENCIES.md](./PLUGIN_SHARED_DEPENDENCIES.md)

## Next Steps

1. Create your BrowserService class
2. Implement plugin lifecycle hooks
3. Test locally with headful browser
4. Add error handling
5. Test with headless browser
6. Document your automation workflow
7. Publish to marketplace

Happy automating!
