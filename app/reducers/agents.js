import { handleActions } from 'redux-actions';
import {
  AGENT_LIST_REQUEST,
  AGENT_LIST_SUCCESS,
  AGENT_LIST_FAILURE,
  AGENT_REGISTER,
  AGENT_DELETE,
  AGENT_UPDATE,
  AGENT_POLICY_CREATE,
  AGENT_POLICY_UPDATE,
  AGENT_POLICY_DELETE,
  AGENT_VIOLATION_RECEIVED,
  AGENT_HEARTBEAT_UPDATE,
  AGENT_REGISTRATION_CODE_GENERATE
} from '../actions/agent';

const initialState = {
  agents: {},
  policies: {},
  violations: [],
  registrationCodes: {},
  loading: false,
  error: null,
  lastUpdated: null
};

const agentsReducer = handleActions(
  {
    // List agents
    [AGENT_LIST_REQUEST]: (state) => ({
      ...state,
      loading: true,
      error: null
    }),

    [AGENT_LIST_SUCCESS]: (state, action) => {
      const agentsMap = {};
      action.payload.forEach(agent => {
        agentsMap[agent.id] = agent;
      });

      return {
        ...state,
        agents: agentsMap,
        loading: false,
        lastUpdated: Date.now()
      };
    },

    [AGENT_LIST_FAILURE]: (state, action) => ({
      ...state,
      loading: false,
      error: action.payload
    }),

    // Register agent
    [AGENT_REGISTER]: (state, action) => {
      const agent = action.payload;
      return {
        ...state,
        agents: {
          ...state.agents,
          [agent.id]: agent
        }
      };
    },

    // Delete agent
    [AGENT_DELETE]: (state, action) => {
      const { agentId } = action.payload;
      const { [agentId]: removed, ...remainingAgents } = state.agents;

      // Also remove policies for this agent
      const remainingPolicies = Object.fromEntries(
        Object.entries(state.policies).filter(([key, policy]) => policy.agentId !== agentId)
      );

      return {
        ...state,
        agents: remainingAgents,
        policies: remainingPolicies
      };
    },

    // Update agent
    [AGENT_UPDATE]: (state, action) => {
      const { agentId, updates } = action.payload;
      return {
        ...state,
        agents: {
          ...state.agents,
          [agentId]: {
            ...state.agents[agentId],
            ...updates
          }
        }
      };
    },

    // Create policy
    [AGENT_POLICY_CREATE]: (state, action) => {
      const { agentId, policyConfig } = action.payload;
      const policyId = `policy-${Date.now()}`;

      return {
        ...state,
        policies: {
          ...state.policies,
          [policyId]: {
            id: policyId,
            agentId,
            ...policyConfig
          }
        }
      };
    },

    // Update policy
    [AGENT_POLICY_UPDATE]: (state, action) => {
      const { policyId, updates } = action.payload;
      return {
        ...state,
        policies: {
          ...state.policies,
          [policyId]: {
            ...state.policies[policyId],
            ...updates
          }
        }
      };
    },

    // Delete policy
    [AGENT_POLICY_DELETE]: (state, action) => {
      const { policyId } = action.payload;
      const { [policyId]: removed, ...remainingPolicies } = state.policies;

      return {
        ...state,
        policies: remainingPolicies
      };
    },

    // Handle violation
    [AGENT_VIOLATION_RECEIVED]: (state, action) => {
      const violation = {
        ...action.payload,
        timestamp: Date.now()
      };

      return {
        ...state,
        violations: [violation, ...state.violations].slice(0, 100) // Keep last 100 violations
      };
    },

    // Update heartbeat
    [AGENT_HEARTBEAT_UPDATE]: (state, action) => {
      const { agentId, metadata } = action.payload;
      return {
        ...state,
        agents: {
          ...state.agents,
          [agentId]: {
            ...state.agents[agentId],
            lastHeartbeat: Date.now(),
            ...metadata
          }
        }
      };
    },

    // Generate registration code
    [AGENT_REGISTRATION_CODE_GENERATE]: (state, action) => {
      const { childId, code } = action.payload;
      return {
        ...state,
        registrationCodes: {
          ...state.registrationCodes,
          [code]: {
            childId,
            code,
            used: false,
            expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
          }
        }
      };
    }
  },
  initialState
);

export default agentsReducer;
