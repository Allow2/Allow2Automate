import { createAction } from 'redux-actions';

export default {
    installedPluginReplace: createAction('INSTALLED_PLUGIN_REPLACE'),
    installedPluginUpdate: createAction('INSTALLED_PLUGIN_UPDATE'),
    installedPluginRemove: createAction('INSTALLED_PLUGIN_REMOVE')
};
