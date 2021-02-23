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
    [state => state.installedPlugins, state => state.configurations, state => state.pluginLibrary],
    (plugins, configurations, stateLibrary) => {
        if (!plugins || !configurations ) { return []; }
        const library = stateLibrary || {};     // not needed?
        const initialPlugins = Object.entries(plugins).reduce(function(memo, [key, plugin]) {
            const available = library[key] || null;
            var newPlugin = {
                ...plugin,
                configurations: {},
                available: available
            };

            memo[key] = newPlugin;
            return memo;
        }, {});
        // console.log('initialPlugins', initialPlugins);
        const configurationsByPlugin = Object.values(configurations).reduce(function (memo, configuration) {
            var plugin = memo[configuration.plugin] || {
                name: configuration.plugin,
                shortName: configuration.plugin,
                configurations: {},
                missing: true
            };
            plugin.configurations = [...plugin.configurations, configuration];
            memo[configuration.plugin] = plugin;
            return memo;
        }, initialPlugins);
        //console.log('1', configurationsByPlugin);

        return configurationsByPlugin;
    }
);

const visibleConfigurationsByActivePluginSelector = createSelector(
    [visibleConfigurationsByPluginSelector],
    (configurationsByPlugin) => {
        //console.log('2', configurationsByPlugin);
        if (!configurationsByPlugin) { return {}; }
        return Object.entries(configurationsByPlugin).reduce((memo, [key, plugin]) => {
            if (plugin.disabled || plugin.missing) {
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
        //console.log('3', configurationsByPlugin);
        if (!configurationsByPlugin) { return []; }
        var result = Object.values(configurationsByPlugin).sort((a,b) => {
            return a.name .localeCompare(b.name);
        });
        // todo better sorting
        return result;
    }
);

const sortedVisibleConfigurationsByActivePluginSelector = createSelector(
    [visibleConfigurationsByActivePluginSelector],
    (configurationsByPlugin) => {
        if (!configurationsByPlugin) { return []; }
        var result = Object.values(configurationsByPlugin).sort((a,b) => {
            return a.name .localeCompare(b.name);
        }); // todo: better sorting
        return result;
    }
);

//
// filtered sub-data suitable to supply to plugins
//
const pluginDataSelector = createSelector(
    [state => state.user, state => state.children],
    (user, children) => {
        if (!user || !children) { return {}; }
        return {
            children: Object.values(children).reduce((memo, child) => {
                memo[child.id] = {
                    name: child.name,
                    avatar: (child.Account && child.Account.avatar) || child.avatar
                };
                return memo;
            }, {}),
            user: {
                id: user.user.id,
                firstName: user.user.firstName,
                lastName: user.user.lastName,
                fullName: user.user.fullName,
                avatar: user.user.avatar,
                region: user.user.region
            }
        };
    }
);


module.exports = {
    sortedVisibleConfigurationsSelector,
    visibleConfigurationsByPluginSelector,
    visibleConfigurationsByActivePluginSelector,
    sortedVisibleConfigurationsByPluginSelector,
    sortedVisibleConfigurationsByActivePluginSelector,
    pluginDataSelector
};