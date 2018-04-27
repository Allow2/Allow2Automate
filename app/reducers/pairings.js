import { handleActions } from 'redux-actions';
import pairing from '../actions';

export default handleActions({
    [pairing.pairingUpdate]: (state, action) => {
        return { ...state, ...action.payload };
    }

}, {});
