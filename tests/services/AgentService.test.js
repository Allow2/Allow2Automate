import { jest } from '@jest/globals';
import { AgentService } from '../../src/services/AgentService.js';
import EventEmitter from 'events';

describe('AgentService', () => {
  let agentService;
  let mockDb;

  beforeEach(() => {
    // Mock database
    mockDb = {
      prepare: jest.fn((sql) => ({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn()
      }))
    };

    agentService = new AgentService(mockDb);
  });

  describe('constructor', () => {
    test('initializes with empty agents map', () => {
      expect(agentService.agents.size).toBe(0);
    });

    test('extends EventEmitter', () => {
      expect(agentService).toBeInstanceOf(EventEmitter);
    });
  });

  describe('registerAgent', () => {
    test('registers new agent', () => {
      const agentInfo = {
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      };

      agentService.registerAgent(agentInfo);

      expect(agentService.agents.has('agent-1')).toBe(true);
      const agent = agentService.agents.get('agent-1');
      expect(agent.hostname).toBe('test-pc');
      expect(agent.online).toBe(true);
    });

    test('updates existing agent', () => {
      const agentInfo = {
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      };

      agentService.registerAgent(agentInfo);

      const updatedInfo = {
        ...agentInfo,
        hostname: 'updated-pc'
      };

      agentService.registerAgent(updatedInfo);

      const agent = agentService.agents.get('agent-1');
      expect(agent.hostname).toBe('updated-pc');
    });

    test('emits agentRegistered event', (done) => {
      const agentInfo = {
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      };

      agentService.on('agentRegistered', (agent) => {
        expect(agent.id).toBe('agent-1');
        done();
      });

      agentService.registerAgent(agentInfo);
    });

    test('sets lastSeen timestamp', () => {
      const before = Date.now();

      agentService.registerAgent({
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      });

      const after = Date.now();
      const agent = agentService.agents.get('agent-1');
      const lastSeen = new Date(agent.lastSeen).getTime();

      expect(lastSeen).toBeGreaterThanOrEqual(before);
      expect(lastSeen).toBeLessThanOrEqual(after);
    });
  });

  describe('getAgent', () => {
    beforeEach(() => {
      agentService.registerAgent({
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      });
    });

    test('returns agent by id', () => {
      const agent = agentService.getAgent('agent-1');
      expect(agent).toBeDefined();
      expect(agent.id).toBe('agent-1');
    });

    test('returns undefined for unknown agent', () => {
      const agent = agentService.getAgent('unknown');
      expect(agent).toBeUndefined();
    });
  });

  describe('getAllAgents', () => {
    test('returns empty array when no agents', () => {
      const agents = agentService.getAllAgents();
      expect(agents).toEqual([]);
    });

    test('returns all registered agents', () => {
      agentService.registerAgent({
        id: 'agent-1',
        hostname: 'pc-1',
        platform: 'win32',
        ipAddresses: ['192.168.1.101']
      });

      agentService.registerAgent({
        id: 'agent-2',
        hostname: 'pc-2',
        platform: 'darwin',
        ipAddresses: ['192.168.1.102']
      });

      const agents = agentService.getAllAgents();
      expect(agents.length).toBe(2);
      expect(agents.map(a => a.id)).toContain('agent-1');
      expect(agents.map(a => a.id)).toContain('agent-2');
    });
  });

  describe('updateAgentStatus', () => {
    beforeEach(() => {
      agentService.registerAgent({
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      });
    });

    test('updates agent online status', () => {
      agentService.updateAgentStatus('agent-1', false);

      const agent = agentService.getAgent('agent-1');
      expect(agent.online).toBe(false);
    });

    test('updates lastSeen timestamp', () => {
      const before = Date.now();
      agentService.updateAgentStatus('agent-1', true);
      const after = Date.now();

      const agent = agentService.getAgent('agent-1');
      const lastSeen = new Date(agent.lastSeen).getTime();

      expect(lastSeen).toBeGreaterThanOrEqual(before);
      expect(lastSeen).toBeLessThanOrEqual(after);
    });

    test('emits agentStatusChanged event', (done) => {
      agentService.on('agentStatusChanged', (agent) => {
        expect(agent.id).toBe('agent-1');
        expect(agent.online).toBe(false);
        done();
      });

      agentService.updateAgentStatus('agent-1', false);
    });

    test('handles unknown agent gracefully', () => {
      expect(() => {
        agentService.updateAgentStatus('unknown', true);
      }).not.toThrow();
    });
  });

  describe('updatePolicies', () => {
    test('sends policies to specific agent', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      agentService.registerAgent({
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      });

      const policies = [
        { processName: 'Steam.exe', allowed: false, checkInterval: 30000 }
      ];

      await agentService.updatePolicies('agent-1', policies);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.100'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ policies })
        })
      );
    });

    test('handles agent not found', async () => {
      const policies = [];
      await expect(
        agentService.updatePolicies('unknown', policies)
      ).rejects.toThrow(/not found/i);
    });

    test('handles network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      agentService.registerAgent({
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      });

      const policies = [];
      await expect(
        agentService.updatePolicies('agent-1', policies)
      ).rejects.toThrow('Network error');
    });
  });

  describe('getViolations', () => {
    test('fetches violations from agent', async () => {
      const mockViolations = [
        {
          processName: 'Steam.exe',
          pid: 1234,
          timestamp: new Date(),
          action: 'killed'
        }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ violations: mockViolations })
      });

      agentService.registerAgent({
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      });

      const violations = await agentService.getViolations('agent-1');

      expect(violations).toEqual(mockViolations);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/violations'),
        expect.any(Object)
      );
    });

    test('supports limit parameter', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ violations: [] })
      });

      agentService.registerAgent({
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      });

      await agentService.getViolations('agent-1', 10);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });

    test('handles fetch errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500
      });

      agentService.registerAgent({
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      });

      await expect(
        agentService.getViolations('agent-1')
      ).rejects.toThrow();
    });
  });

  describe('removeAgent', () => {
    beforeEach(() => {
      agentService.registerAgent({
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      });
    });

    test('removes agent from map', () => {
      agentService.removeAgent('agent-1');
      expect(agentService.agents.has('agent-1')).toBe(false);
    });

    test('emits agentRemoved event', (done) => {
      agentService.on('agentRemoved', (agentId) => {
        expect(agentId).toBe('agent-1');
        done();
      });

      agentService.removeAgent('agent-1');
    });

    test('handles removing unknown agent', () => {
      expect(() => {
        agentService.removeAgent('unknown');
      }).not.toThrow();
    });
  });

  describe('cleanupStaleAgents', () => {
    test('marks agents offline after timeout', () => {
      jest.useFakeTimers();
      const now = Date.now();

      agentService.registerAgent({
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      });

      // Manually set old lastSeen
      const agent = agentService.agents.get('agent-1');
      agent.lastSeen = new Date(now - 10 * 60 * 1000); // 10 minutes ago

      agentService.cleanupStaleAgents(5 * 60 * 1000); // 5 minute timeout

      expect(agent.online).toBe(false);

      jest.useRealTimers();
    });

    test('does not mark recent agents offline', () => {
      agentService.registerAgent({
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      });

      agentService.cleanupStaleAgents(5 * 60 * 1000);

      const agent = agentService.agents.get('agent-1');
      expect(agent.online).toBe(true);
    });
  });
});
