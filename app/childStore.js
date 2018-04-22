import { createStore, applyMiddleware, combineReducers, compose } from 'redux';
import { routerMiddleware, routerReducer as routing, push, replace } from 'react-router-redux';
import thunk from 'redux-thunk';
import {
    forwardToMain,
    replayActionRenderer,               // nb: https://www.npmjs.com/package/electron-redux
    getInitialStateRenderer
    } from 'electron-redux';

import user from './reducers/user';
import devices from './reducers/devices';
import pairings from './reducers/pairings';

import userActions from './actions/user';
import deviceActions from './actions/device';
import pairingActions from './actions/pairing';

export default function configureStore(routerHistory) {
    const router = routerHistory && routerMiddleware(routerHistory);

    const actionCreators = {
        ...userActions,
        ...deviceActions,
        ...pairingActions,
        push
    };

    const reducers = {
        user,
        devices,
        pairings,
        routing
    };

    const middlewares = [
        forwardToMain, // IMPORTANT! This goes first
        thunk
    ];

    if (router) {
        middlewares.push(router);
    }

    //const composeEnhancers = (() => {
    //    const compose_ = window && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
    //    if (process.env.NODE_ENV === 'development' && compose_) {
    //        return compose_({actionCreators});
    //    }
    //    return compose;
    //})();

    const rootReducer = combineReducers(reducers);
    const initialState = getInitialStateRenderer();

    const store = createStore(rootReducer, initialState, applyMiddleware(...middlewares));

    if (initialState.user && initialState.user.user && initialState.user.user.id) {
        store.dispatch(replace('/loggedin'));
    }
    replayActionRenderer(store);

    console.log('client state:', store.getState());

    return store;
}
