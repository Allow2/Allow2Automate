import { jest } from '@jest/globals';
import { AgentService } from '../../src/services/AgentService.js';

describe('Agent-Plugin Integration', () => {
  let agentService;

  beforeEach(() => {
    agentService = new AgentService();
  });

  describe('Steam plugin integration', () => {
    test('agent receives Steam policies from plugin', async () => {
      // Mock agent
      const mockAgent = {
        id: 'agent-1',
        hostname: 'gaming-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      };

      agentService.registerAgent(mockAgent);

      // Mock Steam plugin policies
      const steamPolicies = [
        { processName: 'Steam.exe', allowed: false, checkInterval: 30000 },
        { processName: 'hl2.exe', allowed: false, checkInterval: 30000 }
      ];

      // Mock fetch for policy update
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await agentService.updatePolicies('agent-1', steamPolicies);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/policies'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    test('agent enforces Steam policies', async () => {
      // This would test the full flow:
      // 1. Plugin detects Steam games
      // 2. Sends policies to parent
      // 3. Parent sends to agent
      // 4. Agent enforces policies

      const mockAgent = {
        id: 'agent-1',
        hostname: 'gaming-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      };

      agentService.registerAgent(mockAgent);

      const steamPolicies = [
        { processName: 'Steam.exe', allowed: false, checkInterval: 30000 }
      ];

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            violations: [
              {
                processName: 'Steam.exe',
                pid: 1234,
                timestamp: new Date(),
                action: 'killed'
              }
            ]
          })
        });

      await agentService.updatePolicies('agent-1', steamPolicies);
      const violations = await agentService.getViolations('agent-1');

      expect(violations.length).toBe(1);
      expect(violations[0].processName).toBe('Steam.exe');
    });
  });

  describe('Epic plugin integration', () => {
    test('agent receives Epic policies from plugin', async () => {
      const mockAgent = {
        id: 'agent-1',
        hostname: 'gaming-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      };

      agentService.registerAgent(mockAgent);

      const epicPolicies = [
        { processName: 'EpicGamesLauncher.exe', allowed: false, checkInterval: 30000 },
        { processName: 'FortniteClient-Win64-Shipping.exe', allowed: false, checkInterval: 30000 }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await agentService.updatePolicies('agent-1', epicPolicies);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Multi-plugin scenario', () => {
    test('agent handles policies from multiple plugins', async () => {
      const mockAgent = {
        id: 'agent-1',
        hostname: 'gaming-pc',
        platform: 'win32',
        ipAddresses: ['192.168.1.100']
      };

      agentService.registerAgent(mockAgent);

      // Combined policies from Steam and Epic plugins
      const combinedPolicies = [
        { processName: 'Steam.exe', allowed: false, checkInterval: 30000 },
        { processName: 'EpicGamesLauncher.exe', allowed: false, checkInterval: 30000 },
        { processName: 'hl2.exe', allowed: false, checkInterval: 30000 },
        { processName: 'FortniteClient-Win64-Shipping.exe', allowed: false, checkInterval: 30000 }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await agentService.updatePolicies('agent-1', combinedPolicies);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ policies: combinedPolicies })
        })
      );
    });
  });
});
