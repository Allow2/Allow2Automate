import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({

    [actions.installedPluginReplace]: (state, action) => {
        console.log('[InstalledPlugins Reducer] REPLACE action received');
        console.log('[InstalledPlugins Reducer] Previous state:', Object.keys(state || {}).length, 'plugins');
        console.log('[InstalledPlugins Reducer] New payload:', Object.keys(action.payload || {}).length, 'plugins');
        if (action.payload && Object.keys(action.payload).length > 0) {
            console.log('[InstalledPlugins Reducer] Plugin names:', Object.keys(action.payload));
        }
        return action.payload;
    },

    [actions.installedPluginUpdate]: (state, action) => {
        return { ...state, ...action.payload };
    },

    [actions.installedPluginRemove]: (state, action) => {
        var newState = Object.assign({}, state);
        delete newState[action.payload.pluginName];
        console.log(action, state, newState);
        return newState;
    },

    [actions.setPluginEnabled]: (state, action) => {
        //console.log(action, state);
        const plugin = Object.assign({}, state[action.payload.pluginName], {
            disabled : !action.payload.isChecked
        });
        const newState = Object.assign({}, state, {
            [action.payload.pluginName] : plugin
        });
        //console.log(action.payload.pluginName, plugin, newState);
        return newState;
    }

}, {});
