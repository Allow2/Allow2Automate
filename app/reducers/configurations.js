import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({
    [actions.configurationUpdate]: (state, action) => {
        return { ...state, ...action.payload };
    },

}, {});
