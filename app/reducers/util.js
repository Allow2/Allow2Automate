import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({
    [actions.timezoneGuess]: (state, action) => {
        return {
            ...state,
            timezoneGuess: action.payload
        };
    }

}, {});
