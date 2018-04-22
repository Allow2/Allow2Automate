import { createStore, applyMiddleware, combineReducers, compose } from 'redux';
import { replace } from 'react-router-redux';

var LocalStorage = require('node-localstorage').LocalStorage;

import thunk from 'redux-thunk';

import {
    forwardToRenderer,
    triggerAlias,               // nb: https://www.npmjs.com/package/electron-redux
    replayActionMain,
    } from 'electron-redux';

import user from './reducers/user';
import devices from './reducers/devices';
import pairings from './reducers/pairings';

import userActions from './actions/user';
import deviceActions from './actions/device';
import pairingActions from './actions/pairing';

const localStorageKey = 'Allow2Automate';

export default function configureStore() {

    console.log('parent state init');

    const actionCreators = {
        ...userActions,
        ...deviceActions,
        ...pairingActions
    };

    const reducers = {
        user,
        devices,
        pairings
    };

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
