import { handleActions } from 'redux-actions';
import actions from '../actions';
import moment from 'moment';

export default handleActions({
    [actions.login]: (state, action) => {
        console.log('[User Reducer] LOGIN action received');
        console.log('[User Reducer] Previous state:', state);
        console.log('[User Reducer] Payload:', action.payload);

        // map token expiry to a timestamp
        if (action.payload.expires_in) {
            action.payload.expires = moment().add(action.payload.expires_in, 'seconds').valueOf();
            delete action.payload.expires_in;
        }

        const newState = { ...state, ...action.payload };
        console.log('[User Reducer] New state after login:', newState);
        console.log('[User Reducer] User ID:', newState.user && newState.user.id);

        return newState;
    },

    [actions.newData]: (state, action) => {
        let user = action.payload.user;
        if (!user) {
            return { ...state };
        }

        let newState = Object.assign({}, state, {
            user: user
        });

        console.log('[User Reducer] NEW_DATA action - updated user data');
        return newState;
    },

    [actions.logout]: (state, action) => {
        console.log('[User Reducer] LOGOUT action - clearing user state');
        return {};
    }
}, {});
