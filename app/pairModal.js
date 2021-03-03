import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createMemoryHistory } from 'history';
import configureStore from './childStore';
import PairModalPage from './containers/PairModalPage.js';
import { ThemeProvider as MuiThemeProvider } from '@material-ui/core/styles';

const store = configureStore(null);

const rootElement = document.querySelector(document.currentScript.getAttribute('data-container'));

ReactDOM.render(
    <MuiThemeProvider>
        <Provider store={store}>
            <PairModalPage />
        </Provider>
    </MuiThemeProvider>,
    rootElement
);

