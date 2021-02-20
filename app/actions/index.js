import { createAction } from 'redux-actions';

import childActions from './device';
import deviceActions from './device';
import configurationActions from './configuration';
import installedPluginsActions from './installedPlugins';
import pairingActions from './pairing';
import pluginLibraryActions from './pluginLibrary';
import userActions from './user';
import utilActions from './util';

export default {
    ...childActions,
    ...configurationActions,
    ...deviceActions,
    ...installedPluginsActions,
    ...pairingActions,
    ...pluginLibraryActions,
    ...userActions,
    ...utilActions,
    newData: createAction('NEW_DATA')
};