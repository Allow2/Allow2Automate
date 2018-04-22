import { createAction } from 'redux-actions';

import childActions from './device';
import deviceActions from './device';
import pairingActions from './pairing';
import userActions from './user';

export default {
    ...childActions,
    ...deviceActions,
    ...pairingActions,
    ...userActions,
    newData: createAction('NEW_DATA')
};