import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({

    [actions.installedPluginReplace]: (state, action) => {
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
        var newState = Object.assign({}, state);
        var plugin = newState[action.payload.pluginName];
        plugin.disabled = !action.payload.isChecked;
        newState[action.payload.pluginName] = plugin;
        return newState;
    }

}, {});
