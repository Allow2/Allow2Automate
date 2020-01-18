import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({
    [actions.pluginUpdate]: (state, action) => {
        return { ...state, ...action.payload };
    },

}, {});
