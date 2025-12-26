# 🔥 MANDATORY ANALYTICS INTEGRATION

## ⚠️ CRITICAL: ALL NEW FEATURES MUST INCLUDE ANALYTICS

Firebase Analytics integration is **MANDATORY** for all new features, screens, user interactions, and plugin integrations. This is not optional.

**No PR will be merged without proper analytics integration.**

Analytics helps us:
- Understand user behavior and preferences
- Identify popular features and unused functionality
- Track plugin usage and marketplace engagement
- Make data-driven decisions for product development
- Debug issues through user flow tracking

---

## Quick Checklist for Every PR

Before submitting your PR, verify:

- [ ] **Analytics import added** at the top of relevant files
- [ ] **Tracking methods called** at appropriate interaction points
- [ ] **Event names follow naming conventions** (camelCase, descriptive)
- [ ] **Required fields provided** for all tracking calls
- [ ] **ESLint analytics rules pass** (`npm run lint`)
- [ ] **Pre-commit hook passes** (automatic validation)
- [ ] **Manual testing completed** using Firebase Debug View
- [ ] **Documentation updated** if adding new event types

---

## Common Patterns

### Pattern 1: New Screen/Tab

When adding a new screen or tab, track navigation:

```javascript
import { trackNavigation, trackTabClick } from '../analytics';

// In component mount or route change
componentDidMount() {
  trackNavigation('Settings Screen');
}

// For tab navigation
handleTabChange = (tabName) => {
  trackTabClick(tabName, 'SettingsPage');
  // ... rest of tab logic
};
```

**Events fired:**
- `screen_view` (navigation)
- `tab_click` (tab changes)

---

### Pattern 2: User Action (Button, Link)

Track all meaningful user interactions:

```javascript
import { trackUserAction } from '../analytics';

// Button click
handleSaveClick = () => {
  trackUserAction('Save Settings', 'SettingsPage', {
    settings_changed: ['theme', 'language']
  });
  this.saveSettings();
};

// Toggle/checkbox
handleToggleChange = (enabled) => {
  trackUserAction('Toggle Feature', 'SettingsPage', {
    feature_name: 'dark_mode',
    enabled: enabled
  });
};
```

**Events fired:**
- `user_action`

---

### Pattern 3: External Link

Always track external link clicks:

```javascript
import { trackExternalLink } from '../analytics';

// Link component
<a
  href="https://example.com/docs"
  onClick={() => {
    trackExternalLink('https://example.com/docs', 'Documentation', 'HelpPage');
  }}
  target="_blank"
  rel="noopener noreferrer"
>
  View Docs
</a>

// Programmatic navigation
openExternalUrl = (url) => {
  trackExternalLink(url, 'Plugin Website', 'MarketplacePage');
  shell.openExternal(url);
};
```

**Events fired:**
- `external_link_click`

---

### Pattern 4: Plugin Integration

Track the complete plugin lifecycle:

```javascript
import {
  trackPluginInstall,
  trackPluginUninstall,
  trackPluginEnable,
  trackPluginDisable,
  trackPluginSettings,
  trackPluginAction,
  trackPluginError
} from '../analytics';

// Installation
installPlugin = async (plugin) => {
  try {
    await pluginManager.install(plugin);
    trackPluginInstall(plugin.name, plugin.version, 'Marketplace');
  } catch (error) {
    trackPluginError(plugin.name, 'install', error.message);
  }
};

// Uninstallation
uninstallPlugin = async (pluginName) => {
  trackPluginUninstall(pluginName, 'PluginManager');
  await pluginManager.uninstall(pluginName);
};

// Enable/Disable
togglePlugin = (plugin, enabled) => {
  if (enabled) {
    trackPluginEnable(plugin.name, 'SettingsPage');
  } else {
    trackPluginDisable(plugin.name, 'SettingsPage');
  }
  pluginManager.setEnabled(plugin.name, enabled);
};

// Settings changes
savePluginSettings = (pluginName, settings) => {
  trackPluginSettings(pluginName, Object.keys(settings), 'PluginSettings');
  pluginManager.saveSettings(pluginName, settings);
};

// Plugin-specific actions
executePluginAction = (plugin, action) => {
  trackPluginAction(plugin.name, action, 'PluginUI', {
    action_type: action.type,
    has_parameters: action.params ? true : false
  });
  plugin.execute(action);
};
```

**Events fired:**
- `plugin_install`
- `plugin_uninstall`
- `plugin_enable`
- `plugin_disable`
- `plugin_settings_change`
- `plugin_action`
- `plugin_error`

---

### Pattern 5: Marketplace Integration

Track marketplace interactions:

```javascript
import {
  trackMarketplaceView,
  trackMarketplaceSearch,
  trackMarketplaceFilter,
  trackMarketplaceSort,
  trackPluginView
} from '../analytics';

// Marketplace opened
componentDidMount() {
  trackMarketplaceView('MainNav');
}

// Search
handleSearch = (query) => {
  trackMarketplaceSearch(query, this.state.results.length);
  this.performSearch(query);
};

// Filtering
applyFilter = (filterType, filterValue) => {
  trackMarketplaceFilter(filterType, filterValue);
  this.setState({ activeFilter: { type: filterType, value: filterValue } });
};

// Sorting
changeSorting = (sortBy) => {
  trackMarketplaceSort(sortBy);
  this.sortPlugins(sortBy);
};

// Plugin details view
viewPluginDetails = (plugin) => {
  trackPluginView(plugin.name, plugin.version, 'MarketplaceGrid');
  this.openPluginModal(plugin);
};
```

**Events fired:**
- `marketplace_view`
- `marketplace_search`
- `marketplace_filter`
- `marketplace_sort`
- `plugin_view`

---

### Pattern 6: Aggregate Usage Tracking

Track cumulative usage metrics:

```javascript
import { aggregatePluginUsage } from '../analytics';

// Call periodically (e.g., on app close or every hour)
trackPluginUsageMetrics = () => {
  const plugins = pluginManager.getAllPlugins();

  plugins.forEach(plugin => {
    const metrics = pluginManager.getMetrics(plugin.name);

    aggregatePluginUsage(
      plugin.name,
      metrics.totalUses,
      metrics.totalDuration,
      metrics.errorCount,
      {
        last_used: metrics.lastUsedTimestamp,
        favorite: plugin.isFavorite
      }
    );
  });
};
```

**Events fired:**
- `plugin_usage_aggregate`

---

## Testing Analytics

### Using Firebase Debug View

1. **Enable Debug Mode:**
   ```bash
   # macOS/Linux
   adb shell setprop debug.firebase.analytics.app com.yourapp

   # Or set in code (development only)
   firebase.analytics().setAnalyticsCollectionEnabled(true);
   ```

2. **Open Firebase Console:**
   - Navigate to Firebase Console → Analytics → DebugView
   - Events appear in real-time as you interact with the app

3. **Verify Events:**
   - Check event names are correct
   - Verify all required parameters are present
   - Confirm parameter values are accurate
   - Test edge cases (errors, empty states)

4. **Monitor Event Stream:**
   ```
   DebugView shows:
   - Event name
   - Timestamp
   - All parameters
   - User properties
   ```

### Manual Testing Checklist

- [ ] Event fires at correct time
- [ ] Event name follows conventions
- [ ] All required parameters present
- [ ] Optional parameters populated when available
- [ ] No PII (Personally Identifiable Information) logged
- [ ] Error cases tracked appropriately
- [ ] Events appear in Firebase DebugView

---

## FAQ

### 1. **Do I need to track EVERY user action?**

Track meaningful interactions that help us understand user behavior:
- ✅ **Track:** Button clicks, navigation, feature usage, plugin interactions
- ❌ **Don't track:** Mouse movements, scroll events, typing in text fields

### 2. **What information should I include in event parameters?**

Include contextual information that helps answer:
- What action was taken?
- Where in the app did it happen?
- What was the outcome?
- Any relevant metadata (plugin name, filter type, etc.)

**Never include:**
- User email addresses
- Personal information
- Sensitive configuration data
- API keys or tokens

### 3. **How do I name events and parameters?**

**Events:** Use `camelCase` or `snake_case`, be descriptive
- ✅ Good: `plugin_install`, `marketplaceSearch`, `tabClick`
- ❌ Bad: `click`, `event1`, `thing_happened`

**Parameters:** Use `snake_case`, be specific
- ✅ Good: `plugin_name`, `source_screen`, `error_message`
- ❌ Bad: `name`, `from`, `error`

### 4. **What if my feature doesn't fit existing tracking methods?**

1. Check if existing methods can be adapted
2. Review [Analytics Event Catalog](./ANALYTICS_EVENT_CATALOG.md) for similar patterns
3. Create a new tracking method in `/app/analytics.js`
4. Document it in the event catalog
5. Update this guide with a new pattern

### 5. **How do I test analytics locally?**

Use Firebase DebugView (see Testing Analytics section above). Events appear in real-time.

Alternatively, check console logs in development mode:
```javascript
// analytics.js logs all events in development
console.log('[Analytics]', eventName, params);
```

### 6. **What happens if I forget to add analytics?**

1. **ESLint will warn you** about missing analytics imports
2. **Pre-commit hook will fail** if analytics rules aren't satisfied
3. **Code review will catch it** before merge
4. **PR checklist requires** analytics confirmation

### 7. **Can I disable analytics in development?**

Analytics are automatically disabled in development unless explicitly enabled. Check `analytics.js` for configuration.

### 8. **How do I track errors properly?**

Use `trackPluginError` or `trackUserAction` with error context:

```javascript
try {
  await riskyOperation();
} catch (error) {
  trackPluginError(pluginName, 'operation_name', error.message, {
    stack_trace: error.stack,
    user_action: 'button_click'
  });
  // Handle error...
}
```

---

## Enforcement

### ESLint Rules

Custom ESLint rules check for analytics integration:

```javascript
// .eslintrc.js
rules: {
  'analytics/require-tracking': 'warn',
  'analytics/no-pii': 'error',
  'analytics/valid-event-names': 'error'
}
```

Run: `npm run lint` to check compliance.

### Pre-commit Hooks

Git pre-commit hooks automatically verify:
- Analytics import present in modified files
- No obvious PII in tracking calls
- Event naming conventions followed

Hook runs automatically on `git commit`.

### Code Review

Reviewers will check:
- [ ] Analytics properly integrated
- [ ] Event names follow conventions
- [ ] Parameters are meaningful
- [ ] No PII logged
- [ ] Error cases tracked

---

## Additional Resources

- [Analytics Event Catalog](./ANALYTICS_EVENT_CATALOG.md) - Complete event reference
- [Analytics Quick Start](./analytics/README.md) - Architecture overview
- [Firebase Analytics Documentation](https://firebase.google.com/docs/analytics)
- [CONTRIBUTING.md](../CONTRIBUTING.md) - PR requirements

---

**Remember: Analytics integration is not optional. It's a core requirement for all features.**

If you have questions, ask in #analytics or consult the documentation above.
