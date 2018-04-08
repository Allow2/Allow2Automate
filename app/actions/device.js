import { createAction } from 'redux-actions';

export default {
    login: createAction('DEVICE_LOGIN'),
    logout: createAction('DEVICE_LOGOUT')
};
