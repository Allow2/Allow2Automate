import { handleActions } from 'redux-actions';
import actions from '../actions/device';

export default handleActions({
    [actions.update]: (state, action) => {
        return { ...state, ...action.payload };
    },

    [actions.setActive]: (state, action) => {
        let newState = Object.assign({}, state);
        var device = newState[action.payload.UDN];
        if (device) {
            device.active = action.payload.active;
            newState[action.payload.UDN] = device;
        }
        return newState;
    },

    [actions.paired]: (state, action) => {
        //let newState = Object.assign({}, state);
        //for (var grant of action.result) {
        //    let key = 'user_' + grant.grantee.id;
        //    newState[key] = uuidv4();
        //}
        //return newState;
        return { ...state }; //, ...action.payload };
    }
}, {});
