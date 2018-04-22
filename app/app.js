import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { ConnectedRouter } from 'react-router-redux';
import { createMemoryHistory } from 'history';
import routes from './routes';
import configureStore from './childStore';

const syncHistoryWithStore = (store, history) => {
  const { routing } = store.getState();
  if(routing && routing.location) {
    history.replace(routing.location);
  }
};

const routerHistory = createMemoryHistory();
const store = configureStore(routerHistory);
syncHistoryWithStore(store, routerHistory);

const rootElement = document.querySelector(document.currentScript.getAttribute('data-container'));

ReactDOM.render(
    <Provider store={store}>
        <ConnectedRouter history={routerHistory}>
            {routes}
        </ConnectedRouter>
    </Provider>,
    rootElement
);
