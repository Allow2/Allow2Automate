import { createStore, applyMiddleware, combineReducers, compose } from 'redux';
import { replace } from 'react-router-redux';
import thunk from 'redux-thunk';
import {
    forwardToRenderer,
    triggerAlias,               // nb: https://www.npmjs.com/package/electron-redux
    replayActionMain,
    } from 'electron-redux';
import reducers from './reducers';

var LocalStorage = require('node-localstorage').LocalStorage;

const localStorageKey = 'Allow2Automate';

export default function configureStore() {

    console.log('parent state init');

    const middlewares = [
        thunk,
        forwardToRenderer // IMPORTANT! This goes last
    ];

    const localStorage = new LocalStorage('./store');

    const rootReducer = combineReducers(reducers);
    const initialState = JSON.parse(localStorage.getItem(localStorageKey) || '{}');
    const store = createStore(rootReducer, initialState, applyMiddleware(...middlewares));

    replayActionMain(store);

    store.save = function() {
        //const stateForPersistence = rootReducer(store, { type: PERSISTING });
        localStorage.setItem(localStorageKey, JSON.stringify(store.getState()));
    };

    return store;
}
