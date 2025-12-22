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
        thunk,
	    stateSyncEnhancer() // IMPORTANT! This goes last
    ];

    const localStorage = new LocalStorage('./store');

    const rootReducer = combineReducers(reducers);
    const initialState = JSON.parse(localStorage.getItem(localStorageKey) || '{}');
    initialState.children = {};
    const store = createStore(rootReducer, initialState, applyMiddleware(...middlewares));

    //replayActionMain(store);

    store.save = function() {
        //const stateForPersistence = rootReducer(store, { type: PERSISTING });
        localStorage.setItem(localStorageKey, JSON.stringify(store.getState()));
    };

    return store;
}
