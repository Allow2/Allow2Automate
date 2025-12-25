import { legacy_createStore as createStore, applyMiddleware, combineReducers, compose } from 'redux';
import { replace } from 'react-router-redux';
import thunk from 'redux-thunk';
import { stateSyncEnhancer } from 'electron-redux/main'
// import {
//     forwardToRenderer,
//     triggerAlias,               // nb: https://www.npmjs.com/package/electron-redux
//     replayActionMain,
//     } from 'electron-redux';
import reducers from './reducers';
import { LocalStorage } from "node-localstorage";
import actions from './actions';

const localStorageKey = 'Allow2Automate';

export default function configureStore() {

    console.log('parent state init', stateSyncEnhancer, stateSyncEnhancer(), createStore);

    // Middleware to strip non-serializable data from actions BEFORE electron-redux forwards them
    // This is critical because electron-redux v2 does NOT use the serializer for action payloads,
    // only for initial state sync. Actions are forwarded via IPC which requires structuredClone.
    const actionSerializerMiddleware = store => next => action => {
        // Only process LIBRARY_REPLACE action
        if (action.type === actions.libraryReplace.toString()) {
            console.log('[ActionSerializer] Processing LIBRARY_REPLACE action');
            console.log('[ActionSerializer] Action type:', action.type);
            console.log('[ActionSerializer] Original payload keys:', action.payload ? Object.keys(action.payload).length : 'null');

            // Clone the payload and strip non-serializable properties from each plugin
            const cleanPayload = {};
            if (action.payload && typeof action.payload === 'object') {
                Object.keys(action.payload).forEach(key => {
                    const plugin = action.payload[key];
                    // Skip metadata properties
                    if (key.startsWith('_')) {
                        console.log('[ActionSerializer] Skipping metadata key:', key);
                        return;
                    }
                    if (plugin && typeof plugin === 'object') {
                        // Create a clean copy without non-serializable properties
                        cleanPayload[key] = {
                            name: plugin.name,
                            shortName: plugin.shortName,
                            publisher: plugin.publisher,
                            releases: plugin.releases,
                            description: plugin.description,
                            main: plugin.main,
                            repository: plugin.repository,
                            installation: plugin.installation,
                            keywords: plugin.keywords,
                            category: plugin.category,
                            verified: plugin.verified,
                            downloads: plugin.downloads,
                            rating: plugin.rating,
                            compliance: plugin.compliance,
                            // Explicitly exclude any function properties or EventEmitters
                        };
                    }
                });
            }

            console.log('[ActionSerializer] Clean payload keys:', Object.keys(cleanPayload).length);
            console.log('[ActionSerializer] Clean payload sample:', Object.keys(cleanPayload).slice(0, 3));

            // Debug: Log first plugin to see structure
            const firstKey = Object.keys(cleanPayload)[0];
            if (firstKey) {
                console.log('[ActionSerializer] First plugin key:', firstKey);
                console.log('[ActionSerializer] First plugin data keys:', Object.keys(cleanPayload[firstKey]));
            }

            // Test if cleanPayload is structuredClone-able
            try {
                const testClone = structuredClone(cleanPayload);
                console.log('[ActionSerializer] ✅ Payload is structuredClone-safe, cloned keys:', Object.keys(testClone).length);
            } catch (err) {
                console.error('[ActionSerializer] ❌ Payload is NOT structuredClone-safe:', err.message);
            }

            // Create new action with clean payload
            const cleanAction = {
                ...action,
                payload: cleanPayload
            };

            console.log('[ActionSerializer] Forwarding clean action with', Object.keys(cleanPayload).length, 'plugins');
            return next(cleanAction);
        }

        // Pass through all other actions unchanged
        return next(action);
    };

    const middlewares = [
        thunk,
        actionSerializerMiddleware
    ];

    const localStorage = new LocalStorage('./store');

    const rootReducer = combineReducers(reducers);
    const initialState = JSON.parse(localStorage.getItem(localStorageKey) || '{}');
    initialState.children = {};

    console.log('[MainStore] Initial state keys:', Object.keys(initialState));
    console.log('[MainStore] Initial pluginLibrary:', initialState.pluginLibrary ? Object.keys(initialState.pluginLibrary).length : 'undefined');

    // Clean the pluginLibrary in initialState to ensure it's structuredClone-safe
    // This is critical for electron-redux v2's initial state sync to renderer
    if (initialState.pluginLibrary) {
        console.log('[MainStore] Cleaning initialState.pluginLibrary for sync...');
        const cleanedPluginLibrary = {};
        Object.keys(initialState.pluginLibrary).forEach(key => {
            const plugin = initialState.pluginLibrary[key];
            if (plugin && typeof plugin === 'object') {
                cleanedPluginLibrary[key] = {
                    name: plugin.name,
                    shortName: plugin.shortName,
                    publisher: plugin.publisher,
                    releases: plugin.releases,
                    description: plugin.description,
                    main: plugin.main,
                    repository: plugin.repository,
                    installation: plugin.installation,
                    keywords: plugin.keywords,
                    category: plugin.category,
                    verified: plugin.verified,
                    downloads: plugin.downloads,
                    rating: plugin.rating,
                    compliance: plugin.compliance,
                };
            }
        });
        initialState.pluginLibrary = cleanedPluginLibrary;
        console.log('[MainStore] Cleaned pluginLibrary has', Object.keys(cleanedPluginLibrary).length, 'plugins');
    }

    // CRITICAL TEST: Verify entire initialState is structuredClone-safe
    // electron-redux v2 will SILENTLY FAIL if any part of the state is not cloneable
    try {
        const testClone = structuredClone(initialState);
        console.log('[MainStore] ✅ FULL initialState is structuredClone-safe');
        console.log('[MainStore] Cloned state keys:', Object.keys(testClone));
        console.log('[MainStore] Cloned pluginLibrary keys:', testClone.pluginLibrary ? Object.keys(testClone.pluginLibrary).length : 'undefined');
    } catch (err) {
        console.error('[MainStore] ❌ CRITICAL: initialState is NOT structuredClone-safe!');
        console.error('[MainStore] Error:', err.message);
        console.error('[MainStore] This will cause electron-redux sync to FAIL');

        // Try to identify which part of state is problematic
        for (const key of Object.keys(initialState)) {
            try {
                structuredClone(initialState[key]);
                console.log(`[MainStore]   ✅ ${key} is cloneable`);
            } catch (e) {
                console.error(`[MainStore]   ❌ ${key} is NOT cloneable:`, e.message);
            }
        }
    }

    // Note: electron-redux v2's serializer option ONLY applies to initial state sync,
    // NOT to action forwarding. Actions are forwarded via contents.send() which uses
    // Electron's structuredClone serialization. We handle action serialization in
    // the middleware above instead.
    const enhancers = compose(
        applyMiddleware(...middlewares),
        stateSyncEnhancer()
    );

    const store = createStore(rootReducer, initialState, enhancers);

    // Add logging middleware to track all state changes
    store.subscribe(() => {
        const state = store.getState();
        if (state.pluginLibrary !== undefined) {
            const keys = Object.keys(state.pluginLibrary || {});
            console.log('[Store] State updated - pluginLibrary has', keys.length, 'keys');
        }
    });

    //replayActionMain(store);

    store.save = function() {
        //const stateForPersistence = rootReducer(store, { type: PERSISTING });
        localStorage.setItem(localStorageKey, JSON.stringify(store.getState()));
    };

    return store;
}
