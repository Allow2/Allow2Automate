import { createAction } from 'redux-actions';

// Agent action types
export const AGENT_LIST_REQUEST = 'AGENT_LIST_REQUEST';
export const AGENT_LIST_SUCCESS = 'AGENT_LIST_SUCCESS';
export const AGENT_LIST_FAILURE = 'AGENT_LIST_FAILURE';

export const AGENT_REGISTER = 'AGENT_REGISTER';
export const AGENT_DELETE = 'AGENT_DELETE';
export const AGENT_UPDATE = 'AGENT_UPDATE';

export const AGENT_POLICY_CREATE = 'AGENT_POLICY_CREATE';
export const AGENT_POLICY_UPDATE = 'AGENT_POLICY_UPDATE';
export const AGENT_POLICY_DELETE = 'AGENT_POLICY_DELETE';

export const AGENT_VIOLATION_RECEIVED = 'AGENT_VIOLATION_RECEIVED';
export const AGENT_HEARTBEAT_UPDATE = 'AGENT_HEARTBEAT_UPDATE';

export const AGENT_REGISTRATION_CODE_GENERATE = 'AGENT_REGISTRATION_CODE_GENERATE';

// Action creators
export const agentListRequest = createAction(AGENT_LIST_REQUEST);
export const agentListSuccess = createAction(AGENT_LIST_SUCCESS);
export const agentListFailure = createAction(AGENT_LIST_FAILURE);

export const agentRegister = createAction(AGENT_REGISTER);
export const agentDelete = createAction(AGENT_DELETE);
export const agentUpdate = createAction(AGENT_UPDATE);

export const agentPolicyCreate = createAction(AGENT_POLICY_CREATE);
export const agentPolicyUpdate = createAction(AGENT_POLICY_UPDATE);
export const agentPolicyDelete = createAction(AGENT_POLICY_DELETE);

export const agentViolationReceived = createAction(AGENT_VIOLATION_RECEIVED);
export const agentHeartbeatUpdate = createAction(AGENT_HEARTBEAT_UPDATE);

export const agentRegistrationCodeGenerate = createAction(AGENT_REGISTRATION_CODE_GENERATE);

// Thunk actions for async operations
export const fetchAgents = () => async (dispatch) => {
  dispatch(agentListRequest());
  try {
    // This would call the IPC handler to get agents
    // For now, it's a placeholder
    const agents = []; // await ipcRenderer.invoke('agents:list');
    dispatch(agentListSuccess(agents));
  } catch (error) {
    dispatch(agentListFailure(error.message));
  }
};

export const createPolicy = (agentId, policyConfig) => (dispatch) => {
  dispatch(agentPolicyCreate({ agentId, policyConfig }));
};

export const updatePolicy = (agentId, policyId, updates) => (dispatch) => {
  dispatch(agentPolicyUpdate({ agentId, policyId, updates }));
};

export const deletePolicy = (agentId, policyId) => (dispatch) => {
  dispatch(agentPolicyDelete({ agentId, policyId }));
};

export const handleViolation = (violationData) => (dispatch) => {
  dispatch(agentViolationReceived(violationData));
};

export const updateHeartbeat = (agentId, metadata) => (dispatch) => {
  dispatch(agentHeartbeatUpdate({ agentId, metadata }));
};

export const generateRegistrationCode = (childId) => (dispatch) => {
  dispatch(agentRegistrationCodeGenerate({ childId }));
};
