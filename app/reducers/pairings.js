import { handleActions } from 'redux-actions';
import pairing from '../actions';

export default handleActions({
    [pairing.pairUpdate]: (state, action) => {
        return { ...state, ...action.payload };
    }
}, {});
