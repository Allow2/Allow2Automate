import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({

    [actions.installedPluginReplace]: (state, action) => {
        return action.payload;
    }

}, {});
