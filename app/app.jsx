import React from 'react';
import { Provider } from 'react-redux';
import { ConnectedRouter } from 'react-router-redux';
import { createMemoryHistory } from 'history';
import routes from './routes';
import configureStore from './store';

const syncHistoryWithStore = (store, history) => {
  const { routing } = store.getState();
  if(routing && routing.location) {
    history.replace(routing.location);
  }
};

const initialState = {};
const routerHistory = createMemoryHistory();
const store = configureStore(initialState, routerHistory);
syncHistoryWithStore(store, routerHistory);

export default class App extends React.Component {
  render() {
    return (<Provider store={store}>
      <ConnectedRouter history={routerHistory}>
        {routes}
      </ConnectedRouter>
    </Provider>);
  }
}
