import { handleActions } from 'redux-actions';
import actions from '../actions/child';

export default handleActions({
    [actions.update]: (state, action) => {
        return { ...state, ...action.payload };
    }
}, {});
