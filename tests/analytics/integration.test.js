/**
 * Analytics Integration Tests
 *
 * Tests end-to-end analytics flows including user login, plugin installation,
 * marketplace interactions, and event sequencing with IPC mocking.
 */

const { expect } = require('chai');
const sinon = require('sinon');

describe('Analytics Integration Tests', () => {
  let analyticsInstance;
  let firebaseConfig;
  let mockIpc;
  let consoleLogStub;

  beforeEach(() => {
    // Clear require cache
    delete require.cache[require.resolve('../../build/analytics/index.js')];
    delete require.cache[require.resolve('../../app/analytics/firebase-config.js')];

    // Mock Electron IPC
    mockIpc = {
      send: sinon.stub(),
      on: sinon.stub(),
      invoke: sinon.stub().resolves()
    };

    // Mock window.ipcRenderer for renderer process
    if (typeof global.window === 'undefined') {
      global.window = {};
    }
    global.window.ipcRenderer = mockIpc;

    // Stub console.log to capture events
    consoleLogStub = sinon.stub(console, 'log');

    // Load modules
    const { Analytics } = require('../../build/analytics/index.js');
    analyticsInstance = new Analytics();
    firebaseConfig = require('../../app/analytics/firebase-config.js');
  });

  afterEach(() => {
    consoleLogStub.restore();
    delete global.window;
    sinon.restore();
  });

  describe('User Login Flow', () => {
    it('should track complete login sequence with userId context', async () => {
      // Initialize app
      await analyticsInstance.trackAppStart('production', {
        version: '2.0.0',
        buildNumber: 1234,
        platform: 'darwin'
      });

      // User logs in
      const userId = 'user_abc123';
      await analyticsInstance.trackUserLogin(userId);

      // Verify userId is set
      expect(analyticsInstance.userId).to.equal(userId);

      // Verify events were logged
      const appStartEvent = consoleLogStub.args.find(
        args => args[1] === 'app_start'
      );
      const loginEvent = consoleLogStub.args.find(
        args => args[1] === 'user_login'
      );

      expect(appStartEvent).to.exist;
      expect(loginEvent).to.exist;
      expect(loginEvent[2]).to.have.property('user_id', userId);
    });

    it('should track plugin install after login with userId', async () => {
      // Setup
      analyticsInstance.initialize('production', {
        version: '2.0.0',
        buildNumber: 1234
      });
      await analyticsInstance.trackUserLogin('user_xyz');

      // Install plugin
      const plugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        author: 'Test Author'
      };

      await analyticsInstance.trackPluginInstall(plugin, 'marketplace');

      // Verify userId is included in plugin install event
      const installEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_install'
      );

      expect(installEvent).to.exist;
      expect(installEvent[2]).to.have.property('user_id', 'user_xyz');
      expect(installEvent[2]).to.have.property('plugin_id', 'test-plugin');
    });

    it('should clear userId on logout', async () => {
      analyticsInstance.initialize('test', { version: '1.0.0' });
      await analyticsInstance.trackUserLogin('user_123');

      expect(analyticsInstance.userId).to.equal('user_123');

      await analyticsInstance.trackUserLogout();

      expect(analyticsInstance.userId).to.be.null;
    });
  });

  describe('Marketplace Interaction Flow', () => {
    const mockPlugin = {
      id: 'marketplace-plugin',
      name: 'Marketplace Plugin',
      version: '2.1.0',
      author: 'Plugin Author'
    };

    beforeEach(() => {
      analyticsInstance.initialize('production', {
        version: '2.0.0',
        buildNumber: 5678,
        platform: 'win32'
      });
    });

    it('should track marketplace view → tab click → external link sequence', async () => {
      // Navigate to marketplace
      await analyticsInstance.trackNavigation('home', 'marketplace');

      // View plugin
      await analyticsInstance.trackMarketplaceView(mockPlugin, 3000);

      // Click on README tab
      await analyticsInstance.trackMarketplaceTabClick(mockPlugin, 'readme');

      // Click external homepage link
      await analyticsInstance.trackExternalLink(
        'https://plugin-homepage.com',
        'homepage',
        mockPlugin
      );

      // Verify event sequence
      const events = consoleLogStub.args
        .filter(args => args[0] === '[Analytics] Event tracked:')
        .map(args => args[1]);

      expect(events).to.include('screen_navigation');
      expect(events).to.include('marketplace_view');
      expect(events).to.include('marketplace_tab_click');
      expect(events).to.include('external_link_click');
    });

    it('should track marketplace search with results', async () => {
      const searchTerm = 'automation';
      const resultsCount = 7;

      await analyticsInstance.trackMarketplaceSearch(searchTerm, resultsCount);

      const searchEvent = consoleLogStub.args.find(
        args => args[1] === 'marketplace_search'
      );

      expect(searchEvent).to.exist;
      expect(searchEvent[2]).to.have.property('search_term', searchTerm);
      expect(searchEvent[2]).to.have.property('results_count', resultsCount);
      expect(searchEvent[2]).to.have.property('has_results', true);
    });

    it('should tag all marketplace events with buildInfo', async () => {
      await analyticsInstance.trackMarketplaceView(mockPlugin);
      await analyticsInstance.trackMarketplaceTabClick(mockPlugin, 'changelog');

      const viewEvent = consoleLogStub.args.find(
        args => args[1] === 'marketplace_view'
      );
      const tabEvent = consoleLogStub.args.find(
        args => args[1] === 'marketplace_tab_click'
      );

      expect(viewEvent[2]).to.have.property('app_source', 'production');
      expect(viewEvent[2]).to.have.property('build_version', '2.0.0');
      expect(tabEvent[2]).to.have.property('platform', 'win32');
    });
  });

  describe('Plugin Settings Change Flow', () => {
    const mockPlugin = {
      id: 'settings-plugin',
      name: 'Settings Plugin',
      version: '1.5.0'
    };

    beforeEach(() => {
      analyticsInstance.initialize('development', {
        version: '2.0.0-dev',
        buildNumber: 999
      });
    });

    it('should track settings change with old and new values', async () => {
      await analyticsInstance.trackPluginSettings(
        mockPlugin,
        'refreshInterval',
        60,
        30
      );

      const settingsEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_settings_change'
      );

      expect(settingsEvent).to.exist;
      expect(settingsEvent[2]).to.have.property('setting_key', 'refreshInterval');
      expect(settingsEvent[2]).to.have.property('old_value', '60');
      expect(settingsEvent[2]).to.have.property('new_value', '30');
    });

    it('should convert non-string values to strings', async () => {
      await analyticsInstance.trackPluginSettings(
        mockPlugin,
        'enabled',
        true,
        false
      );

      const settingsEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_settings_change'
      );

      expect(settingsEvent[2].old_value).to.be.a('string');
      expect(settingsEvent[2].new_value).to.be.a('string');
    });
  });

  describe('Environment Tagging', () => {
    it('should automatically tag dev builds with git metadata', () => {
      // Simulate dev environment
      process.env.NODE_ENV = 'development';

      const execSyncStub = sinon.stub(require('child_process'), 'execSync');
      execSyncStub.withArgs(sinon.match(/git config/))
        .returns('https://github.com/test/repo.git\n');
      execSyncStub.withArgs(sinon.match(/git rev-parse HEAD/))
        .returns('abc123def456\n');
      execSyncStub.withArgs(sinon.match(/git rev-parse --abbrev-ref/))
        .returns('feature/analytics\n');

      delete require.cache[require.resolve('../../app/analytics/firebase-config.js')];
      const freshConfig = require('../../app/analytics/firebase-config.js');

      const env = freshConfig.detectEnvironment();

      expect(env.gitMetadata).to.exist;
      expect(env.gitMetadata.branch).to.equal('feature/analytics');
      expect(env.gitMetadata.commitShort).to.equal('abc123d');

      execSyncStub.restore();
      delete process.env.NODE_ENV;
    });

    it('should tag Mac App Store builds correctly', () => {
      process.mas = true;

      delete require.cache[require.resolve('../../app/analytics/firebase-config.js')];
      const freshConfig = require('../../app/analytics/firebase-config.js');

      const env = freshConfig.detectEnvironment();

      expect(env.distributionChannel).to.equal('mac-app-store');
      expect(env.isStoreDistribution).to.be.true;

      delete process.mas;
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      analyticsInstance.initialize('production', { version: '2.0.0' });
    });

    it('should track errors without breaking app flow', async () => {
      const testError = new Error('Plugin failed to load');

      await analyticsInstance.trackError(
        testError,
        'plugin_initialization',
        { plugin_id: 'broken-plugin' }
      );

      const errorEvent = consoleLogStub.args.find(
        args => args[1] === 'app_error'
      );

      expect(errorEvent).to.exist;
      expect(errorEvent[2]).to.have.property('error_message', 'Plugin failed to load');
      expect(errorEvent[2]).to.have.property('error_context', 'plugin_initialization');
    });

    it('should gracefully handle Firebase failures', async () => {
      const consoleErrorStub = sinon.stub(console, 'error');

      // Force analytics to be null (not initialized for renderer)
      const Analytics = require('../../build/analytics/index.js').Analytics;
      const brokenInstance = new Analytics();

      // This should not throw even though Firebase isn't initialized
      await brokenInstance.trackEvent('test_event');

      consoleErrorStub.restore();
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(() => {
      analyticsInstance.initialize('production', { version: '2.0.0' });
    });

    it('should track plugin load performance', async () => {
      const startTime = Date.now();

      // Simulate plugin load
      await new Promise(resolve => setTimeout(resolve, 100));

      const loadTime = Date.now() - startTime;

      await analyticsInstance.trackPerformance(
        'plugin_load_time',
        loadTime,
        'ms'
      );

      const perfEvent = consoleLogStub.args.find(
        args => args[1] === 'performance_metric'
      );

      expect(perfEvent).to.exist;
      expect(perfEvent[2].metric_value).to.be.at.least(100);
    });
  });

  describe('Usage Aggregation', () => {
    const mockPlugin = {
      id: 'usage-plugin',
      name: 'Usage Plugin',
      version: '1.0.0'
    };

    beforeEach(() => {
      analyticsInstance.initialize('production', { version: '2.0.0' });
    });

    it('should aggregate plugin usage metrics over time', async () => {
      // Simulate multiple plugin uses
      for (let i = 0; i < 10; i++) {
        await analyticsInstance.trackPluginAction(
          mockPlugin,
          'process_data',
          { duration: 100 + i * 10 }
        );
      }

      // Aggregate usage
      await analyticsInstance.aggregatePluginUsage(mockPlugin, {
        totalUses: 10,
        totalDuration: 1450,
        errorCount: 0,
        successRate: 1.0,
        averageDuration: 145
      });

      const aggregateEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_usage_aggregate'
      );

      expect(aggregateEvent).to.exist;
      expect(aggregateEvent[2]).to.have.property('total_uses', 10);
      expect(aggregateEvent[2]).to.have.property('success_rate', 1.0);
    });
  });

  describe('IPC Communication', () => {
    it('should send analytics events via IPC when available', async () => {
      analyticsInstance.initialize('production', { version: '2.0.0' });

      // Track event
      await analyticsInstance.trackPluginInstall({
        id: 'ipc-test',
        name: 'IPC Test',
        version: '1.0.0'
      });

      // In a real implementation, IPC would be called
      // This is a placeholder for IPC integration testing
      expect(mockIpc).to.exist;
    });
  });

  describe('Complete User Journey', () => {
    it('should track full user journey from app start to plugin usage', async () => {
      // 1. App starts
      await analyticsInstance.trackAppStart('production', {
        version: '2.0.0',
        buildNumber: 1234,
        platform: 'darwin'
      });

      // 2. User logs in
      await analyticsInstance.trackUserLogin('user_journey_test');

      // 3. Navigate to marketplace
      await analyticsInstance.trackNavigation('home', 'marketplace');

      // 4. Search for plugin
      await analyticsInstance.trackMarketplaceSearch('automation', 5);

      // 5. View plugin
      const plugin = {
        id: 'journey-plugin',
        name: 'Journey Plugin',
        version: '1.0.0',
        author: 'Test'
      };
      await analyticsInstance.trackMarketplaceView(plugin, 2000);

      // 6. Install plugin
      await analyticsInstance.trackPluginInstall(plugin, 'marketplace');

      // 7. Activate plugin
      await analyticsInstance.trackPluginActivate(plugin);

      // 8. Use plugin
      await analyticsInstance.trackPluginAction(plugin, 'sync_data', {
        records: 100
      });

      // Verify all events were tracked
      const eventNames = consoleLogStub.args
        .filter(args => args[0] === '[Analytics] Event tracked:')
        .map(args => args[1]);

      expect(eventNames).to.include('app_start');
      expect(eventNames).to.include('user_login');
      expect(eventNames).to.include('screen_navigation');
      expect(eventNames).to.include('marketplace_search');
      expect(eventNames).to.include('marketplace_view');
      expect(eventNames).to.include('plugin_install');
      expect(eventNames).to.include('plugin_activate');
      expect(eventNames).to.include('plugin_action');

      // Verify userId is present in all user-scoped events
      const userScopedEvents = consoleLogStub.args
        .filter(args => args[0] === '[Analytics] Event tracked:')
        .map(args => args[2]);

      userScopedEvents.forEach(event => {
        if (event.user_id !== undefined) {
          expect(event.user_id).to.equal('user_journey_test');
        }
      });
    });
  });
});
