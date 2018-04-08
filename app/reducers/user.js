import { handleActions } from 'redux-actions';
import actions from '../actions/user';

export default handleActions({
    [actions.login]: (state, action) => {
        return { ...state, ...action.payload };
    },
    [actions.logout]: (state, action) => {
        let newState = state;
        delete newState.username;
        delete newState.loggedIn;
        return newState;
    }
}, {});