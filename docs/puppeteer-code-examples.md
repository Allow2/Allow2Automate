# Puppeteer-core Code Examples

**Practical code examples for migrating BrowserService from Playwright to Puppeteer-core**

---

## Basic Setup

### Installation

```bash
cd /mnt/ai/automate/automate/plugins/allow2automate-battle.net
npm uninstall playwright
npm install puppeteer-core@latest
npm install puppeteer-in-electron@latest  # Optional but recommended
```

### package.json

```json
{
  "name": "allow2automate-battle.net",
  "version": "2.0.0",
  "dependencies": {
    "puppeteer-core": "^21.6.0",
    "puppeteer-in-electron": "^3.0.5",
    "react": "^16.14.0"
  },
  "peerDependencies": {
    "electron": ">=10.0.0"
  }
}
```

---

## Complete BrowserService Migration

### Original (Playwright)

```javascript
// /plugins/allow2automate-battle.net/src/services/BrowserService.js
const { chromium } = require('playwright');

class BrowserService {
  constructor(options = {}) {
    this.options = {
      headless: true,
      timeout: 30000,
      onLog: console.log,
      onError: console.error,
      minDelayMs: 1000,
      maxDelayMs: 3000,
      tokenUrlCooldown: 3600000,
      sessionKeepaliveInterval: 600000,
      enableAntiBot: true,
      ...options
    };

    this.browser = null;
    this.context = null;
    this.keepAliveInterval = null;

    this.sessionState = {
      lastTokenAuth: 0,
      sessionCookies: [],
      sessionValid: false,
      authAttempts: 0,
      lastActivity: Date.now(),
      currentToken: null
    };

    this.cache = {
      children: { data: null, timestamp: 0, ttl: 300000 },
      status: { data: null, timestamp: 0, ttl: 30000 }
    };
  }

  async init() {
    if (this.browser && this.context) {
      this.options.onLog('Reusing existing browser context');
      return;
    }

    this.browser = await chromium.launch({
      headless: this.options.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.context = await this.browser.newContext({
      userAgent: this.getRandomUserAgent(),
      viewport: this.getRandomViewport(),
      storageState: {
        cookies: this.sessionState.sessionCookies
      }
    });
  }

  async forceReauth(token) {
    await this.init();

    const now = Date.now();
    const timeSinceLastAuth = now - this.sessionState.lastTokenAuth;

    if (timeSinceLastAuth < this.options.tokenUrlCooldown) {
      const waitTime = Math.ceil((this.options.tokenUrlCooldown - timeSinceLastAuth) / 1000);
      this.options.onLog(`Token URL cooldown active. ${waitTime}s remaining.`);

      const refreshResult = await this.refreshSession();
      if (refreshResult.success) {
        return refreshResult;
      }

      return {
        success: false,
        error: `Wait ${waitTime} seconds or use refreshSession()`
      };
    }

    const page = await this.context.newPage();

    try {
      await page.goto(`https://account.battle.net/parent-portal/token/${token}`, {
        timeout: this.options.timeout,
        waitUntil: 'networkidle'
      });

      this.sessionState.lastTokenAuth = now;
      this.sessionState.sessionCookies = await this.context.cookies();
      this.sessionState.sessionValid = true;
      this.sessionState.currentToken = token;

      await page.close();

      this.startKeepAlive();

      return { success: true, message: 'Authentication successful' };
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  async cleanup() {
    this.stopKeepAlive();
    this.clearCache();

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.sessionState = {
      lastTokenAuth: 0,
      sessionCookies: [],
      sessionValid: false,
      authAttempts: 0,
      lastActivity: Date.now(),
      currentToken: null
    };
  }
}
```

### Migrated (Puppeteer-core)

```javascript
// /plugins/allow2automate-battle.net/src/services/BrowserService.js
const puppeteer = require('puppeteer-core');

class BrowserService {
  constructor(options = {}) {
    this.options = {
      headless: true,
      timeout: 30000,
      onLog: console.log,
      onError: console.error,
      minDelayMs: 1000,
      maxDelayMs: 3000,
      tokenUrlCooldown: 3600000,
      sessionKeepaliveInterval: 600000,
      enableAntiBot: true,
      ...options
    };

    this.browser = null;
    this.keepAliveInterval = null;

    this.sessionState = {
      lastTokenAuth: 0,
      sessionCookies: [],
      sessionValid: false,
      authAttempts: 0,
      lastActivity: Date.now(),
      currentToken: null
    };

    this.cache = {
      children: { data: null, timestamp: 0, ttl: 300000 },
      status: { data: null, timestamp: 0, ttl: 30000 }
    };
  }

  async init() {
    if (this.browser) {
      this.options.onLog('Reusing existing browser instance');
      return;
    }

    // KEY CHANGE: Use Electron's Chromium via process.execPath
    this.browser = await puppeteer.launch({
      executablePath: process.execPath,  // Use Electron's bundled Chromium
      headless: this.options.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'  // Helps with memory issues
      ]
    });

    this.options.onLog('Browser launched using Electron Chromium');
  }

  async forceReauth(token) {
    await this.init();

    const now = Date.now();
    const timeSinceLastAuth = now - this.sessionState.lastTokenAuth;

    if (timeSinceLastAuth < this.options.tokenUrlCooldown) {
      const waitTime = Math.ceil((this.options.tokenUrlCooldown - timeSinceLastAuth) / 1000);
      this.options.onLog(`Token URL cooldown active. ${waitTime}s remaining.`);

      const refreshResult = await this.refreshSession();
      if (refreshResult.success) {
        return refreshResult;
      }

      return {
        success: false,
        error: `Wait ${waitTime} seconds or use refreshSession()`
      };
    }

    // KEY CHANGE: Create page directly from browser (no context)
    const page = await this.browser.newPage();

    try {
      // KEY CHANGE: Set user agent and viewport on page
      await page.setUserAgent(this.getRandomUserAgent());
      await page.setViewport(this.getRandomViewport());

      // KEY CHANGE: Restore cookies on page
      if (this.sessionState.sessionCookies.length > 0) {
        await page.setCookie(...this.sessionState.sessionCookies);
      }

      // KEY CHANGE: waitUntil uses 'networkidle0' instead of 'networkidle'
      await page.goto(`https://account.battle.net/parent-portal/token/${token}`, {
        timeout: this.options.timeout,
        waitUntil: 'networkidle0'
      });

      this.sessionState.lastTokenAuth = now;
      // KEY CHANGE: Get cookies from page, not context
      this.sessionState.sessionCookies = await page.cookies();
      this.sessionState.sessionValid = true;
      this.sessionState.currentToken = token;

      await page.close();

      this.startKeepAlive();

      return { success: true, message: 'Authentication successful' };
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  async cleanup() {
    this.stopKeepAlive();
    this.clearCache();

    // KEY CHANGE: No context to close (simpler cleanup)
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.sessionState = {
      lastTokenAuth: 0,
      sessionCookies: [],
      sessionValid: false,
      authAttempts: 0,
      lastActivity: Date.now(),
      currentToken: null
    };
  }
}
```

---

## Key Method Comparisons

### Session Validation

**Playwright:**
```javascript
async isSessionValid() {
  if (!this.context) {
    return false;
  }

  const page = await this.context.newPage();

  try {
    await page.goto('https://account.battle.net/parent-portal', {
      timeout: 10000,
      waitUntil: 'domcontentloaded'
    });

    const currentUrl = page.url();
    await page.close();

    const valid = currentUrl.includes('parent-portal') &&
                  !currentUrl.includes('login');

    if (!valid) {
      this.sessionState.sessionValid = false;
    }

    return valid;
  } catch (error) {
    await page.close();
    return false;
  }
}
```

**Puppeteer-core:**
```javascript
async isSessionValid() {
  if (!this.browser) {
    return false;
  }

  const page = await this.browser.newPage();

  try {
    // Restore cookies before checking
    if (this.sessionState.sessionCookies.length > 0) {
      await page.setCookie(...this.sessionState.sessionCookies);
    }

    await page.goto('https://account.battle.net/parent-portal', {
      timeout: 10000,
      waitUntil: 'domcontentloaded'
    });

    const currentUrl = page.url();
    await page.close();

    const valid = currentUrl.includes('parent-portal') &&
                  !currentUrl.includes('login');

    if (!valid) {
      this.sessionState.sessionValid = false;
    }

    return valid;
  } catch (error) {
    await page.close();
    return false;
  }
}
```

### Session Refresh

**Playwright:**
```javascript
async refreshSession() {
  if (!this.context) {
    return { success: false, error: 'Browser not initialized' };
  }

  const page = await this.context.newPage();

  try {
    await page.goto('https://account.battle.net/parent-portal', {
      timeout: this.options.timeout,
      waitUntil: 'networkidle'
    });

    this.sessionState.sessionCookies = await this.context.cookies();
    this.sessionState.lastActivity = Date.now();
    this.sessionState.sessionValid = true;

    await page.close();

    return { success: true, message: 'Session refreshed' };
  } catch (error) {
    await page.close();
    this.sessionState.sessionValid = false;
    return { success: false, error: error.message };
  }
}
```

**Puppeteer-core:**
```javascript
async refreshSession() {
  if (!this.browser) {
    return { success: false, error: 'Browser not initialized' };
  }

  const page = await this.browser.newPage();

  try {
    // Restore cookies before navigating
    if (this.sessionState.sessionCookies.length > 0) {
      await page.setCookie(...this.sessionState.sessionCookies);
    }

    await page.goto('https://account.battle.net/parent-portal', {
      timeout: this.options.timeout,
      waitUntil: 'networkidle0'
    });

    // Update cookies after navigation
    this.sessionState.sessionCookies = await page.cookies();
    this.sessionState.lastActivity = Date.now();
    this.sessionState.sessionValid = true;

    await page.close();

    return { success: true, message: 'Session refreshed' };
  } catch (error) {
    await page.close();
    this.sessionState.sessionValid = false;
    return { success: false, error: error.message };
  }
}
```

### Get Children Data

**Playwright:**
```javascript
async getChildren(token, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = this.getCached('children');
    if (cached) {
      this.options.onLog('Using cached children data');
      return cached;
    }
  }

  await this.init();

  const sessionValid = await this.isSessionValid();
  if (!sessionValid) {
    this.options.onLog('Session invalid, refreshing...');
    await this.refreshSession();
  }

  const page = await this.context.newPage();

  try {
    await page.goto('https://account.battle.net/parent-portal', {
      timeout: this.options.timeout,
      waitUntil: 'networkidle'
    });

    await page.waitForSelector('.child-list', { timeout: 10000 });

    const children = await page.$$eval('.child-item', items => {
      return items.map(item => ({
        id: item.getAttribute('data-child-id'),
        name: item.querySelector('.child-name').textContent,
        status: item.querySelector('.child-status').textContent
      }));
    });

    await page.close();

    this.setCached('children', children);
    return children;
  } catch (error) {
    await page.close();
    throw error;
  }
}
```

**Puppeteer-core:**
```javascript
async getChildren(token, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = this.getCached('children');
    if (cached) {
      this.options.onLog('Using cached children data');
      return cached;
    }
  }

  await this.init();

  const sessionValid = await this.isSessionValid();
  if (!sessionValid) {
    this.options.onLog('Session invalid, refreshing...');
    await this.refreshSession();
  }

  const page = await this.browser.newPage();

  try {
    // Restore cookies
    if (this.sessionState.sessionCookies.length > 0) {
      await page.setCookie(...this.sessionState.sessionCookies);
    }

    await page.goto('https://account.battle.net/parent-portal', {
      timeout: this.options.timeout,
      waitUntil: 'networkidle0'
    });

    await page.waitForSelector('.child-list', { timeout: 10000 });

    const children = await page.$$eval('.child-item', items => {
      return items.map(item => ({
        id: item.getAttribute('data-child-id'),
        name: item.querySelector('.child-name').textContent,
        status: item.querySelector('.child-status').textContent
      }));
    });

    await page.close();

    this.setCached('children', children);
    return children;
  } catch (error) {
    await page.close();
    throw error;
  }
}
```

### Humanized Click

**Playwright:**
```javascript
async humanClick(page, selector) {
  if (!this.options.enableAntiBot) {
    await page.click(selector);
    return;
  }

  await this.randomDelay(this.options.minDelayMs, this.options.maxDelayMs);

  await page.waitForSelector(selector);
  const element = await page.$(selector);

  const box = await element.boundingBox();
  if (!box) {
    await element.click();
    return;
  }

  const x = box.x + Math.random() * box.width;
  const y = box.y + Math.random() * box.height;

  await page.mouse.move(x - 10, y - 10);
  await this.randomDelay(50, 150);
  await page.mouse.move(x, y);
  await this.randomDelay(50, 150);

  await element.click();
}
```

**Puppeteer-core:**
```javascript
async humanClick(page, selector) {
  if (!this.options.enableAntiBot) {
    await page.click(selector);
    return;
  }

  await this.randomDelay(this.options.minDelayMs, this.options.maxDelayMs);

  await page.waitForSelector(selector);
  const element = await page.$(selector);

  const box = await element.boundingBox();
  if (!box) {
    await element.click();
    return;
  }

  const x = box.x + Math.random() * box.width;
  const y = box.y + Math.random() * box.height;

  await page.mouse.move(x - 10, y - 10);
  await this.randomDelay(50, 150);
  await page.mouse.move(x, y);
  await this.randomDelay(50, 150);

  await element.click();
}
```

**Note:** This method is identical! No changes needed.

---

## Advanced Integration with puppeteer-in-electron

### Setup

```javascript
const pie = require('puppeteer-in-electron');
const { app } = require('electron');

class BrowserService {
  async init() {
    // Initialize puppeteer-in-electron (do this once at app startup)
    if (!this.pieInitialized) {
      await pie.initialize(app);
      this.pieInitialized = true;
    }

    // Connect to Electron's browser window (optional)
    if (this.electronWindow) {
      this.browser = await pie.connect(app, this.electronWindow);
    } else {
      // Or use standalone mode
      this.browser = await pie.launch({
        headless: this.options.headless,
        args: ['--no-sandbox']
      });
    }
  }
}
```

### Benefits of puppeteer-in-electron

1. **Easier setup** - Handles Electron integration automatically
2. **Browser window control** - Can control existing Electron windows
3. **Better debugging** - Integrates with Electron DevTools
4. **Simpler API** - Abstracts away executablePath configuration

---

## Testing Examples

### Unit Test

```javascript
const { expect } = require('chai');
const BrowserService = require('./BrowserService');

describe('BrowserService with Puppeteer-core', () => {
  let browser;

  beforeEach(() => {
    browser = new BrowserService({
      headless: true,
      onLog: () => {},
      onError: () => {}
    });
  });

  afterEach(async () => {
    await browser.cleanup();
  });

  it('should launch browser using Electron Chromium', async () => {
    await browser.init();
    expect(browser.browser).to.not.be.null;
  });

  it('should persist session cookies', async () => {
    const token = 'test-token-123';
    await browser.forceReauth(token);

    expect(browser.sessionState.sessionCookies).to.have.length.above(0);
    expect(browser.sessionState.sessionValid).to.be.true;
  });

  it('should use cached data', async () => {
    const token = 'test-token-123';
    await browser.forceReauth(token);

    const t1 = Date.now();
    const children1 = await browser.getChildren(token);
    const t2 = Date.now();

    const children2 = await browser.getChildren(token);
    const t3 = Date.now();

    expect(t3 - t2).to.be.lessThan(t2 - t1);
  });

  it('should enforce token URL cooldown', async () => {
    const token = 'test-token-123';

    await browser.forceReauth(token);

    const result = await browser.forceReauth(token);
    expect(result.success).to.be.false;
    expect(result.error).to.include('Wait');
  });
});
```

### Integration Test

```javascript
const { expect } = require('chai');
const BrowserService = require('./BrowserService');

describe('Battle.net Integration with Puppeteer-core', function() {
  this.timeout(30000);

  let browser;
  const realToken = process.env.BATTLENET_TEST_TOKEN;

  before(function() {
    if (!realToken) {
      this.skip();
    }
  });

  beforeEach(() => {
    browser = new BrowserService({
      headless: true,
      enableAntiBot: true
    });
  });

  afterEach(async () => {
    await browser.cleanup();
  });

  it('should authenticate with real token', async () => {
    const result = await browser.forceReauth(realToken);
    expect(result.success).to.be.true;
  });

  it('should retrieve children list', async () => {
    await browser.forceReauth(realToken);
    const children = await browser.getChildren(realToken);

    expect(children).to.be.an('array');
    expect(children.length).to.be.above(0);
    expect(children[0]).to.have.property('id');
    expect(children[0]).to.have.property('name');
  });

  it('should update controls', async () => {
    await browser.forceReauth(realToken);
    const children = await browser.getChildren(realToken);

    const result = await browser.updateControls(realToken, children[0].id, {
      daily_hours: 2
    });

    expect(result.success).to.be.true;
  });
});
```

---

## Performance Comparison Script

```javascript
const BrowserService = require('./BrowserService');
const fs = require('fs');

async function benchmarkBrowser() {
  console.log('Starting Puppeteer-core benchmark...\n');

  const browser = new BrowserService({ headless: true });

  // Measure browser startup
  const startupStart = Date.now();
  await browser.init();
  const startupTime = Date.now() - startupStart;

  console.log(`✅ Browser startup: ${startupTime}ms`);

  // Measure memory usage
  const memBefore = process.memoryUsage();
  console.log(`📊 Memory (before operations): ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);

  // Measure first operation
  const token = 'test-token';
  const op1Start = Date.now();
  await browser.forceReauth(token);
  const op1Time = Date.now() - op1Start;

  console.log(`✅ First authentication: ${op1Time}ms`);

  // Measure cached operation
  const op2Start = Date.now();
  const children = await browser.getChildren(token);
  const op2Time = Date.now() - op2Start;

  console.log(`✅ Get children (network): ${op2Time}ms`);

  // Measure cache hit
  const op3Start = Date.now();
  await browser.getChildren(token);
  const op3Time = Date.now() - op3Start;

  console.log(`✅ Get children (cached): ${op3Time}ms`);
  console.log(`📈 Cache speedup: ${Math.round((op2Time / op3Time) * 100)}%`);

  // Final memory
  const memAfter = process.memoryUsage();
  console.log(`📊 Memory (after operations): ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);
  console.log(`📊 Memory increase: ${Math.round((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024)}MB`);

  await browser.cleanup();

  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    browser: 'puppeteer-core',
    metrics: {
      startupTime,
      firstOperation: op1Time,
      networkOperation: op2Time,
      cachedOperation: op3Time,
      cacheSpeedup: Math.round((op2Time / op3Time) * 100),
      memoryBefore: Math.round(memBefore.heapUsed / 1024 / 1024),
      memoryAfter: Math.round(memAfter.heapUsed / 1024 / 1024),
      memoryIncrease: Math.round((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024)
    }
  };

  fs.writeFileSync(
    'benchmark-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n✅ Benchmark complete! Results saved to benchmark-results.json');
}

benchmarkBrowser().catch(console.error);
```

---

## Common Patterns

### Pattern 1: Create Page with Session

```javascript
async createAuthenticatedPage() {
  await this.init();

  const page = await this.browser.newPage();

  // Set standard options
  await page.setUserAgent(this.getRandomUserAgent());
  await page.setViewport(this.getRandomViewport());

  // Restore session
  if (this.sessionState.sessionCookies.length > 0) {
    await page.setCookie(...this.sessionState.sessionCookies);
  }

  return page;
}
```

### Pattern 2: Safe Navigation

```javascript
async navigateWithRetry(page, url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.goto(url, {
        timeout: this.options.timeout,
        waitUntil: 'networkidle0'
      });
      return true;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await this.randomDelay(1000, 3000);
    }
  }
  return false;
}
```

### Pattern 3: Extract Data with Fallback

```javascript
async extractText(page, selector, fallback = '') {
  try {
    return await page.$eval(selector, el => el.textContent.trim());
  } catch (error) {
    this.options.onLog(`Failed to extract ${selector}, using fallback`);
    return fallback;
  }
}
```

### Pattern 4: Multiple Elements

```javascript
async extractChildren(page) {
  return await page.$$eval('.child-item', items => {
    return items.map(item => ({
      id: item.getAttribute('data-child-id'),
      name: item.querySelector('.child-name')?.textContent || '',
      status: item.querySelector('.child-status')?.textContent || 'unknown',
      avatar: item.querySelector('.child-avatar')?.src || ''
    }));
  });
}
```

---

## Debugging Tips

### Enable Verbose Logging

```javascript
const browser = new BrowserService({
  headless: false,  // See what's happening
  onLog: (msg) => console.log(`[Browser] ${msg}`),
  onError: (err) => console.error(`[Browser Error] ${err}`)
});
```

### Screenshot on Error

```javascript
async getChildren(token) {
  const page = await this.browser.newPage();

  try {
    // ... your code
  } catch (error) {
    // Save screenshot for debugging
    await page.screenshot({
      path: `error-${Date.now()}.png`,
      fullPage: true
    });
    throw error;
  } finally {
    await page.close();
  }
}
```

### Monitor Network Requests

```javascript
async init() {
  this.browser = await puppeteer.launch({ /* ... */ });

  if (!this.options.headless) {
    const page = await this.browser.newPage();

    // Log all requests
    page.on('request', request => {
      console.log('→', request.method(), request.url());
    });

    // Log all responses
    page.on('response', response => {
      console.log('←', response.status(), response.url());
    });
  }
}
```

---

## Summary of Changes

| Aspect | Change Required |
|--------|----------------|
| **Import** | ✅ Simple change |
| **Launch** | ✅ Add executablePath |
| **Context** | ✅ Remove (use browser directly) |
| **Cookies** | ✅ Move to page-level |
| **User Agent** | ✅ Move to page-level |
| **Viewport** | ✅ Move to page-level |
| **Wait Conditions** | ✅ networkidle → networkidle0 |
| **Text Extraction** | ✅ Use $eval |
| **Everything Else** | ✅ Identical API |

**Total Lines Changed:** ~50-100 lines out of 999 (~5-10% of code)

**Migration Difficulty:** ⭐⭐☆☆☆ (Easy)

---

**Last Updated:** December 29, 2024
**Document Version:** 1.0
