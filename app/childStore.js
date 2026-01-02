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

    // Wrap each reducer to handle HYDRATE action from electron-redux bridge
    const hydrateableReducers = {};
    Object.keys(reducers || {}).forEach(key => {
        const originalReducer = reducers[key];
        hydrateableReducers[key] = (state, action) => {
            // Handle HYDRATE action to sync initial state from main process
            if (action.type === '@@ELECTRON_REDUX/HYDRATE' && action.payload) {
                // Return the hydrated state for this reducer slice
                return action.payload[key] || state;
            }
            // Otherwise use original reducer
            return originalReducer(state, action);
        };
    });

    // CRITICAL NULL GUARD: Prevent destructuring crash if reducers is null/undefined
    const rootReducer = combineReducers({
        ...hydrateableReducers,
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

    // Helper function to redirect to logged-in page
    const redirectToLoggedIn = () => {
        console.log('[Auto-Login] Redirecting to /loggedin');

        // Use both Redux action and direct history for compatibility
        setTimeout(() => {
            store.dispatch(push('/loggedin'));

            // Also update history directly as fallback
            if (routerHistory) {
                routerHistory.push('/loggedin');
            }
        }, 100);
    };

    store.subscribe(() => {
        const state = store.getState();
        const isLoggedIn = !!(state.user && state.user.user && state.user.user.id);

        // Only dispatch if login state changed from false to true
        if (isLoggedIn && !lastLoginState) {
            console.log('[Auto-Login] Login state change detected (false -> true)');
            console.log('[Auto-Login] User:', state.user.user);
            redirectToLoggedIn();
        }
        lastLoginState = isLoggedIn;
    });

    // CRITICAL FIX: Check for existing login on app startup
    // This handles the case where user was already logged in from persisted state
    // Wait longer for async initial state sync from main process via bridge
    setTimeout(() => {
        const initialState = store.getState();
        const isLoggedIn = !!(initialState.user && initialState.user.user && initialState.user.user.id);

        if (isLoggedIn) {
            console.log('[Auto-Login] Initial check: User already logged in from persisted state');
            console.log('[Auto-Login] User ID:', initialState.user.user.id);
            console.log('[Auto-Login] User Name:', initialState.user.user.firstName, initialState.user.user.lastName);

            const currentPath = (initialState.routing && initialState.routing.location && initialState.routing.location.pathname) || '/';
            console.log('[Auto-Login] Current route:', currentPath);

            // Only redirect if we're on the login page
            if (currentPath === '/') {
                redirectToLoggedIn();
            } else {
                console.log('[Auto-Login] Already on correct route, skipping redirect');
            }
        } else {
            console.log('[Auto-Login] Initial check: No persisted login found');
            console.log('[Auto-Login] Current state keys:', Object.keys(initialState));
            console.log('[Auto-Login] User state:', JSON.stringify(initialState.user));
            if (initialState.user) {
                console.log('[Auto-Login] User state keys:', Object.keys(initialState.user));
                console.log('[Auto-Login] user.user:', initialState.user.user);
                console.log('[Auto-Login] user.user type:', typeof initialState.user.user);
            }
        }

        lastLoginState = isLoggedIn;
    }, 500); // Increased timeout to allow async initial state sync from main

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
