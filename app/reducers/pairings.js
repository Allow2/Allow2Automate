import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({
    [actions.pairingUpdate]: (state, action) => {
        return { ...state, ...action.payload };
    },

    [actions.pairingRemove]: (state, action) => {
        var newState = Object.assign({}, state);
        delete newState[action.payload];
        return newState;
    },

    [actions.pairingWipe]: (state, action) => {
        return null;
    }

}, {});
