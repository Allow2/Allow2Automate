import { handleActions } from 'redux-actions';
import actions from '../actions/device';

export default handleActions({
    [actions.update]: (state, action) => {
        return { ...state, ...action.payload };
    },

    [actions.paired]: (state, action) => {
        return { ...state }; //, ...action.payload };
    }
}, {});
