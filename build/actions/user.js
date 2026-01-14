'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _reduxActions = require('redux-actions');

exports.default = {
    login: (0, _reduxActions.createAction)('USER_LOGIN'),
    logout: (0, _reduxActions.createAction)('USER_LOGOUT')
};