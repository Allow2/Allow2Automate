# Complete Analytics Event Reference

This document catalogs all Firebase Analytics events tracked in the application.

---

## Table of Contents

1. [App Lifecycle Events](#app-lifecycle-events)
2. [Navigation Events](#navigation-events)
3. [Marketplace Events](#marketplace-events)
4. [Plugin Lifecycle Events](#plugin-lifecycle-events)
5. [Plugin Interaction Events](#plugin-interaction-events)
6. [Usage Aggregation Events](#usage-aggregation-events)
7. [User Action Events](#user-action-events)
8. [External Link Events](#external-link-events)

---

## App Lifecycle Events

### `trackAppStart()`

**When it fires:** Application startup

**Required fields:** None

**Optional fields:**
- `platform`: Operating system (auto-detected)
- `app_version`: Application version (auto-detected)
- `electron_version`: Electron version (auto-detected)

**Code example:**
```javascript
import { trackAppStart } from './analytics';

// In main.js or app initialization
app.on('ready', () => {
  trackAppStart();
  createWindow();
});
```

**Firebase query example:**
```sql
SELECT
  event_timestamp,
  user_pseudo_id,
  platform.operating_system,
  app_info.version
FROM `project.analytics_events`
WHERE event_name = 'app_start'
ORDER BY event_timestamp DESC
```

---

### `trackUserLogin(userId, method)`

**When it fires:** User successfully logs in

**Required fields:**
- `userId` (string): User identifier (hashed/anonymized)
- `method` (string): Authentication method used

**Optional fields:**
- `first_login` (boolean): Is this the user's first login?

**Code example:**
```javascript
import { trackUserLogin } from './analytics';

const handleLogin = async (email, password) => {
  const user = await authService.login(email, password);
  trackUserLogin(user.anonymousId, 'email_password');
};
```

**Firebase query example:**
```sql
SELECT
  event_date,
  COUNT(DISTINCT user_pseudo_id) as unique_users,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'method') as login_method
FROM `project.analytics_events`
WHERE event_name = 'user_login'
GROUP BY event_date, login_method
```

---

## Navigation Events

### `trackNavigation(screenName, source)`

**When it fires:** User navigates to a new screen/view

**Required fields:**
- `screenName` (string): Name of the destination screen

**Optional fields:**
- `source` (string): Where navigation originated from

**Code example:**
```javascript
import { trackNavigation } from './analytics';

class SettingsPage extends Component {
  componentDidMount() {
    trackNavigation('Settings Screen', 'MainMenu');
  }
}
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'screen_name') as screen,
  COUNT(*) as views
FROM `project.analytics_events`
WHERE event_name = 'screen_view'
GROUP BY screen
ORDER BY views DESC
```

---

### `trackTabClick(tabName, parentScreen)`

**When it fires:** User clicks a tab to switch views

**Required fields:**
- `tabName` (string): Name of the clicked tab
- `parentScreen` (string): Screen containing the tabs

**Optional fields:**
- `previous_tab` (string): Previously active tab

**Code example:**
```javascript
import { trackTabClick } from './analytics';

handleTabChange = (newTab) => {
  trackTabClick(newTab, 'SettingsPage');
  this.setState({ activeTab: newTab });
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'tab_name') as tab,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'parent_screen') as screen,
  COUNT(*) as clicks
FROM `project.analytics_events`
WHERE event_name = 'tab_click'
GROUP BY tab, screen
ORDER BY clicks DESC
```

---

## Marketplace Events

### `trackMarketplaceView(source)`

**When it fires:** Marketplace screen is opened

**Required fields:**
- `source` (string): Where the marketplace was opened from

**Optional fields:**
- `total_plugins` (number): Number of plugins available
- `installed_plugins` (number): Number of currently installed plugins

**Code example:**
```javascript
import { trackMarketplaceView } from './analytics';

class MarketplacePage extends Component {
  componentDidMount() {
    trackMarketplaceView('MainNavigation');
  }
}
```

**Firebase query example:**
```sql
SELECT
  event_date,
  COUNT(*) as marketplace_views,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'source') as source
FROM `project.analytics_events`
WHERE event_name = 'marketplace_view'
GROUP BY event_date, source
```

---

### `trackMarketplaceSearch(query, resultCount)`

**When it fires:** User performs a search in the marketplace

**Required fields:**
- `query` (string): Search query text
- `resultCount` (number): Number of results returned

**Optional fields:**
- `filters_active` (boolean): Whether filters were applied
- `search_duration_ms` (number): Time to complete search

**Code example:**
```javascript
import { trackMarketplaceSearch } from './analytics';

handleSearch = (searchText) => {
  const results = this.searchPlugins(searchText);
  trackMarketplaceSearch(searchText, results.length);
  this.setState({ searchResults: results });
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'search_term') as query,
  COUNT(*) as search_count,
  AVG((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value')) as avg_results
FROM `project.analytics_events`
WHERE event_name = 'marketplace_search'
GROUP BY query
ORDER BY search_count DESC
LIMIT 50
```

---

### `trackMarketplaceFilter(filterType, filterValue)`

**When it fires:** User applies a filter in the marketplace

**Required fields:**
- `filterType` (string): Type of filter (category, rating, etc.)
- `filterValue` (string): Filter value selected

**Optional fields:**
- `results_count` (number): Number of results after filtering

**Code example:**
```javascript
import { trackMarketplaceFilter } from './analytics';

applyFilter = (type, value) => {
  trackMarketplaceFilter(type, value);
  this.setState({
    activeFilters: { ...this.state.activeFilters, [type]: value }
  });
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'filter_type') as filter,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'filter_value') as value,
  COUNT(*) as uses
FROM `project.analytics_events`
WHERE event_name = 'marketplace_filter'
GROUP BY filter, value
ORDER BY uses DESC
```

---

### `trackMarketplaceSort(sortBy)`

**When it fires:** User changes marketplace sorting

**Required fields:**
- `sortBy` (string): Sorting criteria (popularity, recent, name, etc.)

**Optional fields:**
- `sort_order` (string): Ascending or descending

**Code example:**
```javascript
import { trackMarketplaceSort } from './analytics';

handleSortChange = (sortOption) => {
  trackMarketplaceSort(sortOption);
  this.sortPluginList(sortOption);
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'sort_by') as sort_method,
  COUNT(*) as usage_count
FROM `project.analytics_events`
WHERE event_name = 'marketplace_sort'
GROUP BY sort_method
ORDER BY usage_count DESC
```

---

### `trackPluginView(pluginName, pluginVersion, source)`

**When it fires:** User views plugin details

**Required fields:**
- `pluginName` (string): Plugin identifier
- `pluginVersion` (string): Plugin version
- `source` (string): Where the view was triggered from

**Optional fields:**
- `plugin_category` (string): Plugin category
- `plugin_rating` (number): Plugin rating
- `is_installed` (boolean): Whether plugin is already installed

**Code example:**
```javascript
import { trackPluginView } from './analytics';

openPluginDetails = (plugin) => {
  trackPluginView(plugin.name, plugin.version, 'MarketplaceGrid');
  this.showModal(plugin);
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plugin_name') as plugin,
  COUNT(*) as views,
  COUNT(DISTINCT user_pseudo_id) as unique_viewers
FROM `project.analytics_events`
WHERE event_name = 'plugin_view'
GROUP BY plugin
ORDER BY views DESC
LIMIT 20
```

---

## Plugin Lifecycle Events

### `trackPluginInstall(pluginName, pluginVersion, source)`

**When it fires:** Plugin installation completes successfully

**Required fields:**
- `pluginName` (string): Plugin identifier
- `pluginVersion` (string): Plugin version installed
- `source` (string): Where installation was initiated

**Optional fields:**
- `install_duration_ms` (number): Time to install
- `plugin_size_bytes` (number): Plugin size
- `first_install` (boolean): Is this the first install of any plugin?

**Code example:**
```javascript
import { trackPluginInstall } from './analytics';

installPlugin = async (plugin) => {
  const startTime = Date.now();
  await pluginManager.install(plugin);
  const duration = Date.now() - startTime;

  trackPluginInstall(plugin.name, plugin.version, 'Marketplace', {
    install_duration_ms: duration
  });
};
```

**Firebase query example:**
```sql
SELECT
  event_date,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plugin_name') as plugin,
  COUNT(*) as installs,
  AVG((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'install_duration_ms')) as avg_install_time_ms
FROM `project.analytics_events`
WHERE event_name = 'plugin_install'
GROUP BY event_date, plugin
ORDER BY event_date DESC, installs DESC
```

---

### `trackPluginUninstall(pluginName, source)`

**When it fires:** Plugin is uninstalled

**Required fields:**
- `pluginName` (string): Plugin identifier
- `source` (string): Where uninstall was initiated

**Optional fields:**
- `days_installed` (number): How long plugin was installed
- `total_uses` (number): Number of times plugin was used
- `reason` (string): Reason for uninstall (if collected)

**Code example:**
```javascript
import { trackPluginUninstall } from './analytics';

uninstallPlugin = async (pluginName) => {
  const metrics = await pluginManager.getMetrics(pluginName);

  trackPluginUninstall(pluginName, 'PluginSettings', {
    days_installed: metrics.daysInstalled,
    total_uses: metrics.totalUses
  });

  await pluginManager.uninstall(pluginName);
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plugin_name') as plugin,
  COUNT(*) as uninstalls,
  AVG((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'days_installed')) as avg_days_installed
FROM `project.analytics_events`
WHERE event_name = 'plugin_uninstall'
GROUP BY plugin
ORDER BY uninstalls DESC
```

---

### `trackPluginDelete(pluginName, source)`

**When it fires:** Plugin is deleted/removed

**Required fields:**
- `pluginName` (string): Plugin identifier
- `source` (string): Where deletion was initiated

**Optional fields:**
- `delete_data` (boolean): Whether user data was also deleted

**Code example:**
```javascript
import { trackPluginDelete } from './analytics';

deletePlugin = async (pluginName, deleteUserData) => {
  trackPluginDelete(pluginName, 'PluginManager', {
    delete_data: deleteUserData
  });

  await pluginManager.delete(pluginName, deleteUserData);
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plugin_name') as plugin,
  COUNT(*) as deletions
FROM `project.analytics_events`
WHERE event_name = 'plugin_delete'
GROUP BY plugin
ORDER BY deletions DESC
```

---

### `trackPluginEnable(pluginName, source)`

**When it fires:** Plugin is enabled/activated

**Required fields:**
- `pluginName` (string): Plugin identifier
- `source` (string): Where enable was triggered

**Optional fields:**
- `auto_enabled` (boolean): Whether plugin was auto-enabled on install

**Code example:**
```javascript
import { trackPluginEnable } from './analytics';

enablePlugin = (pluginName) => {
  trackPluginEnable(pluginName, 'PluginToggle');
  pluginManager.enable(pluginName);
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plugin_name') as plugin,
  COUNT(*) as enables
FROM `project.analytics_events`
WHERE event_name = 'plugin_enable'
GROUP BY plugin
ORDER BY enables DESC
```

---

### `trackPluginDisable(pluginName, source)`

**When it fires:** Plugin is disabled/deactivated

**Required fields:**
- `pluginName` (string): Plugin identifier
- `source` (string): Where disable was triggered

**Optional fields:**
- `reason` (string): Reason for disabling (if known)

**Code example:**
```javascript
import { trackPluginDisable } from './analytics';

disablePlugin = (pluginName, reason) => {
  trackPluginDisable(pluginName, 'PluginToggle', { reason });
  pluginManager.disable(pluginName);
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plugin_name') as plugin,
  COUNT(*) as disables
FROM `project.analytics_events`
WHERE event_name = 'plugin_disable'
GROUP BY plugin
ORDER BY disables DESC
```

---

## Plugin Interaction Events

### `trackPluginSettings(pluginName, settingsChanged, source)`

**When it fires:** Plugin settings are modified

**Required fields:**
- `pluginName` (string): Plugin identifier
- `settingsChanged` (array): List of setting keys that were changed
- `source` (string): Where settings were changed

**Optional fields:**
- `settings_count` (number): Total number of settings changed

**Code example:**
```javascript
import { trackPluginSettings } from './analytics';

savePluginSettings = (pluginName, newSettings, oldSettings) => {
  const changedKeys = Object.keys(newSettings).filter(
    key => newSettings[key] !== oldSettings[key]
  );

  trackPluginSettings(pluginName, changedKeys, 'PluginSettings');
  pluginManager.saveSettings(pluginName, newSettings);
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plugin_name') as plugin,
  COUNT(*) as settings_changes,
  COUNT(DISTINCT user_pseudo_id) as unique_users
FROM `project.analytics_events`
WHERE event_name = 'plugin_settings_change'
GROUP BY plugin
ORDER BY settings_changes DESC
```

---

### `trackPluginAction(pluginName, actionName, source, metadata)`

**When it fires:** Plugin-specific action is executed

**Required fields:**
- `pluginName` (string): Plugin identifier
- `actionName` (string): Action performed
- `source` (string): Where action was triggered

**Optional fields:**
- `metadata` (object): Additional action-specific data

**Code example:**
```javascript
import { trackPluginAction } from './analytics';

executePluginAction = (plugin, action) => {
  trackPluginAction(plugin.name, action.name, 'PluginUI', {
    action_type: action.type,
    has_parameters: !!action.params
  });

  plugin.execute(action);
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plugin_name') as plugin,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'action_name') as action,
  COUNT(*) as executions
FROM `project.analytics_events`
WHERE event_name = 'plugin_action'
GROUP BY plugin, action
ORDER BY executions DESC
```

---

### `trackPluginError(pluginName, errorType, errorMessage, metadata)`

**When it fires:** Plugin encounters an error

**Required fields:**
- `pluginName` (string): Plugin identifier
- `errorType` (string): Type/category of error
- `errorMessage` (string): Error message (sanitized)

**Optional fields:**
- `metadata` (object): Additional error context (no PII)

**Code example:**
```javascript
import { trackPluginError } from './analytics';

loadPlugin = async (pluginName) => {
  try {
    await pluginManager.load(pluginName);
  } catch (error) {
    trackPluginError(pluginName, 'load_error', error.message, {
      plugin_version: plugin.version,
      node_version: process.version
    });
    throw error;
  }
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plugin_name') as plugin,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'error_type') as error_type,
  COUNT(*) as error_count
FROM `project.analytics_events`
WHERE event_name = 'plugin_error'
GROUP BY plugin, error_type
ORDER BY error_count DESC
```

---

## Usage Aggregation Events

### `aggregatePluginUsage(pluginName, totalUses, totalDuration, errorCount, metadata)`

**When it fires:** Periodic aggregation of plugin usage metrics (hourly, daily, or on app close)

**Required fields:**
- `pluginName` (string): Plugin identifier
- `totalUses` (number): Total number of times plugin was used
- `totalDuration` (number): Total time plugin was active (milliseconds)
- `errorCount` (number): Total errors encountered

**Optional fields:**
- `metadata` (object): Additional usage metrics

**Code example:**
```javascript
import { aggregatePluginUsage } from './analytics';

// Call periodically or on app close
aggregateUsageMetrics = () => {
  const plugins = pluginManager.getAllPlugins();

  plugins.forEach(plugin => {
    const metrics = pluginManager.getUsageMetrics(plugin.name);

    aggregatePluginUsage(
      plugin.name,
      metrics.totalUses,
      metrics.totalDuration,
      metrics.errorCount,
      {
        last_used: metrics.lastUsedTimestamp,
        sessions_count: metrics.sessions,
        favorite: plugin.isFavorite
      }
    );
  });
};

// In app shutdown
app.on('before-quit', () => {
  aggregateUsageMetrics();
});
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plugin_name') as plugin,
  SUM((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'total_uses')) as total_uses,
  SUM((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'total_duration_ms')) as total_duration_ms,
  SUM((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'error_count')) as total_errors
FROM `project.analytics_events`
WHERE event_name = 'plugin_usage_aggregate'
GROUP BY plugin
ORDER BY total_uses DESC
```

---

## User Action Events

### `trackUserAction(actionName, source, metadata)`

**When it fires:** Generic user action (button click, menu selection, etc.)

**Required fields:**
- `actionName` (string): Description of the action
- `source` (string): Where action occurred

**Optional fields:**
- `metadata` (object): Additional action context

**Code example:**
```javascript
import { trackUserAction } from './analytics';

handleSaveClick = () => {
  trackUserAction('Save Configuration', 'SettingsPage', {
    settings_modified: ['theme', 'language', 'notifications']
  });

  this.saveConfiguration();
};

handleExport = (format) => {
  trackUserAction('Export Data', 'DataPage', {
    export_format: format,
    item_count: this.state.items.length
  });

  this.exportData(format);
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'action_name') as action,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'source') as source,
  COUNT(*) as action_count
FROM `project.analytics_events`
WHERE event_name = 'user_action'
GROUP BY action, source
ORDER BY action_count DESC
```

---

## External Link Events

### `trackExternalLink(url, linkText, source)`

**When it fires:** User clicks an external link

**Required fields:**
- `url` (string): URL being opened
- `linkText` (string): Link text/description
- `source` (string): Where link was clicked

**Optional fields:**
- `link_type` (string): Type of link (documentation, support, website, etc.)

**Code example:**
```javascript
import { trackExternalLink } from './analytics';

// Link component
<a
  href={plugin.website}
  onClick={() => {
    trackExternalLink(plugin.website, 'Plugin Website', 'PluginDetails', {
      link_type: 'plugin_website',
      plugin_name: plugin.name
    });
  }}
  target="_blank"
  rel="noopener noreferrer"
>
  Visit Website
</a>

// Programmatic
openDocumentation = () => {
  const url = 'https://docs.example.com';
  trackExternalLink(url, 'Documentation', 'HelpMenu', {
    link_type: 'documentation'
  });
  shell.openExternal(url);
};
```

**Firebase query example:**
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'link_url') as url,
  COUNT(*) as clicks,
  COUNT(DISTINCT user_pseudo_id) as unique_users
FROM `project.analytics_events`
WHERE event_name = 'external_link_click'
GROUP BY url
ORDER BY clicks DESC
LIMIT 50
```

---

## Event Summary Table

| Event Name | Category | Frequency | Primary Use Case |
|------------|----------|-----------|------------------|
| `app_start` | Lifecycle | Once per session | Track app launches |
| `user_login` | Lifecycle | Per login | Authentication tracking |
| `screen_view` | Navigation | Per navigation | Screen popularity |
| `tab_click` | Navigation | Per tab change | Tab usage patterns |
| `marketplace_view` | Marketplace | Per marketplace open | Marketplace engagement |
| `marketplace_search` | Marketplace | Per search | Search behavior |
| `marketplace_filter` | Marketplace | Per filter | Filter usage |
| `marketplace_sort` | Marketplace | Per sort change | Sort preferences |
| `plugin_view` | Marketplace | Per plugin view | Plugin interest |
| `plugin_install` | Plugin Lifecycle | Per install | Installation tracking |
| `plugin_uninstall` | Plugin Lifecycle | Per uninstall | Uninstall reasons |
| `plugin_delete` | Plugin Lifecycle | Per delete | Deletion tracking |
| `plugin_enable` | Plugin Lifecycle | Per enable | Enable/disable patterns |
| `plugin_disable` | Plugin Lifecycle | Per disable | Enable/disable patterns |
| `plugin_settings_change` | Plugin Interaction | Per settings save | Settings usage |
| `plugin_action` | Plugin Interaction | Per action | Feature usage |
| `plugin_error` | Plugin Interaction | Per error | Error tracking |
| `plugin_usage_aggregate` | Aggregation | Periodic | Usage metrics |
| `user_action` | Generic | Per action | General interactions |
| `external_link_click` | Generic | Per link click | External navigation |

---

## Additional Resources

- [Analytics Integration Guide](./ANALYTICS_INTEGRATION_GUIDE.md)
- [Analytics Quick Start](./analytics/README.md)
- [Firebase Analytics Documentation](https://firebase.google.com/docs/analytics)
