import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createAgentRouter } from '../../src/routes/agent.js';

describe('Agent Routes', () => {
  let app;
  let mockAgentService;

  beforeEach(() => {
    // Mock AgentService
    mockAgentService = {
      getAllAgents: jest.fn().mockReturnValue([]),
      getAgent: jest.fn(),
      updatePolicies: jest.fn().mockResolvedValue(),
      getViolations: jest.fn().mockResolvedValue([]),
      removeAgent: jest.fn()
    };

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/agents', createAgentRouter(mockAgentService));
  });

  describe('GET /api/agents', () => {
    test('returns list of agents', async () => {
      const mockAgents = [
        { id: 'agent-1', hostname: 'pc-1', online: true },
        { id: 'agent-2', hostname: 'pc-2', online: false }
      ];

      mockAgentService.getAllAgents.mockReturnValue(mockAgents);

      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response.body.agents).toEqual(mockAgents);
    });

    test('returns empty array when no agents', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response.body.agents).toEqual([]);
    });
  });

  describe('GET /api/agents/:id', () => {
    test('returns agent by id', async () => {
      const mockAgent = {
        id: 'agent-1',
        hostname: 'test-pc',
        platform: 'win32',
        online: true
      };

      mockAgentService.getAgent.mockReturnValue(mockAgent);

      const response = await request(app)
        .get('/api/agents/agent-1')
        .expect(200);

      expect(response.body.agent).toEqual(mockAgent);
    });

    test('returns 404 for unknown agent', async () => {
      mockAgentService.getAgent.mockReturnValue(undefined);

      const response = await request(app)
        .get('/api/agents/unknown')
        .expect(404);

      expect(response.body.error).toMatch(/not found/i);
    });
  });

  describe('POST /api/agents/:id/policies', () => {
    test('updates agent policies', async () => {
      const policies = [
        { processName: 'Steam.exe', allowed: false, checkInterval: 30000 }
      ];

      mockAgentService.getAgent.mockReturnValue({ id: 'agent-1' });

      const response = await request(app)
        .post('/api/agents/agent-1/policies')
        .send({ policies })
        .expect(200);

      expect(mockAgentService.updatePolicies).toHaveBeenCalledWith('agent-1', policies);
      expect(response.body.success).toBe(true);
    });

    test('validates request body', async () => {
      mockAgentService.getAgent.mockReturnValue({ id: 'agent-1' });

      const response = await request(app)
        .post('/api/agents/agent-1/policies')
        .send({}) // Missing policies
        .expect(400);

      expect(response.body.error).toMatch(/policies/i);
    });

    test('validates policies array', async () => {
      mockAgentService.getAgent.mockReturnValue({ id: 'agent-1' });

      const response = await request(app)
        .post('/api/agents/agent-1/policies')
        .send({ policies: 'not-an-array' })
        .expect(400);

      expect(response.body.error).toMatch(/array/i);
    });

    test('returns 404 for unknown agent', async () => {
      mockAgentService.getAgent.mockReturnValue(undefined);

      const response = await request(app)
        .post('/api/agents/unknown/policies')
        .send({ policies: [] })
        .expect(404);

      expect(response.body.error).toMatch(/not found/i);
    });

    test('handles update errors', async () => {
      mockAgentService.getAgent.mockReturnValue({ id: 'agent-1' });
      mockAgentService.updatePolicies.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .post('/api/agents/agent-1/policies')
        .send({ policies: [] })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/agents/:id/violations', () => {
    test('returns agent violations', async () => {
      const mockViolations = [
        {
          processName: 'Steam.exe',
          pid: 1234,
          timestamp: new Date(),
          action: 'killed'
        }
      ];

      mockAgentService.getAgent.mockReturnValue({ id: 'agent-1' });
      mockAgentService.getViolations.mockResolvedValue(mockViolations);

      const response = await request(app)
        .get('/api/agents/agent-1/violations')
        .expect(200);

      expect(response.body.violations).toEqual(mockViolations);
    });

    test('supports limit parameter', async () => {
      mockAgentService.getAgent.mockReturnValue({ id: 'agent-1' });
      mockAgentService.getViolations.mockResolvedValue([]);

      await request(app)
        .get('/api/agents/agent-1/violations?limit=10')
        .expect(200);

      expect(mockAgentService.getViolations).toHaveBeenCalledWith('agent-1', 10);
    });

    test('validates limit parameter', async () => {
      mockAgentService.getAgent.mockReturnValue({ id: 'agent-1' });

      const response = await request(app)
        .get('/api/agents/agent-1/violations?limit=invalid')
        .expect(400);

      expect(response.body.error).toMatch(/limit/i);
    });

    test('returns 404 for unknown agent', async () => {
      mockAgentService.getAgent.mockReturnValue(undefined);

      const response = await request(app)
        .get('/api/agents/unknown/violations')
        .expect(404);

      expect(response.body.error).toMatch(/not found/i);
    });

    test('handles fetch errors', async () => {
      mockAgentService.getAgent.mockReturnValue({ id: 'agent-1' });
      mockAgentService.getViolations.mockRejectedValue(new Error('Fetch failed'));

      const response = await request(app)
        .get('/api/agents/agent-1/violations')
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('DELETE /api/agents/:id', () => {
    test('removes agent', async () => {
      mockAgentService.getAgent.mockReturnValue({ id: 'agent-1' });

      const response = await request(app)
        .delete('/api/agents/agent-1')
        .expect(200);

      expect(mockAgentService.removeAgent).toHaveBeenCalledWith('agent-1');
      expect(response.body.success).toBe(true);
    });

    test('returns 404 for unknown agent', async () => {
      mockAgentService.getAgent.mockReturnValue(undefined);

      const response = await request(app)
        .delete('/api/agents/unknown')
        .expect(404);

      expect(response.body.error).toMatch(/not found/i);
    });
  });
});
