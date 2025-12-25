import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({
    [actions.pluginStatusUpdate]: (state, action) => {
        const { pluginName, statusData } = action.payload;
        return {
            ...state,
            [pluginName]: {
                ...statusData,
                timestamp: statusData.timestamp || Date.now()
            }
        };
    },

    [actions.pluginStatusClear]: (state, action) => {
        const { pluginName } = action.payload;
        const newState = { ...state };
        delete newState[pluginName];
        return newState;
    },

    [actions.pluginStatusInit]: (state, action) => {
        return { ...action.payload };
    },

    // Clear status when plugin is uninstalled
    [actions.installedPluginRemove]: (state, action) => {
        const pluginName = action.payload.pluginName;
        const newState = { ...state };
        delete newState[pluginName];
        return newState;
    }
}, {});
