import { handleActions } from 'redux-actions';
import actions from '../actions/user';

export default handleActions({
    [actions.login]: (state, action) => {
        // map token expiry to a timestamp

        return { ...state, ...action.payload };
    },
    [actions.logout]: (state, action) => {
        return {};
    }
}, {});
