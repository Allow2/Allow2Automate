import { handleActions } from 'redux-actions';
import pairing from '../actions';

export default handleActions({
    [pairing.pairingUpdate]: (state, action) => {
        return { ...state, ...action.payload };
    },

    [pairing.pairingRemove]: (state, action) => {
        var newState = Object.assign({}, state);
        delete newState[action.payload];
        return newState;
    }

}, {});
