import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({

    [actions.libraryReplace]: (state, action) => {
        return action.payload;
    },

    [actions.libraryUpdate]: (state, action) => {
        return { ...state, ...action.payload };
    },

    [actions.libraryRemove]: (state, action) => {
        var newState = Object.assign({}, state);
        delete newState[action.payload];
        return newState;
    }

}, {});
