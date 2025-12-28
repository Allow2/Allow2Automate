import { createSelector } from 'reselect';

const pluginSelector = createSelector(
    [state => state.installedPlugins, state => state.configurations, state => state.pluginLibrary],
    (plugins, configurations, stateLibrary) => {
        if (!plugins || !configurations ) { return []; }
        const library = stateLibrary || {};     // not needed?
        const pluginsWithConfigurations = Object.entries(plugins).reduce(function(memo, [key, plugin]) {
            const available = library[key] || null;
            var newPlugin =     {
                name: plugin.name,
                // Get shortName from library first, fallback to plugin, then to name
                shortName: (available && available.shortName) || plugin.shortName || plugin.name,
                version: plugin.version,
                packageJson: plugin,
                configuration: configurations[plugin.name] || {},
                available: available,
                disabled: plugin.disabled
            };

            memo[key] = newPlugin;
            return memo;
        }, {});

        return pluginsWithConfigurations;
    }
);

const activePluginSelector = createSelector(
    [pluginSelector],
    (pluginsWithConfigurations) => {
        //console.log('2', pluginsWithConfigurations);
        if (!pluginsWithConfigurations) { return {}; }
        return Object.entries(pluginsWithConfigurations).reduce((memo, [key, plugin]) => {
            if (plugin.disabled || plugin.missing) {
                return memo;
            }
            memo[key] = plugin;
            return memo;
        }, {});
    }
);

const sortedPluginSelector = createSelector(
    [pluginSelector],
    (pluginsWithConfigurations) => {
        //console.log('3', configurationsByPlugin);
        if (!pluginsWithConfigurations) { return []; }
        var result = Object.values(pluginsWithConfigurations).sort((a,b) => {
            return a.name .localeCompare(b.name);
        });
        // todo better sorting
        return result;
    }
);

const sortedActivePluginSelector = createSelector(
    [activePluginSelector],
    (pluginsWithConfigurations) => {
        if (!pluginsWithConfigurations) { return []; }
        var result = Object.values(pluginsWithConfigurations).sort((a,b) => {
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
    pluginSelector,
    activePluginSelector,
    sortedPluginSelector,
    sortedActivePluginSelector,
    pluginDataSelector
};