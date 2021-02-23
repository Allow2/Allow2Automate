import { createStore, applyMiddleware, combineReducers, compose } from 'redux';
import { routerMiddleware, routerReducer as routing, push, replace } from 'react-router-redux';
import thunk from 'redux-thunk';
import {
    forwardToMain,
    replayActionRenderer,               // nb: https://www.npmjs.com/package/electron-redux
    getInitialStateRenderer
    } from 'electron-redux';

import reducers from './reducers';

import actionCreators from './actions';

export default function configureStore(routerHistory) {
    const router = routerHistory && routerMiddleware(routerHistory);

    const allActionCreators = {
        ...actionCreators,
        push
    };

    const middlewares = [
        forwardToMain, // IMPORTANT! This goes first
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

    const rootReducer = combineReducers(reducers);
    const initialState = getInitialStateRenderer();

    const store = createStore(rootReducer, initialState, composeEnhancers(applyMiddleware(...middlewares)));

    if (initialState.user && initialState.user.user && initialState.user.user.id) {
        store.dispatch(replace('/loggedin'));
    }
    replayActionRenderer(store);

    //console.log('client state:', store.getState());

    return store;
}
