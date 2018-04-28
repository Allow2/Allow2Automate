import { createAction } from 'redux-actions';

export default {
    deviceUpdate: createAction('DEVICE_UPDATE'),
    devicePaired: createAction('DEVICE_PAIRED'),
    deviceActive: createAction('DEVICE_SETACTIVE'),
    deviceInit: createAction('DEVICE_INIT')
};
