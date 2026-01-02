import path from 'path';
import fs from 'fs';
import {
    pluginSelector,
    sortedPluginSelector
} from './selectors';
import { createRegistryLoader } from './registry';
import { getPluginInstallPath, getPluginLibraryScanPath } from './pluginPaths';

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

    // Browser automation for plugins (used by battle.net, etc.)
    // Playwright provides headless Chrome/Firefox automation for web control
    const playwrightPath = path.dirname(require.resolve('playwright'));

    console.log("[Plugins] Injecting shared module paths for plugins:");
    console.log("  - Base node_modules:", ourModulesPath);
    console.log("  - React:", reactDomPath);
    console.log("  - Material-UI:", muiCorePath);
    console.log("  - Redux:", reduxPath);
    console.log("  - React-Redux:", reactReduxPath);
    console.log("  - Playwright (browser automation):", playwrightPath);

    // Inject module paths into every loaded module via Module.wrap
    // This allows plugins to require() shared dependencies from the host application
    // instead of bundling their own copies (reduces plugin size and version conflicts)
    (function(moduleWrapCopy) {
        Module.wrap = function(script) {
            // Build the path injection script
            const pathInjectionScript = [
                `module.paths.push('${ourModulesPath}');`,
                `module.paths.push('${path.join(reactDomPath, '..')}');`,
                `module.paths.push('${path.join(muiCorePath, '..', '..')}');`,
                `module.paths.push('${path.join(reduxPath, '..')}');`,
                `module.paths.push('${path.join(reactReduxPath, '..')}');`,
                // Playwright for browser automation (battle.net plugin uses this)
                `module.paths.push('${path.join(playwrightPath, '..')}');`
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
        // Use install path for plugins
        app.pluginPath = getPluginInstallPath(app);
        console.log("[Plugins] Plugin install path:", app.pluginPath);
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

        // CRITICAL: Scan the INSTALL path (persistent storage), not library scan path
        // Development: <project-root>/dev-data/plugins
        // Production: ~/Library/Application Support/allow2automate/plugins
        const pluginBasePath = getPluginInstallPath(app);
        console.log('[Plugins] Scanning for installed plugins in:', pluginBasePath);

        // Scan for both scoped (@allow2/plugin-name) and unscoped (plugin-name) packages
        // electron-plugin-manager doesn't support scoped packages, so we scan manually
        let pluginList = [];
        const nodeModulesPath = path.join(pluginBasePath, 'node_modules');

        try {
            if (fs.existsSync(nodeModulesPath)) {
                // Scan for scoped packages (@allow2/*)
                const allow2ScopePath = path.join(nodeModulesPath, '@allow2');
                if (fs.existsSync(allow2ScopePath)) {
                    const scopedPackages = fs.readdirSync(allow2ScopePath)
                        .filter(name => name.startsWith('allow2automate-'))
                        .map(name => `@allow2/${name}`);
                    pluginList = pluginList.concat(scopedPackages);
                    console.log('[Plugins] Found scoped packages:', scopedPackages);
                }

                // Also scan for unscoped packages (allow2automate-*)
                const unscopedPackages = fs.readdirSync(nodeModulesPath)
                    .filter(name => name.startsWith('allow2automate-') && !name.startsWith('@'));
                pluginList = pluginList.concat(unscopedPackages);
                if (unscopedPackages.length > 0) {
                    console.log('[Plugins] Found unscoped packages:', unscopedPackages);
                }
            }
        } catch (err) {
            console.error('[Plugins] Error scanning for installed plugins:', err);
        }

        console.log('[Plugins] Total plugins found:', pluginList.length);
        console.log('[Plugins] Plugin list:', pluginList);

        const installedPlugins = pluginList.reduce(function(memo, plugin) {
            // Handle both scoped (@allow2/name) and unscoped (name) packages
            const pluginName = plugin; // Keep full name including scope

            try {
                // Build correct path for both scoped and unscoped packages
                const fullPath = path.join(nodeModulesPath, pluginName);
                let jsonString = fs.readFileSync(path.join(fullPath, 'package.json'), 'utf8');
                //console.log(jsonString);
                let packageJson = JSON.parse(jsonString);
                packageJson.name = pluginName;

                // Extract short name from package name
                // @allow2/allow2automate-wemo -> wemo
                // @allow2/allow2automate-ssh -> ssh
                const extractShortName = (name) => {
                    if (!name) return name;
                    // Check if package.json already has a shortName
                    if (packageJson.shortName) return packageJson.shortName;
                    // Extract from @allow2/allow2automate-<shortname>
                    const match = name.match(/allow2automate-(.+)$/);
                    return match ? match[1] : name;
                };

                packageJson.shortName = extractShortName(pluginName);
                //packageJson.fullPath = fullpath;
                memo[pluginName] = packageJson;
                console.log('[Plugins] Loading plugin:', pluginName, 'from:', fullPath);

                // Don't use epm.load() for scoped packages - it doesn't support them
                // The plugin will be loaded on-demand by the renderer when needed
                // var loadedPlugin = app.epm.load(pluginBasePath, pluginName);
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

                // Plugin status update interface
                const statusUpdate = function(statusData) {
                    console.log('[Plugins] Status update from', pluginName, ':', statusData.status);

                    // Validate status data
                    const validStatuses = ['unconfigured', 'configured', 'connected',
                                          'disconnected', 'error', 'warning'];
                    if (!validStatuses.includes(statusData.status)) {
                        console.warn('[Plugins] Invalid status for', pluginName, ':', statusData.status);
                        return;
                    }

                    // Dispatch Redux action to update status
                    actions.pluginStatusUpdate(pluginName, {
                        status: statusData.status,
                        message: statusData.message || '',
                        timestamp: statusData.timestamp || Date.now(),
                        details: statusData.details || {}
                    });

                    // Persist to store
                    store.save();
                };

                const installedPlugin = loadedPlugin.plugin({
                    isMain: true,
	                ipcMain: ipcRestricted,
                    configurationUpdate: configurationUpdate,
                    statusUpdate: statusUpdate,
                    services: global.services
                });

                // Initialize plugin with unconfigured status
                statusUpdate({
                    status: 'unconfigured',
                    message: 'Plugin loaded, awaiting configuration'
                });

                // Register IPC handler for status updates from renderer
                const { ipcMain } = require('electron');
                ipcMain.on(`${pluginName}.status.update`, (event, statusData) => {
                    statusUpdate(statusData);
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