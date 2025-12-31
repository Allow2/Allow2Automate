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
export const fetchAgents = () => async (dispatch, getState, { ipcRenderer }) => {
  dispatch(agentListRequest());
  try {
    const result = await ipcRenderer.invoke('agents:list');
    if (result.success) {
      dispatch(agentListSuccess(result.agents));
    } else {
      dispatch(agentListFailure(result.error || 'Failed to fetch agents'));
    }
  } catch (error) {
    dispatch(agentListFailure(error.message));
  }
};

export const createPolicy = (agentId, policyConfig) => async (dispatch, getState, { ipcRenderer }) => {
  try {
    const result = await ipcRenderer.invoke('agents:create-policy', { agentId, policyConfig });
    if (result.success) {
      dispatch(agentPolicyCreate({ agentId, policyConfig: { ...policyConfig, id: result.policyId } }));
    }
    return result;
  } catch (error) {
    console.error('Error creating policy:', error);
    throw error;
  }
};

export const updatePolicy = (agentId, policyId, updates) => async (dispatch, getState, { ipcRenderer }) => {
  try {
    const result = await ipcRenderer.invoke('agents:update-policy', { agentId, policyId, updates });
    if (result.success) {
      dispatch(agentPolicyUpdate({ agentId, policyId, updates }));
    }
    return result;
  } catch (error) {
    console.error('Error updating policy:', error);
    throw error;
  }
};

export const deletePolicy = (agentId, policyId) => async (dispatch, getState, { ipcRenderer }) => {
  try {
    const result = await ipcRenderer.invoke('agents:delete-policy', { agentId, policyId });
    if (result.success) {
      dispatch(agentPolicyDelete({ agentId, policyId }));
    }
    return result;
  } catch (error) {
    console.error('Error deleting policy:', error);
    throw error;
  }
};

export const handleViolation = (violationData) => (dispatch) => {
  dispatch(agentViolationReceived(violationData));
};

export const updateHeartbeat = (agentId, metadata) => (dispatch) => {
  dispatch(agentHeartbeatUpdate({ agentId, metadata }));
};

export const generateRegistrationCode = (childId) => async (dispatch, getState, { ipcRenderer }) => {
  try {
    const result = await ipcRenderer.invoke('agents:generate-code', { childId });
    if (result.success) {
      dispatch(agentRegistrationCodeGenerate({ childId, code: result.code }));
      return result.code;
    }
    throw new Error(result.error || 'Failed to generate code');
  } catch (error) {
    console.error('Error generating registration code:', error);
    throw error;
  }
};
