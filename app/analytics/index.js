/**
 * Centralized Analytics Management Class
 * Handles all Firebase Analytics tracking for the Electron application
 *
 * IMPORTANT: Only works in renderer process (requires window/browser environment)
 */

// Only import Firebase in renderer process
let analytics = null;
let setUserId = null;
let setUserProperties = null;
let logEvent = null;

// Import environment detection (safe in all processes)
let getAppSourceTag = null;
let getBuildInfo = null;

try {
  const envModule = require('./environment');
  getAppSourceTag = envModule.getAppSourceTag;
  getBuildInfo = envModule.getBuildInfo;
} catch (err) {
  console.error('[Analytics] Failed to load environment module:', err);
  // Provide fallback functions
  getAppSourceTag = () => ({ type: 'unknown', version: '2.0.0' });
  getBuildInfo = () => ({ version: '2.0.0', isOfficialBuild: false, buildNumber: 'dev', timestamp: new Date().toISOString() });
}

// Lazy load Firebase only in renderer process
if (typeof window !== 'undefined') {
  import('./firebase-config').then(module => {
    analytics = module.analytics;
    setUserId = module.setUserId;
    setUserProperties = module.setUserProperties;
    logEvent = module.logEvent;
    console.log('[Analytics] Firebase modules loaded');
  }).catch(err => {
    console.error('[Analytics] Failed to load Firebase:', err);
  });
}

class Analytics {
  constructor() {
    this.analytics = null;
    this.isInitialized = false;
    this.appSource = null;
    this.buildInfo = null;
    this.sessionStartTime = Date.now();
    this.pendingEvents = [];
  }

  /**
   * Initialize analytics with user context
   * @param {string} userId - Unique user identifier
   * @param {Object} userProperties - Additional user properties
   */
  async initialize(userId, userProperties = {}) {
    try {
      // Only works in renderer process
      if (typeof window === 'undefined') {
        console.warn('[Analytics] Cannot initialize in main process');
        return false;
      }

      this.appSource = getAppSourceTag();
      this.buildInfo = getBuildInfo();

      // Wait for Firebase to load if not ready
      let attempts = 0;
      while (!analytics && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!analytics) {
        console.error('[Analytics] Firebase not loaded after 5 seconds');
        return false;
      }

      this.analytics = analytics;

      // Set user ID
      if (setUserId) {
        setUserId(this.analytics, userId);
      }

      // Set core user properties
      const coreProperties = {
        app_source_type: this.appSource.type,
        app_version: this.appSource.version,
        build_official: this.buildInfo.isOfficialBuild,
        ...userProperties
      };

      // Add platform-specific properties
      if (this.appSource.platform) {
        coreProperties.store_platform = this.appSource.platform;
      }

      if (this.appSource.git) {
        coreProperties.git_branch = this.appSource.git.branch;
        coreProperties.git_commit = this.appSource.git.commit;
      }

      if (setUserProperties) {
        setUserProperties(this.analytics, coreProperties);
      }

      this.isInitialized = true;

      // Track initialization
      this.trackAppStart();

      return true;
    } catch (error) {
      console.error('Analytics initialization failed:', error);
      return false;
    }
  }

  /**
   * Internal helper to safely log events
   */
  _logEvent(eventName, eventData = {}) {
    if (!logEvent || !this.analytics) {
      console.log(`[Analytics] ${eventName} tracked (Firebase not ready)`, eventData);
      return;
    }
    try {
      this._logEvent( eventName, eventData);
    } catch (error) {
      console.error(`[Analytics] Error logging ${eventName}:`, error);
    }
  }

  /**
   * Track application start
   */
  trackAppStart() {
    this._logEvent('app_start', {
      source_type: this.appSource && this.appSource.type,
      platform: (this.appSource && this.appSource.platform) || process.platform,
      version: this.appSource && this.appSource.version,
      build_number: this.buildInfo && this.buildInfo.buildNumber,
      is_official: this.buildInfo && this.buildInfo.isOfficialBuild
    });
  }

  /**
   * Track application close
   * @param {number} sessionDuration - Session duration in milliseconds
   */
  trackAppClose(sessionDuration) {
    this._logEvent( 'app_close', {
      session_duration: sessionDuration || (Date.now() - this.sessionStartTime),
      source_type: this.appSource && this.appSource.type
    });
  }

  /**
   * Track plugin installation
   * @param {Object} pluginData - Plugin information
   */
  trackPluginInstall(pluginData) {
    this._logEvent( 'plugin_install', {
      plugin_name: pluginData.name,
      plugin_version: pluginData.version,
      plugin_source: pluginData.source || 'marketplace',
      install_method: pluginData.method || 'ui',
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track plugin uninstallation
   * @param {Object} pluginData - Plugin information
   */
  trackPluginUninstall(pluginData) {
    this._logEvent( 'plugin_uninstall', {
      plugin_name: pluginData.name,
      plugin_version: pluginData.version,
      usage_duration: pluginData.usageDuration,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track plugin activation
   * @param {string} pluginName - Plugin name
   */
  trackPluginActivate(pluginName) {
    this._logEvent( 'plugin_activate', {
      plugin_name: pluginName,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track plugin deactivation
   * @param {string} pluginName - Plugin name
   */
  trackPluginDeactivate(pluginName) {
    this._logEvent( 'plugin_deactivate', {
      plugin_name: pluginName,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track plugin update
   * @param {Object} updateData - Update information
   */
  trackPluginUpdate(updateData) {
    this._logEvent( 'plugin_update', {
      plugin_name: updateData.name,
      old_version: updateData.oldVersion,
      new_version: updateData.newVersion,
      update_source: updateData.source || 'auto',
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track plugin error
   * @param {Object} errorData - Error information
   */
  trackPluginError(errorData) {
    this._logEvent( 'plugin_error', {
      plugin_name: errorData.pluginName,
      error_type: errorData.errorType,
      error_message: errorData.message && errorData.message.substring(0, 100), // Limit message length
      stack_trace: errorData.stack && errorData.stack.substring(0, 500),
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track marketplace browse
   * @param {Object} browseData - Browse context
   */
  trackMarketplaceBrowse(browseData = {}) {
    this._logEvent( 'marketplace_browse', {
      category: browseData.category || 'all',
      search_term: browseData.searchTerm,
      filter_applied: browseData.filter,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track marketplace search
   * @param {string} searchTerm - Search query
   * @param {number} resultsCount - Number of results
   */
  trackMarketplaceSearch(searchTerm, resultsCount) {
    this._logEvent( 'marketplace_search', {
      search_term: searchTerm,
      results_count: resultsCount,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track plugin view in marketplace
   * @param {Object} pluginData - Plugin information
   */
  trackPluginView(pluginData) {
    this._logEvent( 'plugin_view', {
      plugin_name: pluginData.name,
      plugin_category: pluginData.category,
      plugin_author: pluginData.author,
      view_source: pluginData.source || 'marketplace',
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track feature usage
   * @param {string} featureName - Feature identifier
   * @param {Object} featureData - Additional feature context
   */
  trackFeatureUsage(featureName, featureData = {}) {
    this._logEvent( 'feature_usage', {
      feature_name: featureName,
      ...featureData,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track settings change
   * @param {string} settingName - Setting identifier
   * @param {*} oldValue - Previous value
   * @param {*} newValue - New value
   */
  trackSettingsChange(settingName, oldValue, newValue) {
    this._logEvent( 'settings_change', {
      setting_name: settingName,
      old_value: String(oldValue),
      new_value: String(newValue),
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track error
   * @param {Object} errorData - Error information
   */
  trackError(errorData) {
    this._logEvent( 'app_error', {
      error_type: errorData.type || 'unknown',
      error_message: errorData.message && errorData.message.substring(0, 100),
      error_context: errorData.context,
      stack_trace: errorData.stack && errorData.stack.substring(0, 500),
      app_source: this.appSource && this.appSource.type,
      version: this.appSource && this.appSource.version
    });
  }

  /**
   * Track navigation
   * @param {string} screenName - Screen/view identifier
   * @param {Object} navigationData - Additional navigation context
   */
  trackNavigation(screenName, navigationData = {}) {
    this._logEvent( 'screen_view', {
      screen_name: screenName,
      ...navigationData,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track user engagement
   * @param {Object} engagementData - Engagement metrics
   */
  trackEngagement(engagementData) {
    this._logEvent( 'user_engagement', {
      engagement_time_msec: engagementData.durationMs,
      interaction_type: engagementData.type,
      ...engagementData,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track custom event
   * @param {string} eventName - Custom event name
   * @param {Object} eventParams - Event parameters
   */
  trackCustomEvent(eventName, eventParams = {}) {
    this._logEvent( eventName, {
      ...eventParams,
      app_source: this.appSource && this.appSource.type,
      timestamp: Date.now()
    });
  }

  /**
   * Track user action
   * @param {string} action - Action identifier
   * @param {Object} actionData - Action context
   */
  trackUserAction(action, actionData = {}) {
    this._logEvent( 'user_action', {
      action_type: action,
      ...actionData,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track performance metric
   * @param {string} metricName - Metric identifier
   * @param {number} value - Metric value
   * @param {Object} metricData - Additional context
   */
  trackPerformance(metricName, value, metricData = {}) {
    this._logEvent( 'performance_metric', {
      metric_name: metricName,
      metric_value: value,
      ...metricData,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track app update
   * @param {Object} updateData - Update information
   */
  trackAppUpdate(updateData) {
    this._logEvent( 'app_update', {
      old_version: updateData.oldVersion,
      new_version: updateData.newVersion,
      update_source: updateData.source || 'auto',
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track notification interaction
   * @param {Object} notificationData - Notification context
   */
  trackNotification(notificationData) {
    this._logEvent( 'notification_interaction', {
      notification_type: notificationData.type,
      action_taken: notificationData.action,
      notification_id: notificationData.id,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track export operation
   * @param {Object} exportData - Export context
   */
  trackExport(exportData) {
    this._logEvent( 'export_data', {
      export_type: exportData.type,
      format: exportData.format,
      item_count: exportData.itemCount,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track import operation
   * @param {Object} importData - Import context
   */
  trackImport(importData) {
    this._logEvent( 'import_data', {
      import_type: importData.type,
      format: importData.format,
      item_count: importData.itemCount,
      success: importData.success,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track share action
   * @param {Object} shareData - Share context
   */
  trackShare(shareData) {
    this._logEvent( 'share', {
      content_type: shareData.contentType,
      method: shareData.method,
      item_id: shareData.itemId,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track tutorial progress
   * @param {Object} tutorialData - Tutorial context
   */
  trackTutorial(tutorialData) {
    this._logEvent( 'tutorial_progress', {
      tutorial_id: tutorialData.id,
      step: tutorialData.step,
      action: tutorialData.action, // begin, complete, skip
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Track A/B test exposure
   * @param {string} experimentId - Experiment identifier
   * @param {string} variantId - Variant identifier
   */
  trackExperiment(experimentId, variantId) {
    this._logEvent( 'experiment_exposure', {
      experiment_id: experimentId,
      variant_id: variantId,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Update user properties
   * @param {Object} properties - Properties to update
   */
  updateUserProperties(properties) {
    setUserProperties(this.analytics, {
      ...properties,
      app_source: this.appSource && this.appSource.type
    });
  }

  /**
   * Get current session information
   * @returns {Object} Session data
   */
  getSessionInfo() {
    return {
      sessionDuration: Date.now() - this.sessionStartTime,
      appSource: this.appSource,
      buildInfo: this.buildInfo,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Flush pending analytics events (for app shutdown)
   */
  async flush() {
    // Firebase Web SDK auto-flushes, but we track the close event
    const sessionDuration = Date.now() - this.sessionStartTime;
    this.trackAppClose(sessionDuration);

    // Give a small delay for events to send
    return new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Export singleton instance
const analyticsInstance = new Analytics();

export default analyticsInstance;
export { Analytics };
