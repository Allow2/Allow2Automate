import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({

    [actions.libraryReplace]: (state, action) => {
        // Ensure we're returning a new object reference
        const newState = { ...action.payload };
        return newState;
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
