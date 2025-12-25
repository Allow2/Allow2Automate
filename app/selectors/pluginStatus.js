import { createSelector } from 'reselect';

// Get status for a specific plugin
const pluginStatusSelector = (state, pluginName) => {
    return state.pluginStatus && state.pluginStatus[pluginName];
};

// Get all plugin statuses
const allPluginStatusSelector = state => {
    return state.pluginStatus || {};
};

// Get status for all installed plugins
const installedPluginStatusSelector = createSelector(
    [state => state.installedPlugins, state => state.pluginStatus],
    (installedPlugins, pluginStatus) => {
        const result = {};
        Object.keys(installedPlugins || {}).forEach(pluginName => {
            result[pluginName] = pluginStatus && pluginStatus[pluginName] || {
                status: 'unconfigured',
                message: 'Status not reported',
                timestamp: Date.now()
            };
        });
        return result;
    }
);

// Check if plugin has a problem (not connected)
const pluginHasIssueSelector = (state, pluginName) => {
    const status = pluginStatusSelector(state, pluginName);
    if (!status) return true; // No status = issue

    const problemStates = ['unconfigured', 'disconnected', 'error', 'warning'];
    return problemStates.includes(status.status);
};

module.exports = {
    pluginStatusSelector,
    allPluginStatusSelector,
    installedPluginStatusSelector,
    pluginHasIssueSelector
};
