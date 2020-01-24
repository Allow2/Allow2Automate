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
        var initialPlugins = Object.values(plugins).map(function(plugin) {
            return {
                ...plugin,
                configurations: {}
            };
        });
        var configurationsyPlugin = Object.values(configurations).reduce(function (memo, configuration) {
            var plugin = memo[configuration.plugin] || {
                name: configuration.plugin,
                configurations: {}
            };
            plugin.configurations = [...plugin.configurations, configuration];
            memo[configuration.plugin] = plugin;
            return memo;
        }, initialPlugins);
        return configurationsyPlugin;
    }
);

const sortedVisibleConfigurationsByPluginSelector = createSelector(
    [visibleConfigurationsByPluginSelector],
    (configurationsByPlugin) => {
        if (!configurationsByPlugin) { return []; }
        console.log(configurationsByPlugin);
        var sortedConfigurations = Object.values(configurationsByPlugin).reduce(function (memo, plugin) {
            memo[plugin.name] = {
                ...plugin,
                configurations: Object.values(plugin.configurations).sort((a, b) => {
                    return a.data.name.localeCompare(b.data.name);
                })
            };
            return memo;
        }, {});
        var result = Object.values(sortedConfigurations).sort((a,b) => {
            return a.name .localeCompare(b.name);
        }); // todo: better sorting
        return result;
    }
);

module.exports = {
    sortedVisibleConfigurationsSelector,
    visibleConfigurationsByPluginSelector,
    sortedVisibleConfigurationsByPluginSelector
};