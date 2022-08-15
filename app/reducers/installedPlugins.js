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
        const plugin = Object.assign({}, state[action.payload.pluginName], {
            disabled : !action.payload.isChecked
        });
        const newState = Object.assign({}, state, {
            [action.payload.pluginName] : plugin
        });
        console.log(action.payload.pluginName, plugin, newState);
        return newState;
    }

}, {});
