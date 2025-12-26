# Analytics Quick Start

Firebase Analytics integration for tracking user behavior and application metrics.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  (React Components, Electron Main Process, Plugin System)   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Import tracking methods
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    /app/analytics.js                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tracking Methods:                                   │   │
│  │  • trackAppStart()                                   │   │
│  │  • trackNavigation()                                 │   │
│  │  • trackPluginInstall()                              │   │
│  │  • trackMarketplaceSearch()                          │   │
│  │  • trackUserAction()                                 │   │
│  │  • ... 20+ specialized methods                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Firebase Analytics SDK
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Firebase Platform                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • Event collection                                  │   │
│  │  • Real-time DebugView                               │   │
│  │  • BigQuery export                                   │   │
│  │  • Analytics dashboard                               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
/app/
  analytics.js              # Main analytics module (all tracking methods)
  main.js                   # App lifecycle tracking (trackAppStart)
  components/
    Marketplace.js          # Marketplace events
    Plugin.js               # Plugin lifecycle events
  actions/
    marketplace.js          # Marketplace actions tracking
  reducers/
    marketplace.js          # State change tracking
    pluginLibrary.js        # Plugin library tracking

/docs/
  ANALYTICS_INTEGRATION_GUIDE.md   # Complete integration guide
  ANALYTICS_EVENT_CATALOG.md       # Event reference
  analytics/
    README.md                       # This file
```

---

## How to Add Analytics to New Features

### Step 1: Import Analytics Methods

```javascript
// At the top of your file
import {
  trackNavigation,
  trackUserAction,
  trackPluginInstall
  // ... import only what you need
} from '../analytics';
```

### Step 2: Add Tracking Calls

```javascript
// Track screen navigation
componentDidMount() {
  trackNavigation('My New Feature', 'MainMenu');
}

// Track user actions
handleButtonClick = () => {
  trackUserAction('Button Clicked', 'MyFeature', {
    button_id: 'submit_form',
    form_valid: true
  });

  this.submitForm();
};

// Track plugin interactions
installPlugin = async (plugin) => {
  await pluginManager.install(plugin);
  trackPluginInstall(plugin.name, plugin.version, 'MyFeature');
};
```

### Step 3: Test

1. Run the app in development mode
2. Open Firebase Console → Analytics → DebugView
3. Perform your tracked actions
4. Verify events appear in DebugView with correct parameters

---

## Common Gotchas

### 1. **Forgetting to Import Analytics**

❌ **Wrong:**
```javascript
// No import
componentDidMount() {
  // trackNavigation is not defined!
  trackNavigation('Settings');
}
```

✅ **Correct:**
```javascript
import { trackNavigation } from '../analytics';

componentDidMount() {
  trackNavigation('Settings', 'MainMenu');
}
```

---

### 2. **Missing Required Parameters**

❌ **Wrong:**
```javascript
// Missing 'source' parameter
trackPluginInstall(plugin.name, plugin.version);
```

✅ **Correct:**
```javascript
trackPluginInstall(plugin.name, plugin.version, 'Marketplace');
```

---

### 3. **Tracking Too Much (PII)**

❌ **Wrong:**
```javascript
trackUserAction('Login', 'LoginPage', {
  email: user.email,           // ❌ PII!
  password: hashedPassword,    // ❌ Sensitive!
  ip_address: user.ip          // ❌ PII!
});
```

✅ **Correct:**
```javascript
trackUserAction('Login', 'LoginPage', {
  login_method: 'email',
  success: true,
  user_type: 'premium'
});
```

---

### 4. **Tracking Too Little**

❌ **Wrong:**
```javascript
// Generic, not useful
trackUserAction('Click', 'Page');
```

✅ **Correct:**
```javascript
trackUserAction('Export Data', 'DataManagement', {
  export_format: 'csv',
  record_count: 150,
  include_metadata: true
});
```

---

### 5. **Not Tracking Error Cases**

❌ **Wrong:**
```javascript
installPlugin = async (plugin) => {
  try {
    await pluginManager.install(plugin);
    trackPluginInstall(plugin.name, plugin.version, 'Marketplace');
  } catch (error) {
    // Error not tracked!
    showError(error);
  }
};
```

✅ **Correct:**
```javascript
installPlugin = async (plugin) => {
  try {
    await pluginManager.install(plugin);
    trackPluginInstall(plugin.name, plugin.version, 'Marketplace');
  } catch (error) {
    trackPluginError(plugin.name, 'install', error.message);
    showError(error);
  }
};
```

---

### 6. **Hardcoding Event Names**

❌ **Wrong:**
```javascript
// Inconsistent event names throughout codebase
analytics.logEvent('pluginInstalled', {...});
analytics.logEvent('plugin_install', {...});
analytics.logEvent('PLUGIN_INSTALL', {...});
```

✅ **Correct:**
```javascript
// Use the provided helper method
trackPluginInstall(plugin.name, plugin.version, 'Marketplace');
// Ensures consistent event naming
```

---

### 7. **Forgetting Optional Context**

⚠️ **Acceptable but not ideal:**
```javascript
trackPluginInstall(plugin.name, plugin.version, 'Marketplace');
```

✅ **Better:**
```javascript
trackPluginInstall(plugin.name, plugin.version, 'Marketplace', {
  install_duration_ms: installTime,
  plugin_size_bytes: plugin.size,
  first_plugin_install: isFirstInstall
});
```

---

### 8. **Async Tracking Issues**

❌ **Wrong:**
```javascript
async function doSomething() {
  await someAsyncOperation();
  trackUserAction('Operation Complete', 'Page');
  // If an error occurs above, this never fires
}
```

✅ **Correct:**
```javascript
async function doSomething() {
  try {
    await someAsyncOperation();
    trackUserAction('Operation Complete', 'Page', { success: true });
  } catch (error) {
    trackUserAction('Operation Failed', 'Page', {
      success: false,
      error_type: error.name
    });
  }
}
```

---

## Quick Reference: When to Use Which Method

| Scenario | Method | Example |
|----------|--------|---------|
| App starts | `trackAppStart()` | App initialization |
| User navigates | `trackNavigation()` | Open settings screen |
| User clicks tab | `trackTabClick()` | Switch to "Installed" tab |
| User clicks button | `trackUserAction()` | "Save Settings" button |
| User clicks link | `trackExternalLink()` | Opens plugin website |
| Marketplace opened | `trackMarketplaceView()` | Navigate to marketplace |
| User searches | `trackMarketplaceSearch()` | Search for "automation" |
| User filters results | `trackMarketplaceFilter()` | Filter by category |
| User sorts results | `trackMarketplaceSort()` | Sort by popularity |
| Plugin details viewed | `trackPluginView()` | Click plugin card |
| Plugin installed | `trackPluginInstall()` | Install button clicked |
| Plugin uninstalled | `trackPluginUninstall()` | Uninstall from settings |
| Plugin enabled | `trackPluginEnable()` | Toggle plugin on |
| Plugin disabled | `trackPluginDisable()` | Toggle plugin off |
| Plugin settings changed | `trackPluginSettings()` | Save plugin config |
| Plugin action executed | `trackPluginAction()` | Run plugin command |
| Plugin error occurs | `trackPluginError()` | Plugin fails to load |
| Aggregate usage | `aggregatePluginUsage()` | Hourly/on app close |

---

## Testing Checklist

Before submitting PR:

- [ ] Analytics import added to new files
- [ ] Tracking methods called at appropriate points
- [ ] All required parameters provided
- [ ] Optional context added where relevant
- [ ] No PII (emails, names, IPs) in parameters
- [ ] Error cases tracked
- [ ] Events appear in Firebase DebugView
- [ ] Event names follow conventions
- [ ] ESLint passes (`npm run lint`)

---

## Links to Full Documentation

- **[Analytics Integration Guide](../ANALYTICS_INTEGRATION_GUIDE.md)** - Complete integration patterns and enforcement
- **[Analytics Event Catalog](../ANALYTICS_EVENT_CATALOG.md)** - Full event reference with Firebase queries
- **[Contributing Guide](../../CONTRIBUTING.md)** - PR requirements including analytics

---

## Getting Help

- Check the [Integration Guide](../ANALYTICS_INTEGRATION_GUIDE.md) for detailed patterns
- Review the [Event Catalog](../ANALYTICS_EVENT_CATALOG.md) for event specifications
- Ask in #analytics channel
- Check Firebase DebugView for real-time debugging

---

**Remember:** Analytics is mandatory for all new features. Don't skip it!
