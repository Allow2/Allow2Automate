import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { ConnectedRouter } from 'react-router-redux';
import { createMemoryHistory } from 'history';
import routes from './routes';
import configureStore from './childStore';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'

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
    <MuiThemeProvider>
        <Provider store={store}>
            <ConnectedRouter history={routerHistory}>
                {routes}
            </ConnectedRouter>
        </Provider>
    </MuiThemeProvider>,
    rootElement
);

if (module.hot) {
    module.hot.accept('./containers/Root', () => {
        const NextRoot = require('./containers/Root');
        render(
            <MuiThemeProvider>
                <Provider store={store}>
                    <ConnectedRouter history={routerHistory}>
                        {routes}
                    </ConnectedRouter>
                </Provider>
            </MuiThemeProvider>,
            rootElement
        );
    });
}