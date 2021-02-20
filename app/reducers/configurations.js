import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({
    [actions.configurationUpdate]: (state, action) => {
        return { ...state, ...action.payload };
    },

    [actions.installedPluginRemove]: (state, action) => {
        if (!action.payload.removeConfiguration) {
            return state;
        }
        // we've been told to remove any configurations for the named plugin
        var newState = Object.assign({}, state);
        for (var [key, configuration] of Object.entries(state)) {
            console.log(' looking ', key, configuration, configuration.plugin, action.payload.pluginName);
            if (configuration.plugin === action.payload.pluginName) {
                delete newState[key];
            }
        }

        return newState;
    }

}, {});
