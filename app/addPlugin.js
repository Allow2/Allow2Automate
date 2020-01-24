import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createMemoryHistory } from 'history';
import configureStore from './childStore';
import AddPluginPage from './containers/AddPluginPage.js';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'

const store = configureStore(null);

const rootElement = document.querySelector(document.currentScript.getAttribute('data-container'));

ReactDOM.render(
    <MuiThemeProvider>
        <Provider store={store}>
            <AddPluginPage />
        </Provider>
    </MuiThemeProvider>,
    rootElement
);

