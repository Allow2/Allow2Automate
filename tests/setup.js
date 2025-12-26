/**
 * Test Setup Configuration
 *
 * Configures Enzyme adapter for React 16 and global test utilities
 * Includes Firebase Analytics mocking for test isolation
 */

const { configure } = require('enzyme');
const Adapter = require('enzyme-adapter-react-16');
const sinon = require('sinon');

// Configure Enzyme with React 16 adapter
configure({ adapter: new Adapter() });

// Global test helpers
global.expect = require('chai').expect;
global.sinon = sinon;

// Mock Firebase Analytics for all tests
global.mockFirebaseAnalytics = () => {
  return {
    logEvent: sinon.stub().resolves(),
    setUserId: sinon.stub().resolves(),
    setUserProperties: sinon.stub().resolves(),
    logScreenView: sinon.stub().resolves()
  };
};

// Mock window object for renderer process tests
if (typeof global.window === 'undefined') {
  global.window = {
    ipcRenderer: {
      send: sinon.stub(),
      on: sinon.stub(),
      invoke: sinon.stub().resolves()
    }
  };
}

// Suppress console output during tests (can be enabled for debugging)
const SUPPRESS_LOGS = process.env.SUPPRESS_TEST_LOGS !== 'false';

if (SUPPRESS_LOGS) {
  global.originalConsoleLog = console.log;
  global.originalConsoleWarn = console.warn;
  global.originalConsoleError = console.error;

  // Only suppress Firebase and Analytics logs
  console.log = (...args) => {
    if (!args[0] || (!args[0].includes('[Firebase]') && !args[0].includes('[Analytics]'))) {
      global.originalConsoleLog(...args);
    }
  };

  console.warn = (...args) => {
    if (!args[0] || (!args[0].includes('[Firebase]') && !args[0].includes('[Analytics]'))) {
      global.originalConsoleWarn(...args);
    }
  };

  console.error = (...args) => {
    if (!args[0] || (!args[0].includes('[Firebase]') && !args[0].includes('[Analytics]'))) {
      global.originalConsoleError(...args);
    }
  };
}

// Cleanup after all tests
after(() => {
  if (SUPPRESS_LOGS) {
    console.log = global.originalConsoleLog;
    console.warn = global.originalConsoleWarn;
    console.error = global.originalConsoleError;
  }
});
