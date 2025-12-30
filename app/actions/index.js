import { createAction } from 'redux-actions';

import agentActions from './agent';
import childActions from './device';
import deviceActions from './device';
import configurationActions from './configuration';
import installedPluginsActions from './installedPlugins';
import marketplaceActions from './marketplace';
import pairingActions from './pairing';
import pluginLibraryActions from './pluginLibrary';
import pluginStatusActions from './pluginStatus';
import userActions from './user';
import utilActions from './util';

export default {
    ...agentActions,
    ...childActions,
    ...configurationActions,
    ...deviceActions,
    ...installedPluginsActions,
    ...marketplaceActions,
    ...pairingActions,
    ...pluginLibraryActions,
    ...pluginStatusActions,
    ...userActions,
    ...utilActions,
    newData: createAction('NEW_DATA')
};