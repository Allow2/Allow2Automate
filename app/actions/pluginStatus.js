import { createAction } from 'redux-actions';

export default {
    // Update status for a single plugin
    pluginStatusUpdate: createAction('PLUGIN_STATUS_UPDATE',
        (pluginName, statusData) => ({ pluginName, statusData })
    ),

    // Clear status for a plugin (when uninstalled)
    pluginStatusClear: createAction('PLUGIN_STATUS_CLEAR',
        (pluginName) => ({ pluginName })
    ),

    // Initialize all plugin statuses (on app start)
    pluginStatusInit: createAction('PLUGIN_STATUS_INIT',
        (statusMap) => statusMap
    )
};
