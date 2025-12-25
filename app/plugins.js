import path from 'path';
import fs from 'fs';
import {
    pluginSelector,
    sortedPluginSelector
} from './selectors';
import { createRegistryLoader } from './registry';
import { getPluginPath } from './pluginPaths';

var Module = require("module");

module.exports = function(app, store, actions) {

    // Initialize registry loader
    const registryLoader = createRegistryLoader({
        developmentMode: process.env.NODE_ENV === 'development',
        cacheTTL: 3600000, // 1 hour cache
        requestTimeout: 10000 // 10 second network timeout
    });

    //
    // Configure shared module paths for plugins
    // This makes React, Material-UI, and other host dependencies available to dynamically loaded plugins
    // Uses Module.wrap to inject paths into every loaded module
    //
    const reactPath = require.resolve('react');
    const modulesIndex = reactPath.lastIndexOf("node_modules");
    const ourModulesPath = path.join(reactPath.substring(0, modulesIndex), 'node_modules');

    // Also resolve specific shared dependency paths
    const reactDomPath = path.dirname(require.resolve('react-dom'));
    const muiCorePath = path.dirname(require.resolve('@material-ui/core'));
    const reduxPath = path.dirname(require.resolve('redux'));
    const reactReduxPath = path.dirname(require.resolve('react-redux'));

    console.log("[Plugins] Injecting shared module paths for plugins:");
    console.log("  - Base node_modules:", ourModulesPath);
    console.log("  - React:", reactDomPath);
    console.log("  - Material-UI:", muiCorePath);
    console.log("  - Redux:", reduxPath);
    console.log("  - React-Redux:", reactReduxPath);

    // Inject module paths into every loaded module via Module.wrap
    (function(moduleWrapCopy) {
        Module.wrap = function(script) {
            // Build the path injection script
            const pathInjectionScript = [
                `module.paths.push('${ourModulesPath}');`,
                `module.paths.push('${path.join(reactDomPath, '..')}');`,
                `module.paths.push('${path.join(muiCorePath, '..', '..')}');`,
                `module.paths.push('${path.join(reduxPath, '..')}');`,
                `module.paths.push('${path.join(reactReduxPath, '..')}');`
            ].join('');

            script = pathInjectionScript + script;
            return moduleWrapCopy(script);
        };
    })(Module.wrap);

    var plugins = {
        library: {},
        installed: {},
        configured: {
            "d23eb9da-19d6-4898-b56c-02a5a8ca477f": {
                plugin: "battle.net",
                data: {
                    name: "Cody",
                    url: "https://us.battle.net/account/parental-controls/manage.html?key=GF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    key: "GF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    childId: 3
                }
            },
            "2742b8a4-c6e9-416b-9d30-cc7618f5d1b5": {
                plugin: "battle.net",
                data: {
                    name: "Mandy",
                    url: "https://us.battle.net/account/parental-controls/manage.html?key=dF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    key: "dF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    childId: 4
                }
            },
            "9710629a-b82b-436c-8e3c-635861347ba0": {
                plugin: "ssh",
                data: {
                    name: "Router",
                    host: "192.168.0.3",
                    creds: {
                        user: 'user',
                        pass: 'pass'
                        //key: '98y89463087gfp938g74fp9784tgf3'
                    },
                    childId: 4,
                    actions: {
                        4: {
                            3: {
                                on: './enable.sh',
                                off: './disable.sh'
                            }
                        }
                    }
                }
            }
        }
    };

    function handleStateChange() {
        let nextState = store.getState().configurations;
        for (let plugin of Object.values(plugins.installed)) {
            let currentPluginState = plugin.currentState;
            let nextPluginState = nextState[plugin.name];
            console.log(plugin.name, nextPluginState);
            if (nextPluginState !== currentPluginState) {
                plugin.plugin && plugin.plugin.newState && plugin.plugin.newState(nextPluginState);
                plugin.currentState = nextPluginState;
            }
        }
    }

    let unsubscribe = store.subscribe(handleStateChange);
    // TODO: call unsubscribe when shutting down

    function installPlugin(plugin, callback) {
    }

    function initPlugins() {
        // Use environment-aware plugin path
        app.pluginPath = getPluginPath(app);
        console.log("[Plugins] Loading plugins from:", app.pluginPath);
        console.log("[Plugins] Environment:", process.env.NODE_ENV || 'production');

        // should be a network call
        // use https://flight-manual.atom.io/atom-server-side-apis/sections/atom-package-server-api/ as an example

        // GET api.allow2.com/automate/packages?page=1&sort=downloads&direction=desc

        // Legacy hardcoded library - deprecated in favor of registry loader
        // Kept for backward compatibility only
        plugins.library = {
            "@allow2/allow2automate-battle.net": {
                name: "battle.net",
                publisher: "allow2",
                releases: {
                    latest: "0.0.2"
                },
                description: "Enable Allow2Automate management of Battle.Net parental controls",
                main: "./dist/index.js",
                repository: {
                    type: "git",
                    url: "https://github.com/Allow2/allow2automate-battle.net"
                },
                keywords: [
                    'allow2automate', 'battle.net', 'wow', 'world of warcraft'
                ]
            },
            "@allow2/allow2automate-ssh": {
                name: "ssh",
                publisher: "allow2",
                releases: {
                    latest: "0.0.2"
                },
                description: "Enable Allow2Automate the ability to use ssh to configure devices",
                main: "./dist/index.js",
                repository: {
                    type: "git",
                    url: "https://github.com/Allow2/allow2automate-ssh"
                },
                keywords : [
                    'allow2automate', 'allow2', 'ssh'
                ]
            },
            "@allow2/allow2automate-wemo": {
                name: "wemo",
                publisher: "allow2",
                releases: {
                    latest: "0.0.4"
                },
                description: "Enable Allow2Automate the ability to control wemo devices",
                main: "./dist/index.js",
                repository: {
                    type: "git",
                    url: "https://github.com/Allow2/allow2automate-wemo"
                },
                keywords : [
                    'allow2automate', 'allow2', 'wemo'
                ]
            },
            "mcafee-safefamily": {
                name: "safefamily",
                publisher: "mcafee",
                releases: {
                    latest: "1.0.0"
                },
                description: "Enable Allow2Automate management of McAfee Safe Family parental controls",
                repository: {
                    type: "git",
                    url: "https://github.com/McAfee/allow2automate-safefamily"
                },
                keywords : [
                    'allow2automate', 'mcafee', 'safefamily'
                ]
            }
        }
    }

    //initPlugins();

    /**
     * Get plugin library from registry (async/await version)
     * Now uses registry loader for dynamic plugin discovery
     */
    plugins.getLibraryAsync = async function() {
        console.log('[Plugins] Loading library from registry...');
        const library = await registryLoader.getLibrary();
        console.log(`[Plugins] ✅ Loaded ${Object.keys(library).length} plugins from registry`);
        return library;
    };

    /**
     * Get plugin library from registry (callback version - deprecated)
     * Kept for backward compatibility
     */
    plugins.getLibrary = async function(callback) {
        try {
            const library = await plugins.getLibraryAsync();
            callback(null, library);
        } catch (error) {
            console.error('[Plugins] Error loading library from registry:', error);
            callback(error, null);
        }
    };

    /**
     * Search plugins in registry
     * @param {Object} criteria - Search criteria (category, keyword, publisher, verified, sort)
     * @param {Function} callback - Callback function
     */
    plugins.searchRegistry = async function(criteria, callback) {
        try {
            const results = await registryLoader.searchPlugins(criteria);
            callback(null, results);
        } catch (error) {
            console.error('[Plugins] Error searching registry:', error);
            callback(error, null);
        }
    };

    /**
     * Get plugin details from registry
     * @param {string} pluginName - Plugin name
     * @param {Function} callback - Callback function
     */
    plugins.getPluginDetails = async function(pluginName, callback) {
        try {
            const plugin = await registryLoader.getPlugin(pluginName);
            callback(null, plugin);
        } catch (error) {
            console.error('[Plugins] Error getting plugin details:', error);
            callback(error, null);
        }
    };

    /**
     * Reload registry (bypass cache)
     * @param {Function} callback - Callback function
     */
    plugins.reloadRegistry = async function(callback) {
        try {
            await registryLoader.reloadRegistry();
            console.log('[Plugins] Registry reloaded successfully');
            callback(null, true);
        } catch (error) {
            console.error('[Plugins] Error reloading registry:', error);
            callback(error, null);
        }
    };

    /**
     * Load specific plugin by namespace identifier
     * @param {string} pluginIdentifier - Full plugin name (e.g., '@allow2/allow2automate-wemo')
     * @param {Function} callback - Callback function
     */
    plugins.loadPluginByNamespace = async function(pluginIdentifier, callback) {
        try {
            const plugin = await registryLoader.loadPlugin(pluginIdentifier);
            if (!plugin) {
                console.warn(`[Plugins] Plugin not found: ${pluginIdentifier}`);
                callback(new Error(`Plugin not found: ${pluginIdentifier}`), null);
                return;
            }
            console.log(`[Plugins] Loaded plugin: ${pluginIdentifier}`);
            callback(null, plugin);
        } catch (error) {
            console.error('[Plugins] Error loading plugin:', error);
            callback(error, null);
        }
    };

    /**
     * Find orphaned plugin files (plugins in namespace folders not in master registry)
     * @param {Function} callback - Callback function
     */
    plugins.findOrphanedPlugins = async function(callback) {
        try {
            const orphans = await registryLoader.findOrphanedPlugins();
            console.log(`[Plugins] Found ${orphans.length} orphaned plugins`);
            callback(null, orphans);
        } catch (error) {
            console.error('[Plugins] Error finding orphaned plugins:', error);
            callback(error, null);
        }
    };

    plugins.getInstalled = function(callback) {
        let currentState = store.getState().configurations;

        // Use environment-aware plugin path for listing installed plugins
        const pluginBasePath = getPluginPath(app);
        console.log('[Plugins] Scanning for installed plugins in:', pluginBasePath);

        const installedPlugins = app.epm.list(pluginBasePath, { version: true }).reduce(function(memo, plugin) {
            const parts = plugin.split('@');
            const pluginName = parts[0];
            memo[pluginName] = { version: parts[1] };
            try {
                // Use the pluginBasePath from parent scope
                const fullPath = path.join(pluginBasePath, pluginName);
                let jsonString = fs.readFileSync(path.join(fullPath, 'package.json'), 'utf8');
                //console.log(jsonString);
                let packageJson = JSON.parse(jsonString);
                packageJson.name = pluginName;
                packageJson.shortName = packageJson.shortName || pluginName;
                //packageJson.fullPath = fullpath;
                memo[pluginName] = packageJson;
                console.log('[Plugins] Loading plugin:', pluginName, 'from:', pluginBasePath);
                var loadedPlugin = app.epm.load(pluginBasePath, pluginName);
                //console.log(loadedPlugin.plugin);


                const ipcRestricted = {
                    send: (channel, ...args) => { app.ipcSend( `${pluginName}.${channel}`, ...args)},
                    on: (channel, listener) => { app.ipcOn( `${pluginName}.${channel}`, listener)},
	                invoke: async (channel, ...args) => { return await app.ipcInvoke( `${pluginName}.${channel}`, ...args)},
	                handle: (channel, handler) => { app.ipcHandle( `${pluginName}.${channel}`, handler)}
                };

                // console.log(1, app.ipcSend);
	            // //app.ipcSend( 'bob', 'fred');
	            // app.ipcOn( 'bob', ()=>{});
	            // // app.ipcHandle( 'fred', ()=>{});
	            // // app.ipcInvoke( 'fred', ()=>{});
	            // console.log(2);

                const configurationUpdate = function(newConfiguration) {
                    console.log("updateConfiguration: ", pluginName, " = ", newConfiguration);
                    actions.configurationUpdate({ [pluginName]:newConfiguration });
                    store.save();
                };

                const installedPlugin = loadedPlugin.plugin({
                    isMain: true,
	                ipcMain: ipcRestricted,
                    configurationUpdate: configurationUpdate
                });

                let currentPluginState = currentState[pluginName];
                installedPlugin.onLoad && installedPlugin.onLoad(currentPluginState);
                plugins.installed[pluginName] = {
                    name: pluginName,
                    plugin: installedPlugin,
                    currentState: null
                };

            } catch (err) {
                console.log('Error parsing JSON string', err);
            }
            return memo;
        }, {});
        callback(null, installedPlugins);
    };

    return plugins;
};