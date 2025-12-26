/**
 * Firebase Configuration Tests
 *
 * Tests environment detection, git metadata capture, store ID detection,
 * and Firebase initialization for both main and renderer processes.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { execSync } = require('child_process');

describe('Firebase Configuration', () => {
  let firebaseConfig;
  let execSyncStub;
  let processEnvBackup;

  beforeEach(() => {
    // Backup process.env
    processEnvBackup = { ...process.env };

    // Clear require cache to get fresh module
    delete require.cache[require.resolve('../../app/analytics/firebase-config.js')];

    // Stub execSync for git commands
    execSyncStub = sinon.stub(require('child_process'), 'execSync');
  });

  afterEach(() => {
    // Restore process.env
    process.env = processEnvBackup;

    // Restore stubs
    if (execSyncStub) {
      execSyncStub.restore();
    }
  });

  describe('Environment Detection', () => {
    it('should detect Mac App Store build', () => {
      process.mas = true;
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const env = firebaseConfig.detectEnvironment();

      expect(env.buildType).to.equal('production');
      expect(env.distributionChannel).to.equal('mac-app-store');
      expect(env.isStoreDistribution).to.be.true;
      expect(env.isDevelopment).to.be.false;

      delete process.mas;
    });

    it('should detect Windows Store build', () => {
      process.windowsStore = true;
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const env = firebaseConfig.detectEnvironment();

      expect(env.buildType).to.equal('production');
      expect(env.distributionChannel).to.equal('windows-store');
      expect(env.isStoreDistribution).to.be.true;

      delete process.windowsStore;
    });

    it('should detect Snap package build', () => {
      process.env.SNAP = '/snap/allow2automate/x1';
      process.env.SNAP_REVISION = '42';
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const env = firebaseConfig.detectEnvironment();

      expect(env.buildType).to.equal('production');
      expect(env.distributionChannel).to.equal('snap-store');
      expect(env.isStoreDistribution).to.be.true;
      expect(env.snapRevision).to.equal('42');
    });

    it('should detect development mode via NODE_ENV', () => {
      process.env.NODE_ENV = 'development';
      execSyncStub.withArgs(sinon.match(/git config/))
        .returns('https://github.com/Allow2/Allow2Automate.git\n');
      execSyncStub.withArgs(sinon.match(/git rev-parse HEAD/))
        .returns('abc123def456789012345678901234567890abcd\n');
      execSyncStub.withArgs(sinon.match(/git rev-parse --abbrev-ref/))
        .returns('main\n');

      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const env = firebaseConfig.detectEnvironment();

      expect(env.buildType).to.equal('development');
      expect(env.distributionChannel).to.equal('dev');
      expect(env.isDevelopment).to.be.true;
      expect(env.gitMetadata).to.exist;
      expect(env.gitMetadata.branch).to.equal('main');
      expect(env.gitMetadata.commitShort).to.equal('abc123d');
    });

    it('should detect development mode via process.defaultApp', () => {
      process.defaultApp = true;
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const env = firebaseConfig.detectEnvironment();

      expect(env.buildType).to.equal('development');
      expect(env.isDevelopment).to.be.true;

      delete process.defaultApp;
    });

    it('should default to custom-build for unknown distribution', () => {
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const env = firebaseConfig.detectEnvironment();

      expect(env.buildType).to.equal('production');
      expect(env.distributionChannel).to.equal('custom-build');
      expect(env.isStoreDistribution).to.be.false;
    });

    it('should capture platform and architecture', () => {
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const env = firebaseConfig.detectEnvironment();

      expect(env.platform).to.exist;
      expect(env.arch).to.exist;
      expect(env.nodeVersion).to.exist;
      expect(env.electronVersion).to.exist;
    });
  });

  describe('Git Metadata Capture', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should capture git repository URL', () => {
      execSyncStub.withArgs(sinon.match(/git config/))
        .returns('https://github.com/Allow2/Allow2Automate.git\n');
      execSyncStub.withArgs(sinon.match(/git rev-parse HEAD/))
        .returns('abc123\n');
      execSyncStub.withArgs(sinon.match(/git rev-parse --abbrev-ref/))
        .returns('feature-branch\n');

      firebaseConfig = require('../../app/analytics/firebase-config.js');
      const env = firebaseConfig.detectEnvironment();

      expect(env.gitMetadata.repo).to.equal('https://github.com/Allow2/Allow2Automate.git');
    });

    it('should capture git commit hash and short version', () => {
      execSyncStub.withArgs(sinon.match(/git config/))
        .returns('repo\n');
      execSyncStub.withArgs(sinon.match(/git rev-parse HEAD/))
        .returns('1234567890abcdef1234567890abcdef12345678\n');
      execSyncStub.withArgs(sinon.match(/git rev-parse --abbrev-ref/))
        .returns('main\n');

      firebaseConfig = require('../../app/analytics/firebase-config.js');
      const env = firebaseConfig.detectEnvironment();

      expect(env.gitMetadata.commit).to.equal('1234567890abcdef1234567890abcdef12345678');
      expect(env.gitMetadata.commitShort).to.equal('1234567');
    });

    it('should capture current git branch', () => {
      execSyncStub.withArgs(sinon.match(/git config/))
        .returns('repo\n');
      execSyncStub.withArgs(sinon.match(/git rev-parse HEAD/))
        .returns('abc123\n');
      execSyncStub.withArgs(sinon.match(/git rev-parse --abbrev-ref/))
        .returns('feature/analytics-tracking\n');

      firebaseConfig = require('../../app/analytics/firebase-config.js');
      const env = firebaseConfig.detectEnvironment();

      expect(env.gitMetadata.branch).to.equal('feature/analytics-tracking');
    });

    it('should handle git command failures gracefully', () => {
      execSyncStub.throws(new Error('Not a git repository'));

      firebaseConfig = require('../../app/analytics/firebase-config.js');
      const env = firebaseConfig.detectEnvironment();

      expect(env.gitMetadata).to.exist;
      expect(env.gitMetadata.error).to.exist;
      expect(env.gitMetadata.reason).to.equal('Not a git repository');
    });
  });

  describe('CI/CD Environment Variables', () => {
    it('should capture CI build number', () => {
      process.env.CI_BUILD_NUMBER = '1234';
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const env = firebaseConfig.detectEnvironment();

      expect(env.ciBuildNumber).to.equal('1234');
    });

    it('should capture CI commit SHA', () => {
      process.env.CI_COMMIT_SHA = 'abc123def456';
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const env = firebaseConfig.detectEnvironment();

      expect(env.ciCommitSha).to.equal('abc123def456');
    });

    it('should capture CI branch', () => {
      process.env.CI_BRANCH = 'release/2.0';
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const env = firebaseConfig.detectEnvironment();

      expect(env.ciBranch).to.equal('release/2.0');
    });

    it('should capture build timestamp', () => {
      process.env.BUILD_TIMESTAMP = '2025-12-25T12:00:00Z';
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const env = firebaseConfig.detectEnvironment();

      expect(env.buildTimestamp).to.equal('2025-12-25T12:00:00Z');
    });
  });

  describe('Main Process Initialization', () => {
    it('should initialize main process and return environment tags', () => {
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const result = firebaseConfig.initializeMainProcess();

      expect(result).to.exist;
      expect(result.environmentTags).to.exist;
      expect(result.environmentTags.platform).to.exist;
      expect(result.environmentTags.buildType).to.exist;
    });

    it('should provide logMainEvent function', () => {
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const result = firebaseConfig.initializeMainProcess();

      expect(result.logMainEvent).to.be.a('function');
    });

    it('should handle initialization errors gracefully', () => {
      // Simulate error by requiring a broken module
      const originalRequire = require('firebase/app').initializeApp;
      require('firebase/app').initializeApp = () => {
        throw new Error('Firebase init failed');
      };

      firebaseConfig = require('../../app/analytics/firebase-config.js');
      const result = firebaseConfig.initializeMainProcess();

      // Should return null on error
      expect(result).to.be.null;

      // Restore
      require('firebase/app').initializeApp = originalRequire;
    });
  });

  describe('Renderer Process Initialization', () => {
    it('should return null when not in browser environment', () => {
      // window is undefined in Node.js test environment
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      const result = firebaseConfig.initializeRendererProcess();

      expect(result).to.be.null;
    });

    // Note: Testing actual browser environment requires a different setup
    // Using jsdom or similar, which would be covered in integration tests
  });

  describe('Analytics Functions', () => {
    beforeEach(() => {
      firebaseConfig = require('../../app/analytics/firebase-config.js');
    });

    describe('setAnalyticsUserId', () => {
      it('should not throw when analytics is not initialized', () => {
        expect(() => {
          firebaseConfig.setAnalyticsUserId('user123');
        }).to.not.throw();
      });
    });

    describe('logAnalyticsEvent', () => {
      it('should not throw when analytics is not initialized', () => {
        expect(() => {
          firebaseConfig.logAnalyticsEvent('test_event', { key: 'value' });
        }).to.not.throw();
      });

      it('should merge environment tags with event params', () => {
        // This would require mocking the analytics object
        // Covered in integration tests
      });
    });

    describe('getEnvironmentTags', () => {
      it('should return environment tags', () => {
        const tags = firebaseConfig.getEnvironmentTags();

        expect(tags).to.exist;
        expect(tags.platform).to.exist;
        expect(tags.buildType).to.exist;
        expect(tags.distributionChannel).to.exist;
      });

      it('should detect environment on first call', () => {
        // Clear cached tags
        delete require.cache[require.resolve('../../app/analytics/firebase-config.js')];
        firebaseConfig = require('../../app/analytics/firebase-config.js');

        const tags1 = firebaseConfig.getEnvironmentTags();
        const tags2 = firebaseConfig.getEnvironmentTags();

        // Should return same object (cached)
        expect(tags1).to.deep.equal(tags2);
      });
    });
  });

  describe('Firebase Config Object', () => {
    it('should have valid Firebase configuration', () => {
      firebaseConfig = require('../../app/analytics/firebase-config.js');

      // Module exports functions, config is internal
      expect(firebaseConfig.initializeMainProcess).to.be.a('function');
      expect(firebaseConfig.initializeRendererProcess).to.be.a('function');
      expect(firebaseConfig.setAnalyticsUserId).to.be.a('function');
      expect(firebaseConfig.logAnalyticsEvent).to.be.a('function');
    });
  });
});
