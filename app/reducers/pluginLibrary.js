import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({

    [actions.libraryReplace]: (state, action) => {
        console.log('[Reducer] LIBRARY_REPLACE action fired');
        console.log('[Reducer] Previous state:', state);
        console.log('[Reducer] Previous state keys:', state ? Object.keys(state).length : 'null');
        console.log('[Reducer] New payload:', action.payload);
        console.log('[Reducer] Payload keys:', action.payload ? Object.keys(action.payload).length : 'null');
        console.log('[Reducer] Payload sample:', action.payload ? Object.keys(action.payload).slice(0, 3) : 'null');

        // Ensure we're returning a new object reference
        const newState = { ...action.payload };
        console.log('[Reducer] Returning newState with keys:', Object.keys(newState).length);
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
