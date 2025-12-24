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

const localStorageKey = 'Allow2Automate';

export default function configureStore() {

    console.log('parent state init', stateSyncEnhancer, stateSyncEnhancer(), createStore);

    const middlewares = [
        thunk
    ];

    const localStorage = new LocalStorage('./store');

    const rootReducer = combineReducers(reducers);
    const initialState = JSON.parse(localStorage.getItem(localStorageKey) || '{}');
    initialState.children = {};

    // Custom serializer to handle non-serializable objects in state
    const stateSerializer = (key, value) => {
        // Skip EventEmitter and other non-serializable objects
        if (value && typeof value === 'object') {
            // Check if it's an EventEmitter (has common EventEmitter methods)
            if (typeof value.on === 'function' && typeof value.emit === 'function') {
                return '[EventEmitter]';
            }
            // Check for circular references or other problematic objects
            if (value.constructor && value.constructor.name === 'EventEmitter') {
                return '[EventEmitter]';
            }
        }
        return value;
    };

    const enhancers = compose(
        applyMiddleware(...middlewares),
        stateSyncEnhancer({ serializer: stateSerializer })
    );

    const store = createStore(rootReducer, initialState, enhancers);

    //replayActionMain(store);

    store.save = function() {
        //const stateForPersistence = rootReducer(store, { type: PERSISTING });
        localStorage.setItem(localStorageKey, JSON.stringify(store.getState()));
    };

    return store;
}
