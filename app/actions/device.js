import { createAction } from 'redux-actions';

export default {
    update: createAction('DEVICE_UPDATE'),
    paired: createAction('DEVICE_PAIRED'),
    setActive: createAction('DEVICE_SETACTIVE')
};
