import { jest } from '@jest/globals';
import { AgentDiscovery } from '../../src/services/AgentDiscovery.js';
import EventEmitter from 'events';

// Mock mdns
const mockMdnsBrowser = new EventEmitter();
const mockMdns = {
  createBrowser: jest.fn(() => mockMdnsBrowser),
  tcp: jest.fn((service) => service),
  start: jest.fn()
};

jest.mock('mdns', () => mockMdns, { virtual: true });

describe('AgentDiscovery', () => {
  let agentDiscovery;

  beforeEach(() => {
    jest.clearAllMocks();
    agentDiscovery = new AgentDiscovery();
  });

  afterEach(() => {
    if (agentDiscovery.browser) {
      agentDiscovery.stop();
    }
  });

  describe('constructor', () => {
    test('initializes with empty discovered agents', () => {
      expect(agentDiscovery.discoveredAgents.size).toBe(0);
    });

    test('extends EventEmitter', () => {
      expect(agentDiscovery).toBeInstanceOf(EventEmitter);
    });
  });

  describe('start', () => {
    test('creates mDNS browser', () => {
      agentDiscovery.start();
      expect(mockMdns.createBrowser).toHaveBeenCalled();
    });

    test('starts mDNS discovery', () => {
      agentDiscovery.start();
      expect(mockMdnsBrowser.start).toBeDefined();
    });

    test('listens for serviceUp events', () => {
      agentDiscovery.start();

      const service = {
        name: 'Test Agent',
        addresses: ['192.168.1.100'],
        port: 8443,
        txtRecord: {
          id: 'agent-1',
          hostname: 'test-pc',
          platform: 'win32'
        }
      };

      mockMdnsBrowser.emit('serviceUp', service);

      expect(agentDiscovery.discoveredAgents.has('agent-1')).toBe(true);
    });

    test('does not start if already running', () => {
      agentDiscovery.start();
      const firstCallCount = mockMdns.createBrowser.mock.calls.length;

      agentDiscovery.start();

      expect(mockMdns.createBrowser.mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('stop', () => {
    test('stops mDNS browser', () => {
      agentDiscovery.start();
      mockMdnsBrowser.stop = jest.fn();

      agentDiscovery.stop();

      expect(mockMdnsBrowser.stop).toHaveBeenCalled();
    });

    test('clears discovered agents', () => {
      agentDiscovery.start();

      mockMdnsBrowser.emit('serviceUp', {
        txtRecord: { id: 'agent-1' },
        addresses: ['192.168.1.100']
      });

      agentDiscovery.stop();

      expect(agentDiscovery.discoveredAgents.size).toBe(0);
    });
  });

  describe('serviceUp event handling', () => {
    beforeEach(() => {
      agentDiscovery.start();
    });

    test('adds discovered agent to map', () => {
      const service = {
        name: 'Test Agent',
        addresses: ['192.168.1.100'],
        port: 8443,
        txtRecord: {
          id: 'agent-1',
          hostname: 'test-pc',
          platform: 'win32'
        }
      };

      mockMdnsBrowser.emit('serviceUp', service);

      const agent = agentDiscovery.discoveredAgents.get('agent-1');
      expect(agent).toBeDefined();
      expect(agent.hostname).toBe('test-pc');
      expect(agent.ipAddresses).toContain('192.168.1.100');
    });

    test('emits agentDiscovered event', (done) => {
      agentDiscovery.on('agentDiscovered', (agentInfo) => {
        expect(agentInfo.id).toBe('agent-1');
        expect(agentInfo.hostname).toBe('test-pc');
        done();
      });

      mockMdnsBrowser.emit('serviceUp', {
        txtRecord: {
          id: 'agent-1',
          hostname: 'test-pc',
          platform: 'win32'
        },
        addresses: ['192.168.1.100'],
        port: 8443
      });
    });

    test('handles multiple addresses', () => {
      mockMdnsBrowser.emit('serviceUp', {
        txtRecord: { id: 'agent-1', hostname: 'test-pc', platform: 'win32' },
        addresses: ['192.168.1.100', '10.0.0.50'],
        port: 8443
      });

      const agent = agentDiscovery.discoveredAgents.get('agent-1');
      expect(agent.ipAddresses).toEqual(['192.168.1.100', '10.0.0.50']);
    });

    test('updates existing agent', () => {
      mockMdnsBrowser.emit('serviceUp', {
        txtRecord: { id: 'agent-1', hostname: 'old-name', platform: 'win32' },
        addresses: ['192.168.1.100'],
        port: 8443
      });

      mockMdnsBrowser.emit('serviceUp', {
        txtRecord: { id: 'agent-1', hostname: 'new-name', platform: 'win32' },
        addresses: ['192.168.1.101'],
        port: 8443
      });

      const agent = agentDiscovery.discoveredAgents.get('agent-1');
      expect(agent.hostname).toBe('new-name');
      expect(agent.ipAddresses).toContain('192.168.1.101');
    });
  });

  describe('serviceDown event handling', () => {
    beforeEach(() => {
      agentDiscovery.start();

      mockMdnsBrowser.emit('serviceUp', {
        txtRecord: { id: 'agent-1', hostname: 'test-pc', platform: 'win32' },
        addresses: ['192.168.1.100'],
        port: 8443
      });
    });

    test('removes agent from map', () => {
      mockMdnsBrowser.emit('serviceDown', {
        txtRecord: { id: 'agent-1' }
      });

      expect(agentDiscovery.discoveredAgents.has('agent-1')).toBe(false);
    });

    test('emits agentLost event', (done) => {
      agentDiscovery.on('agentLost', (agentId) => {
        expect(agentId).toBe('agent-1');
        done();
      });

      mockMdnsBrowser.emit('serviceDown', {
        txtRecord: { id: 'agent-1' }
      });
    });

    test('handles unknown agent gracefully', () => {
      expect(() => {
        mockMdnsBrowser.emit('serviceDown', {
          txtRecord: { id: 'unknown' }
        });
      }).not.toThrow();
    });
  });

  describe('getDiscoveredAgents', () => {
    test('returns empty array when no agents discovered', () => {
      const agents = agentDiscovery.getDiscoveredAgents();
      expect(agents).toEqual([]);
    });

    test('returns all discovered agents', () => {
      agentDiscovery.start();

      mockMdnsBrowser.emit('serviceUp', {
        txtRecord: { id: 'agent-1', hostname: 'pc-1', platform: 'win32' },
        addresses: ['192.168.1.101'],
        port: 8443
      });

      mockMdnsBrowser.emit('serviceUp', {
        txtRecord: { id: 'agent-2', hostname: 'pc-2', platform: 'darwin' },
        addresses: ['192.168.1.102'],
        port: 8443
      });

      const agents = agentDiscovery.getDiscoveredAgents();
      expect(agents.length).toBe(2);
      expect(agents.map(a => a.id)).toContain('agent-1');
      expect(agents.map(a => a.id)).toContain('agent-2');
    });
  });

  describe('error handling', () => {
    test('handles mDNS errors', (done) => {
      agentDiscovery.start();

      agentDiscovery.on('error', (error) => {
        expect(error.message).toMatch(/test error/i);
        done();
      });

      mockMdnsBrowser.emit('error', new Error('Test error'));
    });

    test('continues operation after error', () => {
      agentDiscovery.start();

      mockMdnsBrowser.emit('error', new Error('Test error'));

      // Should still be able to discover agents
      mockMdnsBrowser.emit('serviceUp', {
        txtRecord: { id: 'agent-1', hostname: 'test-pc', platform: 'win32' },
        addresses: ['192.168.1.100'],
        port: 8443
      });

      expect(agentDiscovery.discoveredAgents.has('agent-1')).toBe(true);
    });
  });

  describe('cleanup', () => {
    test('clears stale agents', () => {
      jest.useFakeTimers();
      const now = Date.now();

      agentDiscovery.start();

      mockMdnsBrowser.emit('serviceUp', {
        txtRecord: { id: 'agent-1', hostname: 'test-pc', platform: 'win32' },
        addresses: ['192.168.1.100'],
        port: 8443
      });

      // Manually set old lastSeen
      const agent = agentDiscovery.discoveredAgents.get('agent-1');
      agent.lastSeen = new Date(now - 10 * 60 * 1000); // 10 minutes ago

      agentDiscovery.cleanupStaleAgents(5 * 60 * 1000); // 5 minute timeout

      expect(agentDiscovery.discoveredAgents.has('agent-1')).toBe(false);

      jest.useRealTimers();
    });
  });
});
