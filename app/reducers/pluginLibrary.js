import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({

    [actions.libraryReplace]: (state, action) => {
        return action.payload;
    }

}, {});
