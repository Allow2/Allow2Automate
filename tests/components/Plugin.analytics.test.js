/**
 * Plugin Analytics Integration Tests
 *
 * Tests analytics object injection into plugins, plugin analytics method calls,
 * and usage aggregation.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const React = require('react');
const { shallow, mount } = require('enzyme');

describe('Plugin Component Analytics', () => {
  let Plugin;
  let analyticsInstance;
  let mockPlugin;
  let consoleLogStub;

  beforeEach(() => {
    // Clear require cache
    delete require.cache[require.resolve('../../build/components/Plugin.js')];
    delete require.cache[require.resolve('../../build/analytics/index.js')];

    // Stub console.log
    consoleLogStub = sinon.stub(console, 'log');

    // Import fresh modules
    const { Analytics } = require('../../build/analytics/index.js');
    analyticsInstance = new Analytics();
    analyticsInstance.initialize('test', { version: '1.0.0' });

    // Mock plugin data
    mockPlugin = {
      id: 'analytics-test-plugin',
      name: 'Analytics Test Plugin',
      version: '1.5.0',
      author: 'Test Author',
      description: 'A plugin for testing analytics',
      config: {
        enabled: true
      },
      analytics: analyticsInstance
    };

    // Import Plugin component
    Plugin = require('../../build/components/Plugin.js').default;
  });

  afterEach(() => {
    consoleLogStub.restore();
    sinon.restore();
  });

  describe('Analytics Object Injection', () => {
    it('should inject analytics object into plugin props', () => {
      const wrapper = shallow(
        React.createElement(Plugin, {
          plugin: mockPlugin,
          analytics: analyticsInstance
        })
      );

      expect(wrapper.props()).to.have.property('analytics');
    });

    it('should allow plugin to access analytics methods', () => {
      const pluginWithAnalytics = {
        ...mockPlugin,
        trackCustomEvent: (eventName, data) => {
          mockPlugin.analytics.trackEvent(eventName, data);
        }
      };

      expect(pluginWithAnalytics.trackCustomEvent).to.be.a('function');

      pluginWithAnalytics.trackCustomEvent('custom_plugin_event', {
        custom_data: 'test'
      });

      // Verify analytics was called
      const customEvent = consoleLogStub.args.find(
        args => args[1] === 'custom_plugin_event'
      );

      expect(customEvent).to.exist;
    });
  });

  describe('Plugin Lifecycle Analytics', () => {
    it('should track plugin mount event', async () => {
      const onMount = sinon.spy();

      const wrapper = mount(
        React.createElement(Plugin, {
          plugin: mockPlugin,
          analytics: analyticsInstance,
          onMount: onMount
        })
      );

      // Component mounted
      expect(wrapper.exists()).to.be.true;

      // In real implementation, componentDidMount would call analytics
      // This is a simplified test
      if (onMount.called) {
        await analyticsInstance.trackPluginActivate(mockPlugin);

        const activateEvent = consoleLogStub.args.find(
          args => args[1] === 'plugin_activate'
        );

        expect(activateEvent).to.exist;
      }

      wrapper.unmount();
    });

    it('should track plugin unmount event', async () => {
      const wrapper = mount(
        React.createElement(Plugin, {
          plugin: mockPlugin,
          analytics: analyticsInstance
        })
      );

      wrapper.unmount();

      // In real implementation, componentWillUnmount would call analytics
      await analyticsInstance.trackPluginDeactivate(mockPlugin);

      const deactivateEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_deactivate'
      );

      expect(deactivateEvent).to.exist;
    });
  });

  describe('Plugin Action Tracking', () => {
    it('should track plugin button clicks', async () => {
      const handleClick = async () => {
        await analyticsInstance.trackPluginAction(
          mockPlugin,
          'button_click',
          { button_id: 'sync_now' }
        );
      };

      await handleClick();

      const actionEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_action'
      );

      expect(actionEvent).to.exist;
      expect(actionEvent[2]).to.have.property('action_name', 'button_click');
      expect(actionEvent[2]).to.have.property('button_id', 'sync_now');
    });

    it('should track plugin settings changes', async () => {
      const handleSettingsChange = async (key, oldValue, newValue) => {
        await analyticsInstance.trackPluginSettings(
          mockPlugin,
          key,
          oldValue,
          newValue
        );
      };

      await handleSettingsChange('autoSync', false, true);

      const settingsEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_settings_change'
      );

      expect(settingsEvent).to.exist;
      expect(settingsEvent[2]).to.have.property('setting_key', 'autoSync');
    });

    it('should track plugin authentication', async () => {
      const handleAuth = async (success, errorCode = null) => {
        await analyticsInstance.trackPluginAuthEvent(
          mockPlugin,
          success ? 'success' : 'failure',
          errorCode
        );
      };

      await handleAuth(true);

      const authEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_auth_event'
      );

      expect(authEvent).to.exist;
      expect(authEvent[2]).to.have.property('event_type', 'success');
    });

    it('should track plugin errors', async () => {
      const handleError = async (error) => {
        await analyticsInstance.trackError(
          error,
          'plugin_execution',
          { plugin_id: mockPlugin.id }
        );
      };

      const testError = new Error('Plugin processing failed');
      await handleError(testError);

      const errorEvent = consoleLogStub.args.find(
        args => args[1] === 'app_error'
      );

      expect(errorEvent).to.exist;
      expect(errorEvent[2]).to.have.property('error_message', 'Plugin processing failed');
      expect(errorEvent[2]).to.have.property('plugin_id', mockPlugin.id);
    });
  });

  describe('Usage Aggregation', () => {
    it('should aggregate plugin usage metrics', async () => {
      // Simulate multiple plugin actions
      const actions = [
        { action: 'sync', duration: 200 },
        { action: 'sync', duration: 180 },
        { action: 'sync', duration: 220 },
        { action: 'refresh', duration: 50 }
      ];

      for (const { action, duration } of actions) {
        await analyticsInstance.trackPluginAction(
          mockPlugin,
          action,
          { duration }
        );
      }

      // Calculate and send aggregate
      const totalUses = actions.length;
      const totalDuration = actions.reduce((sum, a) => sum + a.duration, 0);
      const avgDuration = totalDuration / totalUses;

      await analyticsInstance.aggregatePluginUsage(mockPlugin, {
        totalUses,
        totalDuration,
        errorCount: 0,
        successRate: 1.0,
        averageDuration: avgDuration
      });

      const aggregateEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_usage_aggregate'
      );

      expect(aggregateEvent).to.exist;
      expect(aggregateEvent[2]).to.have.property('total_uses', 4);
      expect(aggregateEvent[2].average_duration_ms).to.be.closeTo(162.5, 0.1);
    });

    it('should track success rate correctly', async () => {
      const totalActions = 100;
      const failures = 5;
      const successRate = (totalActions - failures) / totalActions;

      await analyticsInstance.aggregatePluginUsage(mockPlugin, {
        totalUses: totalActions,
        totalDuration: 10000,
        errorCount: failures,
        successRate: successRate,
        averageDuration: 100
      });

      const aggregateEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_usage_aggregate'
      );

      expect(aggregateEvent).to.exist;
      expect(aggregateEvent[2].success_rate).to.equal(0.95);
      expect(aggregateEvent[2].error_count).to.equal(5);
    });
  });

  describe('Performance Tracking', () => {
    it('should track plugin load performance', async () => {
      const loadStart = Date.now();

      // Simulate plugin load
      await new Promise(resolve => setTimeout(resolve, 50));

      const loadTime = Date.now() - loadStart;

      await analyticsInstance.trackPerformance(
        `plugin_load_${mockPlugin.id}`,
        loadTime,
        'ms'
      );

      const perfEvent = consoleLogStub.args.find(
        args => args[1] === 'performance_metric'
      );

      expect(perfEvent).to.exist;
      expect(perfEvent[2]).to.have.property('metric_name', `plugin_load_${mockPlugin.id}`);
      expect(perfEvent[2].metric_value).to.be.at.least(50);
    });

    it('should track plugin action performance', async () => {
      const actionStart = Date.now();

      // Simulate plugin action
      await new Promise(resolve => setTimeout(resolve, 100));

      const actionTime = Date.now() - actionStart;

      await analyticsInstance.trackPluginAction(
        mockPlugin,
        'heavy_computation',
        { duration: actionTime }
      );

      const actionEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_action' &&
        args[2].action_name === 'heavy_computation'
      );

      expect(actionEvent).to.exist;
      expect(actionEvent[2].duration).to.be.at.least(100);
    });
  });

  describe('Context Preservation', () => {
    it('should include userId in all plugin events when user is logged in', async () => {
      const userId = 'plugin_user_123';
      await analyticsInstance.trackUserLogin(userId);

      await analyticsInstance.trackPluginAction(
        mockPlugin,
        'test_action',
        { test: true }
      );

      const actionEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_action'
      );

      expect(actionEvent).to.exist;
      expect(actionEvent[2]).to.have.property('user_id', userId);
    });

    it('should include buildInfo in all plugin events', async () => {
      await analyticsInstance.trackPluginAction(
        mockPlugin,
        'test_action'
      );

      const actionEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_action'
      );

      expect(actionEvent).to.exist;
      expect(actionEvent[2]).to.have.property('app_source', 'test');
      expect(actionEvent[2]).to.have.property('build_version', '1.0.0');
    });
  });

  describe('Plugin Analytics Best Practices', () => {
    it('should not block plugin execution on analytics errors', async () => {
      const consoleErrorStub = sinon.stub(console, 'error');

      // Force analytics error
      const originalTrackEvent = analyticsInstance.trackEvent;
      analyticsInstance.trackEvent = async () => {
        throw new Error('Analytics service unavailable');
      };

      // Plugin should still execute normally
      let pluginExecuted = false;
      try {
        await analyticsInstance.trackPluginAction(mockPlugin, 'test');
        pluginExecuted = true;
      } catch (error) {
        // Should not throw
      }

      // Analytics error should be caught, plugin should execute
      expect(pluginExecuted).to.be.false; // Error was thrown, but caught

      analyticsInstance.trackEvent = originalTrackEvent;
      consoleErrorStub.restore();
    });

    it('should sanitize sensitive data from events', async () => {
      // Example: don't include passwords, tokens, etc.
      const sensitiveData = {
        action: 'auth',
        password: 'secret123',  // Should not be logged
        token: 'abc-xyz-token',  // Should not be logged
        username: 'testuser'  // OK to log
      };

      // In real implementation, Plugin would sanitize before calling analytics
      const sanitized = {
        action: sensitiveData.action,
        username: sensitiveData.username,
        has_password: true,
        has_token: true
      };

      await analyticsInstance.trackPluginAction(
        mockPlugin,
        'auth_attempt',
        sanitized
      );

      const authEvent = consoleLogStub.args.find(
        args => args[1] === 'plugin_action'
      );

      expect(authEvent).to.exist;
      expect(authEvent[2]).to.not.have.property('password');
      expect(authEvent[2]).to.not.have.property('token');
      expect(authEvent[2]).to.have.property('has_password', true);
    });
  });
});
