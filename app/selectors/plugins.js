import { createSelector } from 'reselect';

const sortedVisibleConfigurationsSelector = createSelector(
    [state => state.configurations],
    (configurations) => {
        if (!configurations) { return []; }
        var result = Object.values(configurations).sort((a,b) => {
            return (a.plugin + "|" + (a.data.name || a.id)).localeCompare(b.plugin + "|" + (b.data.name || b.id))
        });
        return result;
    }
);

const visibleConfigurationsByPluginSelector = createSelector(
    [state => state.plugins, state => state.configurations],
    (plugins, configurations) => {
        if (!plugins || !configurations) { return []; }
        var initialPlugins = Object.values(plugins).reduce(function(memo, plugin) {
            memo[plugin.id] = {
                ...plugin,
                configurations: {}
            };
            return memo;
        }, {});
        var configurationsByPlugin = Object.values(configurations).reduce(function (memo, configuration) {
            var plugin = memo[configuration.plugin] || {
                id: configuration.plugin,
                configurations: {}
            };
            plugin.configurations = [...plugin.configurations, configuration];
            memo[configuration.plugin] = plugin;
            return memo;
        }, initialPlugins);
        console.log("configurationsByPlugin", configurationsByPlugin);
        return configurationsByPlugin;
    }
);

const sortedVisibleConfigurationsByPluginSelector = createSelector(
    [visibleConfigurationsByPluginSelector],
    (configurationsByPlugin) => {
        if (!configurationsByPlugin) { return []; }
        //console.log(configurationsByPlugin);
        const sortedConfigurations = Object.values(configurationsByPlugin).reduce(function (memo, plugin) {
            memo[plugin.id] = {
                ...plugin,
                configurations: Object.values(plugin.configurations).sort((a, b) => {
                    return a.data.name.localeCompare(b.data.name);
                })
            };
            return memo;
        }, {});
        const result = Object.values(sortedConfigurations).sort((a,b) => {
            return (a.name || a.id).localeCompare(b.name || b.id);
        }); // todo: better sorting
        console.log("sortedVisibleConfigurationsByPlugin", configurationsByPlugin);
        return result;
    }
);

module.exports = {
    sortedVisibleConfigurationsSelector,
    visibleConfigurationsByPluginSelector,
    sortedVisibleConfigurationsByPluginSelector
};