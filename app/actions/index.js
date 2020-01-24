import { createAction } from 'redux-actions';

import childActions from './device';
import deviceActions from './device';
import configurationActions from './configuration';
import pairingActions from './pairing';
import pluginActions from './plugin';
import userActions from './user';
import utilActions from './util';

export default {
    ...childActions,
    ...configurationActions,
    ...deviceActions,
    ...pairingActions,
    ...pluginActions,
    ...userActions,
    ...utilActions,
    newData: createAction('NEW_DATA')
};