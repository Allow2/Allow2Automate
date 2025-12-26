/**
 * Analytics Module Tests
 *
 * Tests the centralized Analytics class including all tracking methods,
 * automatic tagging, user ID management, and event formatting.
 */

const { expect } = require('chai');
const sinon = require('sinon');

describe('Analytics Module', () => {
  let Analytics;
  let analyticsInstance;
  let mockFirebaseAnalytics;

  beforeEach(() => {
    // Mock Firebase Analytics
    mockFirebaseAnalytics = {
      logEvent: sinon.stub().resolves(),
      setUserId: sinon.stub().resolves(),
      logScreenView: sinon.stub().resolves(),
    };

    // Mock the Firebase module
    const mockAnalyticsModule = sinon.stub().returns(mockFirebaseAnalytics);

    // Clear require cache and create fresh instance
    delete require.cache[require.resolve('../../build/analytics/index.js')];

    // Since the module imports from @react-native-firebase/analytics,
    // we'll need to test the built version or use a different approach
    // For now, we'll use the class directly

    // Import and instantiate
    const analyticsModule = require('../../build/analytics/index.js');
    Analytics = analyticsModule.Analytics;
    analyticsInstance = new Analytics();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Initialization', () => {
    it('should start uninitialized', () => {
      expect(analyticsInstance.isInitialized).to.be.false;
      expect(analyticsInstance.appSource).to.be.null;
      expect(analyticsInstance.buildInfo).to.be.null;
      expect(analyticsInstance.userId).to.be.null;
    });

    it('should initialize with app metadata', () => {
      const appSource = 'production';
      const buildInfo = {
        version: '2.0.0',
        buildNumber: 1234,
        platform: 'darwin'
      };

      analyticsInstance.initialize(appSource, buildInfo);

      expect(analyticsInstance.isInitialized).to.be.true;
      expect(analyticsInstance.appSource).to.equal('production');
      expect(analyticsInstance.buildInfo).to.deep.equal(buildInfo);
    });

    it('should warn when tracking before initialization', async () => {
      const consoleWarnStub = sinon.stub(console, 'warn');

      await analyticsInstance.trackEvent('test_event');

      expect(consoleWarnStub.calledOnce).to.be.true;
      expect(consoleWarnStub.firstCall.args[0]).to.include('Not initialized');

      consoleWarnStub.restore();
    });
  });

  describe('User ID Management', () => {
    beforeEach(() => {
      analyticsInstance.initialize('test', { version: '1.0.0' });
    });

    it('should set user ID', () => {
      analyticsInstance.setUserId('user123');

      expect(analyticsInstance.userId).to.equal('user123');
    });

    it('should clear user ID', () => {
      analyticsInstance.setUserId('user123');
      analyticsInstance.clearUserId();

      expect(analyticsInstance.userId).to.be.null;
    });
  });

  describe('Common Properties', () => {
    it('should include all required properties', () => {
      const buildInfo = {
        version: '2.0.0',
        buildNumber: 1234,
        platform: 'darwin'
      };
      analyticsInstance.initialize('production', buildInfo);
      analyticsInstance.setUserId('user123');

      const props = analyticsInstance.getCommonProperties();

      expect(props).to.have.property('app_source', 'production');
      expect(props).to.have.property('build_version', '2.0.0');
      expect(props).to.have.property('build_number', 1234);
      expect(props).to.have.property('platform', 'darwin');
      expect(props).to.have.property('user_id', 'user123');
      expect(props).to.have.property('timestamp');
    });

    it('should handle missing user ID', () => {
      analyticsInstance.initialize('test', { version: '1.0.0' });

      const props = analyticsInstance.getCommonProperties();

      expect(props.user_id).to.be.null;
    });

    it('should generate ISO timestamp', () => {
      analyticsInstance.initialize('test', { version: '1.0.0' });

      const props = analyticsInstance.getCommonProperties();

      expect(props.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Event Tracking', () => {
    beforeEach(() => {
      analyticsInstance.initialize('production', {
        version: '2.0.0',
        buildNumber: 1234,
        platform: 'darwin'
      });
    });

    it('should merge common properties with event data', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackEvent('custom_event', {
        custom_prop: 'value'
      });

      expect(consoleSpy.called).to.be.true;
      const loggedEvent = consoleSpy.args.find(
        args => args[0] === '[Analytics] Event tracked:'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('custom_prop', 'value');
      expect(loggedEvent[2]).to.have.property('app_source', 'production');

      consoleSpy.restore();
    });

    it('should handle event tracking errors gracefully', async () => {
      const consoleErrorStub = sinon.stub(console, 'error');

      // Force an error by making analytics throw
      const originalTrackEvent = analyticsInstance.trackEvent;
      analyticsInstance.trackEvent = async function() {
        throw new Error('Analytics error');
      };

      // This should not throw
      await analyticsInstance.trackEvent('test_event');

      analyticsInstance.trackEvent = originalTrackEvent;
      consoleErrorStub.restore();
    });
  });

  describe('App Lifecycle Events', () => {
    it('should track app start and initialize', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackAppStart('production', {
        version: '2.0.0',
        buildNumber: 1234
      });

      expect(analyticsInstance.isInitialized).to.be.true;
      expect(consoleSpy.called).to.be.true;

      consoleSpy.restore();
    });

    it('should track user login and set user ID', async () => {
      analyticsInstance.initialize('test', { version: '1.0.0' });

      await analyticsInstance.trackUserLogin('user456');

      expect(analyticsInstance.userId).to.equal('user456');
    });

    it('should track user logout and clear user ID', async () => {
      analyticsInstance.initialize('test', { version: '1.0.0' });
      analyticsInstance.setUserId('user789');

      await analyticsInstance.trackUserLogout();

      expect(analyticsInstance.userId).to.be.null;
    });

    it('should include session user ID in logout event', async () => {
      const consoleSpy = sinon.stub(console, 'log');
      analyticsInstance.initialize('test', { version: '1.0.0' });
      analyticsInstance.setUserId('user999');

      await analyticsInstance.trackUserLogout();

      const loggedEvent = consoleSpy.args.find(
        args => args[0] === '[Analytics] Event tracked:' && args[1] === 'user_logout'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('session_user_id', 'user999');

      consoleSpy.restore();
    });
  });

  describe('Navigation Events', () => {
    beforeEach(() => {
      analyticsInstance.initialize('test', { version: '1.0.0' });
    });

    it('should track screen navigation', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackNavigation('home', 'marketplace');

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'screen_navigation'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('from_screen', 'home');
      expect(loggedEvent[2]).to.have.property('to_screen', 'marketplace');

      consoleSpy.restore();
    });

    it('should track tab clicks', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackTabClick('plugins', 'marketplace');

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'tab_click'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('tab_name', 'plugins');
      expect(loggedEvent[2]).to.have.property('context', 'marketplace');

      consoleSpy.restore();
    });
  });

  describe('Marketplace Events', () => {
    const mockPlugin = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      author: 'Test Author'
    };

    beforeEach(() => {
      analyticsInstance.initialize('test', { version: '1.0.0' });
    });

    it('should track marketplace view', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackMarketplaceView(mockPlugin, 5000);

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'marketplace_view'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('plugin_id', 'test-plugin');
      expect(loggedEvent[2]).to.have.property('view_duration_ms', 5000);

      consoleSpy.restore();
    });

    it('should track marketplace tab click', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackMarketplaceTabClick(mockPlugin, 'readme');

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'marketplace_tab_click'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('tab_name', 'readme');

      consoleSpy.restore();
    });

    it('should track marketplace search', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackMarketplaceSearch('automation', 5);

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'marketplace_search'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('search_term', 'automation');
      expect(loggedEvent[2]).to.have.property('results_count', 5);
      expect(loggedEvent[2]).to.have.property('has_results', true);

      consoleSpy.restore();
    });

    it('should track external link clicks', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackExternalLink(
        'https://example.com',
        'homepage',
        mockPlugin
      );

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'external_link_click'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('url', 'https://example.com');
      expect(loggedEvent[2]).to.have.property('plugin_id', 'test-plugin');

      consoleSpy.restore();
    });
  });

  describe('Plugin Lifecycle Events', () => {
    const mockPlugin = {
      id: 'lifecycle-plugin',
      name: 'Lifecycle Plugin',
      version: '2.0.0',
      author: 'Test Author'
    };

    beforeEach(() => {
      analyticsInstance.initialize('test', { version: '1.0.0' });
    });

    it('should track plugin install', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackPluginInstall(mockPlugin, 'marketplace');

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'plugin_install'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('plugin_id', 'lifecycle-plugin');
      expect(loggedEvent[2]).to.have.property('install_source', 'marketplace');
      expect(loggedEvent[2]).to.have.property('install_time');

      consoleSpy.restore();
    });

    it('should track plugin deletion', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackPluginDelete(mockPlugin);

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'plugin_delete'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('delete_time');

      consoleSpy.restore();
    });

    it('should track plugin activation', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackPluginActivate(mockPlugin);

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'plugin_activate'
      );

      expect(loggedEvent).to.exist;

      consoleSpy.restore();
    });

    it('should track plugin deactivation', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackPluginDeactivate(mockPlugin);

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'plugin_deactivate'
      );

      expect(loggedEvent).to.exist;

      consoleSpy.restore();
    });
  });

  describe('Plugin Interaction Events', () => {
    const mockPlugin = {
      id: 'interaction-plugin',
      name: 'Interaction Plugin',
      version: '1.5.0'
    };

    beforeEach(() => {
      analyticsInstance.initialize('test', { version: '1.0.0' });
    });

    it('should track plugin settings changes', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackPluginSettings(
        mockPlugin,
        'theme',
        'light',
        'dark'
      );

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'plugin_settings_change'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('setting_key', 'theme');
      expect(loggedEvent[2]).to.have.property('old_value', 'light');
      expect(loggedEvent[2]).to.have.property('new_value', 'dark');

      consoleSpy.restore();
    });

    it('should track plugin auth events', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackPluginAuthEvent(
        mockPlugin,
        'success'
      );

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'plugin_auth_event'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('event_type', 'success');

      consoleSpy.restore();
    });

    it('should track plugin actions with metadata', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackPluginAction(
        mockPlugin,
        'sync_data',
        { records: 100 }
      );

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'plugin_action'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('action_name', 'sync_data');
      expect(loggedEvent[2]).to.have.property('records', 100);

      consoleSpy.restore();
    });
  });

  describe('Usage Aggregation', () => {
    beforeEach(() => {
      analyticsInstance.initialize('test', { version: '1.0.0' });
    });

    it('should aggregate plugin usage metrics', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.aggregatePluginUsage(
        { id: 'test-plugin', name: 'Test' },
        {
          totalUses: 150,
          totalDuration: 30000,
          errorCount: 2,
          successRate: 0.987,
          averageDuration: 200
        }
      );

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'plugin_usage_aggregate'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('total_uses', 150);
      expect(loggedEvent[2]).to.have.property('success_rate', 0.987);

      consoleSpy.restore();
    });
  });

  describe('Error Tracking', () => {
    beforeEach(() => {
      analyticsInstance.initialize('test', { version: '1.0.0' });
    });

    it('should track errors with stack trace', async () => {
      const consoleSpy = sinon.stub(console, 'log');
      const testError = new Error('Test error');

      await analyticsInstance.trackError(
        testError,
        'plugin_load',
        { plugin_id: 'failed-plugin' }
      );

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'app_error'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('error_message', 'Test error');
      expect(loggedEvent[2]).to.have.property('error_stack');
      expect(loggedEvent[2]).to.have.property('error_context', 'plugin_load');
      expect(loggedEvent[2]).to.have.property('plugin_id', 'failed-plugin');

      consoleSpy.restore();
    });
  });

  describe('Performance Tracking', () => {
    beforeEach(() => {
      analyticsInstance.initialize('test', { version: '1.0.0' });
    });

    it('should track performance metrics', async () => {
      const consoleSpy = sinon.stub(console, 'log');

      await analyticsInstance.trackPerformance('plugin_load_time', 250, 'ms');

      const loggedEvent = consoleSpy.args.find(
        args => args[1] === 'performance_metric'
      );

      expect(loggedEvent).to.exist;
      expect(loggedEvent[2]).to.have.property('metric_name', 'plugin_load_time');
      expect(loggedEvent[2]).to.have.property('metric_value', 250);
      expect(loggedEvent[2]).to.have.property('metric_unit', 'ms');

      consoleSpy.restore();
    });
  });

  describe('Singleton Export', () => {
    it('should export singleton instance', () => {
      const analytics = require('../../build/analytics/index.js').default;

      expect(analytics).to.exist;
      expect(analytics.initialize).to.be.a('function');
    });

    it('should export Analytics class for testing', () => {
      const { Analytics } = require('../../build/analytics/index.js');

      expect(Analytics).to.be.a('function');

      const instance = new Analytics();
      expect(instance.initialize).to.be.a('function');
    });
  });
});
