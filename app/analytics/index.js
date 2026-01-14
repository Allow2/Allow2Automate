/**
 * Analytics API - Main interface for tracking user behavior and app events
 *
 * This module provides a comprehensive analytics system for Allow2Automate with:
 * - Firebase Analytics integration
 * - Event tracking for user actions, plugin usage, and system events
 * - User identification and properties
 * - App source tagging (Mac App Store, development, direct download)
 *
 * IMPORTANT: This module must only be imported in renderer processes.
 * The main process should not import Firebase Analytics.
 */

const {
  initializeFirebase,
  getAnalyticsInstance,
  logAnalyticsEvent,
  setAnalyticsUserId,
  setAnalyticsUserProperties
} = require('./firebase-config');

const { getAppSourceTag } = require('./environment');

/**
 * Analytics class - Singleton interface for tracking events
 */
class Analytics {
  constructor() {
    this.initialized = false;
    this.analytics = null;
    this.userId = null;
  }

  /**
   * Initialize Firebase Analytics
   * Must be called before any tracking methods
   */
  async initialize() {
    if (this.initialized) {
      console.log('[Analytics] Already initialized');
      return true;
    }

    try {
      const success = await initializeFirebase();
      if (success) {
        this.analytics = getAnalyticsInstance();
        this.initialized = true;

        // Set app source properties on initialization
        const appSource = getAppSourceTag();
        if (appSource) {
          this.setUserProperties({
            app_source_type: appSource.type,
            app_source_version: appSource.version,
            app_source_branch: appSource.git_branch,
            app_source_commit: appSource.git_commit
          });
        }

        console.log('[Analytics] Initialized successfully');
        return true;
      } else {
        console.warn('[Analytics] Firebase initialization failed');
        return false;
      }
    } catch (err) {
      console.error('[Analytics] Error during initialization:', err);
      return false;
    }
  }

  /**
   * Set user ID for analytics
   * @param {string} userId - Unique user identifier
   */
  setUserId(userId) {
    if (!this.initialized || !userId) {
      return;
    }

    try {
      setAnalyticsUserId(userId);
      this.userId = userId;
      console.log('[Analytics] User ID set');
    } catch (err) {
      console.error('[Analytics] Error setting user ID:', err);
    }
  }

  /**
   * Set user properties
   * @param {Object} properties - User properties to set
   */
  setUserProperties(properties) {
    if (!this.initialized || !properties) {
      return;
    }

    try {
      setAnalyticsUserProperties(properties);
      console.log('[Analytics] User properties set');
    } catch (err) {
      console.error('[Analytics] Error setting user properties:', err);
    }
  }

  /**
   * Track a custom event
   * @param {string} eventName - Event name
   * @param {Object} params - Event parameters
   */
  trackEvent(eventName, params = {}) {
    if (!this.initialized) {
      console.warn('[Analytics] Not initialized, skipping event:', eventName);
      return;
    }

    try {
      // Add app source to all events
      const appSource = getAppSourceTag();
      const enrichedParams = {
        ...params,
        app_source: appSource ? appSource.type : 'unknown'
      };

      logAnalyticsEvent(eventName, enrichedParams);
    } catch (err) {
      console.error('[Analytics] Error tracking event:', eventName, err);
    }
  }

  // === User Authentication Events ===

  trackLogin(method = 'allow2') {
    this.trackEvent('login', { method });
  }

  trackLogout() {
    this.trackEvent('logout');
  }

  trackSignup(method = 'allow2') {
    this.trackEvent('sign_up', { method });
  }

  // === Plugin Events ===

  trackPluginInstall(pluginId, pluginName, version) {
    this.trackEvent('plugin_install', {
      plugin_id: pluginId,
      plugin_name: pluginName,
      plugin_version: version
    });
  }

  trackPluginUninstall(pluginId, pluginName) {
    this.trackEvent('plugin_uninstall', {
      plugin_id: pluginId,
      plugin_name: pluginName
    });
  }

  trackPluginEnable(pluginId, pluginName) {
    this.trackEvent('plugin_enable', {
      plugin_id: pluginId,
      plugin_name: pluginName
    });
  }

  trackPluginDisable(pluginId, pluginName) {
    this.trackEvent('plugin_disable', {
      plugin_id: pluginId,
      plugin_name: pluginName
    });
  }

  trackPluginUpdate(pluginId, pluginName, fromVersion, toVersion) {
    this.trackEvent('plugin_update', {
      plugin_id: pluginId,
      plugin_name: pluginName,
      from_version: fromVersion,
      to_version: toVersion
    });
  }

  trackPluginError(pluginId, pluginName, errorType, errorMessage) {
    this.trackEvent('plugin_error', {
      plugin_id: pluginId,
      plugin_name: pluginName,
      error_type: errorType,
      error_message: errorMessage
    });
  }

  // === Marketplace Events ===

  trackMarketplaceView() {
    this.trackEvent('marketplace_view');
  }

  trackMarketplaceSearch(query, resultsCount) {
    this.trackEvent('marketplace_search', {
      search_query: query,
      results_count: resultsCount
    });
  }

  trackMarketplaceFilter(filterType, filterValue) {
    this.trackEvent('marketplace_filter', {
      filter_type: filterType,
      filter_value: filterValue
    });
  }

  trackPluginDetails(pluginId, pluginName) {
    this.trackEvent('plugin_details_view', {
      plugin_id: pluginId,
      plugin_name: pluginName
    });
  }

  // === Child Management Events ===

  trackChildAdd(childName) {
    this.trackEvent('child_add', {
      child_name: childName
    });
  }

  trackChildRemove(childName) {
    this.trackEvent('child_remove', {
      child_name: childName
    });
  }

  trackChildEdit(childName) {
    this.trackEvent('child_edit', {
      child_name: childName
    });
  }

  // === App Lifecycle Events ===

  trackAppStart() {
    this.trackEvent('app_start');
  }

  trackAppBackground() {
    this.trackEvent('app_background');
  }

  trackAppForeground() {
    this.trackEvent('app_foreground');
  }

  trackAppError(errorType, errorMessage, stackTrace) {
    this.trackEvent('app_error', {
      error_type: errorType,
      error_message: errorMessage,
      stack_trace: stackTrace
    });
  }

  // === Navigation Events ===

  trackScreenView(screenName) {
    this.trackEvent('screen_view', {
      screen_name: screenName
    });
  }

  trackNavigation(from, to) {
    this.trackEvent('navigation', {
      from_screen: from,
      to_screen: to
    });
  }

  // === Performance Events ===

  trackPerformance(metric, value, unit = 'ms') {
    this.trackEvent('performance_metric', {
      metric_name: metric,
      metric_value: value,
      metric_unit: unit
    });
  }

  trackPluginLoadTime(pluginId, pluginName, loadTimeMs) {
    this.trackEvent('plugin_load_time', {
      plugin_id: pluginId,
      plugin_name: pluginName,
      load_time_ms: loadTimeMs
    });
  }

  // === Agent Events ===

  trackAgentDeployed(agentId, agentVersion, platform, hostname) {
    this.trackEvent('agent_deployed', {
      agent_id: agentId,
      agent_version: agentVersion,
      platform: platform,
      hostname: hostname
    });
  }

  trackAgentRemoved(agentId, agentVersion, platform) {
    this.trackEvent('agent_removed', {
      agent_id: agentId,
      agent_version: agentVersion,
      platform: platform
    });
  }

  trackAgentStateChange(agentId, agentVersion, fromState, toState) {
    this.trackEvent('agent_state_change', {
      agent_id: agentId,
      agent_version: agentVersion,
      from_state: fromState,
      to_state: toState
    });
  }

  trackAgentInteraction(agentId, agentVersion, interactionType, details) {
    this.trackEvent('agent_interaction', {
      agent_id: agentId,
      agent_version: agentVersion,
      interaction_type: interactionType,
      details: details
    });
  }

  trackAgentCount(totalAgents, byPlatform = {}) {
    this.trackEvent('agent_count_snapshot', {
      total_agents: totalAgents,
      ...byPlatform
    });
  }

  // === Plugin API Call Events ===

  trackPluginApiCall(pluginName, apiMethod, success = true, errorMessage = null) {
    const eventData = {
      plugin_name: pluginName,
      api_method: apiMethod,
      success: success
    };

    if (errorMessage) {
      eventData.error_message = errorMessage;
    }

    this.trackEvent('plugin_api_call', eventData);
  }

  // === Navigation & Tab Events ===

  trackPluginTabView(pluginName) {
    this.trackEvent('plugin_tab_view', {
      plugin_name: pluginName
    });
  }

  trackSettingsTabView(tabName) {
    this.trackEvent('settings_tab_view', {
      tab_name: tabName
    });
  }

  // === Configuration Change Events ===

  trackConfigurationChange(pluginName, changedFields = {}) {
    // Convert changed fields to flat key-value pairs for analytics
    const eventData = {
      plugin_name: pluginName,
      field_count: Object.keys(changedFields).length
    };

    // Add each changed field as a parameter (limited to avoid param explosion)
    const fieldEntries = Object.entries(changedFields).slice(0, 10);
    fieldEntries.forEach(([key, value], index) => {
      eventData[`field_${index}_name`] = key;
      eventData[`field_${index}_value`] = String(value).substring(0, 100); // Limit value length
    });

    this.trackEvent('configuration_change', eventData);
  }

  // === App Lifecycle Events ===

  trackAppShutdown() {
    this.trackEvent('app_shutdown');
  }

  trackMarketplacePluginInfo(pluginName, pluginVersion) {
    this.trackEvent('marketplace_plugin_info', {
      plugin_name: pluginName,
      plugin_version: pluginVersion
    });
  }
}

// Export singleton instance
const analytics = new Analytics();

module.exports = analytics;
