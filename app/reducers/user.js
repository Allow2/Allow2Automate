import { handleActions } from 'redux-actions';
import actions from '../actions/user';
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
    [actions.logout]: (state, action) => {
        return {};
    }
}, {});
