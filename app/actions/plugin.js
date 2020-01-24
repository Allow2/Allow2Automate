import { createAction } from 'redux-actions';

export default {
    pluginUpdate: createAction('PLUGIN_UPDATE'),
    pluginReplace: createAction('PLUGIN_REPLACE')
};
