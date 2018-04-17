import { handleActions } from 'redux-actions';
import pairing from '../actions/pairing';

export default handleActions({
    [pairing.update]: (state, action) => {
        return { ...state, ...action.payload };
    }
}, {});
