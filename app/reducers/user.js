import { handleActions } from 'redux-actions';
import actions from '../actions';
import moment from 'moment';

export default handleActions({
    [actions.login]: (state, action) => {
        // map token expiry to a timestamp
        if (action.payload.expires_in) {
            action.payload.expires = moment().add(action.payload.expires_in, 'seconds').valueOf();
            delete action.payload.expires_in;
        }
        return { ...state, ...action.payload };
    },

    [actions.newData]: (state, action) => {
        let user = action.payload.user;
        if (!user) {
            return { ...state };
        }

        let newState = Object.assign({}, state, {
            user: user
        });

        return newState;
    },

    [actions.logout]: (state, action) => {
        return {};
    }
}, {});
