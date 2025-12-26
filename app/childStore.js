import { legacy_createStore as createStore, applyMiddleware, combineReducers, compose } from 'redux';
import { routerMiddleware, routerReducer as routing, push, replace } from 'react-router-redux';
import thunk from 'redux-thunk';
import { stateSyncEnhancer } from 'electron-redux/renderer'

import reducers from './reducers';

import actionCreators from './actions';

export default function configureStore(routerHistory) {
    const router = routerHistory && routerMiddleware(routerHistory);

    // CRITICAL NULL GUARD: Prevent destructuring crash if actionCreators is null/undefined
    const allActionCreators = {
        ...(actionCreators || {}),
        push
    };

    const middlewares = [
        thunk
    ];

    if (router) {
        middlewares.push(router);
    }

    const composeEnhancers = (() => {
        const compose_ = window && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
        if (process.env.NODE_ENV === 'development' && compose_) {
            return compose_({ allActionCreators });
        }
        return compose;
    })();

    // CRITICAL NULL GUARD: Prevent destructuring crash if reducers is null/undefined
    const rootReducer = combineReducers({
        ...(reducers || {}),
        routing
    });
    // electron-redux v2 handles initial state automatically via IPC
    const initialState = {};

    // CRITICAL NULL GUARD: Ensure stateSyncEnhancer doesn't return null/undefined
    const syncEnhancer = stateSyncEnhancer();
    const enhancers = composeEnhancers(
        applyMiddleware(...middlewares),
        ...(syncEnhancer ? [syncEnhancer] : [])
    );

    const store = createStore(rootReducer, initialState, enhancers);

    // Debug: Track pluginLibrary state changes
    store.subscribe(() => {
        const state = store.getState();
        if (state.pluginLibrary !== undefined) {
            const keys = Object.keys(state.pluginLibrary || {});
            console.log('[ChildStore] pluginLibrary updated, keys:', keys.length);
            if (keys.length > 0) {
                console.log('[ChildStore] Sample keys:', keys.slice(0, 3));
            }
        }
    });

    // Subscribe to store changes to detect login
    let lastLoginState = false;
    store.subscribe(() => {
        const state = store.getState();
        const isLoggedIn = !!(state.user && state.user.user && state.user.user.id);

        // Only dispatch if login state changed from false to true
        if (isLoggedIn && !lastLoginState) {
            console.log('Login detected, redirecting to /loggedin');
            console.log('Current routing state:', state.routing);

            // Use both Redux action and direct history for compatibility
            setTimeout(() => {
                console.log('Dispatching Redux push action');
                store.dispatch(push('/loggedin'));

                // Also update history directly as fallback
                if (routerHistory) {
                    console.log('Also pushing to history directly');
                    routerHistory.push('/loggedin');
                }
            }, 100);
        }
        lastLoginState = isLoggedIn;
    });

    // CRITICAL FIX: Bypass broken electron-redux v2 with direct IPC
    // Listen for plugin library sync from main process
    const electron = require('electron');
    const ipcRenderer = electron.ipcRenderer;

    if (ipcRenderer) {
        ipcRenderer.on('PLUGIN_LIBRARY_SYNC', (event, action) => {
        console.log('[IPC Handler] Received PLUGIN_LIBRARY_SYNC');
        console.log('[IPC Handler] Action type:', action.type);
        console.log('[IPC Handler] Payload keys:', action.payload ? Object.keys(action.payload).length : 'null');

        if (action.type === 'LIBRARY_REPLACE' && action.payload) {
            console.log('[IPC Handler] Dispatching to renderer store...');
            const libraryReplaceAction = actionCreators.libraryReplace(action.payload);
            store.dispatch(libraryReplaceAction);
            console.log('[IPC Handler] Dispatch complete');
        }
        });
    } else {
        console.warn('[ChildStore] ipcRenderer not available - PLUGIN_LIBRARY_SYNC will not work');
    }

    //console.log('client state:', store.getState());

    return store;
}
