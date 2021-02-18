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

        var initialPlugins = Object.entries(plugins).reduce(function(memo, [key, plugin]) {
            memo[key] = {
                ...plugin,
                configurations: {}
            };
            return memo;
        }, {});
        // console.log('initialPlugins', initialPlugins);
        var configurationsByPlugin = Object.values(configurations).reduce(function (memo, configuration) {
            var plugin = memo[configuration.plugin] || {
                 name: configuration.plugin,
                 configurations: {}
            };
            plugin.configurations = [...plugin.configurations, configuration];
            memo[configuration.plugin] = plugin;
            return memo;
        }, initialPlugins);
        // console.log('configurationsByPlugin', configurationsByPlugin);

        return configurationsByPlugin;
    }
);

const visibleConfigurationsByActivePluginSelector = createSelector(
    [visibleConfigurationsByPluginSelector],
    (configurationsByPlugin) => {
        if (!configurationsByPlugin) { return {}; }
        return Object.entries(configurationsByPlugin).reduce((memo, [key, plugin]) => {
            if (!plugin.id || plugin.disabled) {
                return memo;
            }
            memo[key] = plugin;
            return memo;
        }, {});
    }
);

const sortedVisibleConfigurationsByPluginSelector = createSelector(
    [visibleConfigurationsByPluginSelector],
    (configurationsByPlugin) => {
        if (!configurationsByPlugin) { return []; }
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

const sortedVisibleConfigurationsByActivePluginSelector = createSelector(
    [visibleConfigurationsByActivePluginSelector],
    (configurationsByPlugin) => {
        if (!configurationsByPlugin) { return []; }
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
    visibleConfigurationsByActivePluginSelector,
    sortedVisibleConfigurationsByPluginSelector,
    sortedVisibleConfigurationsByActivePluginSelector
};