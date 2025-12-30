/**
 * Mock service utilities for testing
 */

export function createMockAgentService(overrides = {}) {
  return {
    agents: new Map(),
    getAllAgents: jest.fn(() => []),
    getAgent: jest.fn(),
    registerAgent: jest.fn(),
    updateAgentStatus: jest.fn(),
    updatePolicies: jest.fn().mockResolvedValue(),
    getViolations: jest.fn().mockResolvedValue([]),
    removeAgent: jest.fn(),
    cleanupStaleAgents: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
    ...overrides
  };
}

export function createMockAgentDiscovery(overrides = {}) {
  return {
    discoveredAgents: new Map(),
    start: jest.fn(),
    stop: jest.fn(),
    getDiscoveredAgents: jest.fn(() => []),
    cleanupStaleAgents: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
    ...overrides
  };
}

export function createMockAgentConnection(overrides = {}) {
  return {
    connect: jest.fn().mockResolvedValue('http://192.168.1.100:8443'),
    testConnection: jest.fn().mockResolvedValue(true),
    getCachedConnection: jest.fn(),
    setCachedConnection: jest.fn(),
    ...overrides
  };
}

export function createMockDatabase(overrides = {}) {
  const mockStatements = new Map();

  return {
    prepare: jest.fn((sql) => {
      if (!mockStatements.has(sql)) {
        mockStatements.set(sql, {
          run: jest.fn(),
          get: jest.fn(),
          all: jest.fn(() => [])
        });
      }
      return mockStatements.get(sql);
    }),
    close: jest.fn(),
    exec: jest.fn(),
    ...overrides
  };
}
