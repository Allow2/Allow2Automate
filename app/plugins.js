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
        console.error('[Plugins] ERROR-LEVEL - Scanning node_modules at:', nodeModulesPath);

        try {
            if (fs.existsSync(nodeModulesPath)) {
                console.error('[Plugins] ERROR-LEVEL - node_modules EXISTS');
                // Scan for scoped packages (@allow2/*)
                const allow2ScopePath = path.join(nodeModulesPath, '@allow2');
                console.error('[Plugins] ERROR-LEVEL - Checking @allow2 scope at:', allow2ScopePath);
                if (fs.existsSync(allow2ScopePath)) {
                    console.error('[Plugins] ERROR-LEVEL - @allow2 scope EXISTS');
                    const scopedPackages = fs.readdirSync(allow2ScopePath)
                        .filter(name => name.startsWith('allow2automate-'))
                        .map(name => `@allow2/${name}`);
                    pluginList = pluginList.concat(scopedPackages);
                    console.log('[Plugins] Found scoped packages:', scopedPackages);
                    console.error('[Plugins] ERROR-LEVEL - Found scoped packages:', JSON.stringify(scopedPackages));
                } else {
                    console.error('[Plugins] ERROR-LEVEL - @allow2 scope DOES NOT EXIST');
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
        console.error('[Plugins] ERROR-LEVEL LOG - Total plugins found:', pluginList.length);
        console.error('[Plugins] ERROR-LEVEL LOG - Plugin list:', JSON.stringify(pluginList));

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

                // Load icon metadata for plugin
                packageJson.icon = packageJson.icon || null;
                packageJson.iconType = packageJson.iconType || 'file';

                // Check if plugin exists in Redux store (filter out deleted plugins)
                const storedPlugins = store.getState().installedPlugins;
                if (storedPlugins && storedPlugins[pluginName]) {
                    // Plugin is installed - merge disabled state
                    packageJson.disabled = storedPlugins[pluginName].disabled || false;
                    console.log('[Plugins] Loading installed plugin:', pluginName, 'disabled:', packageJson.disabled, 'icon:', packageJson.icon);

                    // Store full path for icon resolution
                    packageJson.fullPath = fullPath;
                    memo[pluginName] = packageJson;
                } else {
                    // Plugin was deleted from store - skip it
                    console.log('[Plugins] Skipping deleted plugin:', pluginName);
                    return memo;
                }

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
                    const actionPayload = { [pluginName]: newConfiguration };
                    actions.configurationUpdate(actionPayload);
                    store.save();

                    // CRITICAL FIX: electron-redux v2 has broken action sync from main to renderer
                    // Manually broadcast configuration updates to all renderer windows via IPC
                    const { BrowserWindow } = require('electron');
                    const action = {
                        type: 'CONFIGURATION_UPDATE',
                        payload: actionPayload
                    };
                    BrowserWindow.getAllWindows().forEach(win => {
                        if (win && win.webContents) {
                            console.log('[Plugins] Broadcasting CONFIGURATION_UPDATE to renderer');
                            win.webContents.send('CONFIGURATION_UPDATE_SYNC', action);
                        }
                    });
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

                // Generic plugin main process initialization
                // Detect if plugin exports requiresMainProcess flag
                const { ipcMain } = require('electron');

                console.log('[Plugin Loader] Checking if plugin needs main process init:', pluginName);

                // Try to load plugin module to check for main process requirement
                let requiresMainProcess = false;
                try {
                    const pluginModule = require(fullPath);
                    requiresMainProcess = pluginModule.requiresMainProcess === true;
                } catch (err) {
                    console.log('[Plugin Loader] Could not pre-check plugin:', err.message);
                }

                if (requiresMainProcess) {
                    console.error(`[Plugin Loader] ✅ Plugin ${pluginName} requires main process - initializing...`);

                    // Load the plugin module
                    let loadedPlugin;
                    try {
                        loadedPlugin = require(fullPath);
                        console.log('[Plugin Loader] Loaded plugin module:', pluginName);
                    } catch (err) {
                        console.error('[Plugin Loader] Failed to load plugin:', pluginName, err);
                        return memo;
                    }

                    // Build restricted ipcMain for plugin
                    const ipcMainRestricted = {
                        handle: (channel, handler) => {
                            const prefixedChannel = `${pluginName}.${channel}`;
                            console.log(`[Plugin ${pluginName}] Registering IPC handler:`, prefixedChannel);
                            ipcMain.handle(prefixedChannel, handler);
                        },
                        on: (channel, listener) => {
                            const prefixedChannel = `${pluginName}.${channel}`;
                            console.log(`[Plugin ${pluginName}] Registering IPC listener:`, prefixedChannel);
                            ipcMain.on(prefixedChannel, listener);
                        },
                        removeHandler: (channel) => {
                            const prefixedChannel = `${pluginName}.${channel}`;
                            ipcMain.removeHandler(prefixedChannel);
                        },
                        removeListener: (channel, listener) => {
                            const prefixedChannel = `${pluginName}.${channel}`;
                            ipcMain.removeListener(prefixedChannel, listener);
                        }
                    };

                    // Build plugin context with all available services
                    const pluginContext = {
                        isMain: true,
                        ipcMain: ipcMainRestricted, // Restricted ipcMain with auto-prefixing
                        BrowserWindow: require('electron').BrowserWindow, // For OAuth windows
                        configurationUpdate: configurationUpdate,
                        statusUpdate: statusUpdate,
                        services: global.services || {},

                        // Allow2 integration (if user logged in)
                        allow2: store && store.getState && store.getState().user ? {
                            on: (event, handler) => {
                                console.log(`[Plugin ${packageJson.shortName}] Allow2 event listener registered:`, event);
                            },
                            getChildState: async (childId) => {
                                const state = store.getState();
                                const child = state.user && state.user.children && state.user.children.find(c => c.id === childId);
                                return child ? {
                                    paused: child.paused || false,
                                    quota: child.timeToday || 0
                                } : { paused: true, quota: 0 };
                            }
                        } : null,

                        // Activity logging
                        logActivity: (activityData) => {
                            console.log(`[Plugin ${packageJson.shortName}] Activity:`, activityData);
                        },

                        // Notifications
                        notify: (notification) => {
                            console.log(`[Plugin ${packageJson.shortName}] Notification:`, notification);
                        },

                        // Send to renderer windows
                        sendToRenderer: (channel, data) => {
                            const prefixedChannel = `${pluginName}.${channel}`;
                            console.log(`[Plugin ${pluginName}] Sending to renderer:`, prefixedChannel);
                            const { BrowserWindow } = require('electron');
                            BrowserWindow.getAllWindows().forEach(win => {
                                win.webContents.send(prefixedChannel, data);
                            });
                        }
                    };

                    // Initialize plugin
                    const installedPlugin = loadedPlugin.plugin(pluginContext);

                    // Load plugin state and call onLoad
                    let currentPluginState = currentState[pluginName];
                    if (installedPlugin.onLoad) {
                        console.log(`[Plugin Loader] Calling onLoad for ${pluginName}`);
                        installedPlugin.onLoad(currentPluginState);
                    }

                    plugins.installed[pluginName] = {
                        name: pluginName,
                        plugin: installedPlugin,
                        currentState: currentPluginState
                    };
                }

                // Register IPC handler for status updates from renderer
                ipcMain.on(`${pluginName}.status.update`, (event, statusData) => {
                    statusUpdate(statusData);
                });

            } catch (err) {
                console.log('Error parsing JSON string', err);
            }
            return memo;
        }, {});

        // ==========================================
        // DEV-PLUGINS MAIN PROCESS INITIALIZATION
        // ==========================================
        // Dev-plugins are loaded from <project-root>/dev-plugins in development mode
        // They need the same main process initialization as installed plugins
        if (process.env.NODE_ENV === 'development') {
            const devPluginsDir = path.join(__dirname, '..', 'dev-plugins');
            console.log('[Plugins] Checking for dev-plugins requiring main process at:', devPluginsDir);

            if (fs.existsSync(devPluginsDir)) {
                const devPluginDirs = fs.readdirSync(devPluginsDir, { withFileTypes: true })
                    .filter(d => d.isDirectory() && d.name.startsWith('allow2automate-'));

                console.log(`[Plugins] Found ${devPluginDirs.length} potential dev-plugins`);

                for (const dir of devPluginDirs) {
                    try {
                        const pluginDir = path.join(devPluginsDir, dir.name);
                        const pkgPath = path.join(pluginDir, 'package.json');

                        if (!fs.existsSync(pkgPath)) continue;

                        const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                        const pluginName = pkgData.name; // e.g., @allow2/allow2automate-operating-system
                        const mainEntry = pkgData.main || 'dist/index.js';
                        const fullPath = path.join(pluginDir, mainEntry);

                        console.log(`[Plugins] Checking dev-plugin ${pluginName} at ${fullPath}`);

                        // Check if plugin requires main process
                        if (!fs.existsSync(fullPath)) {
                            console.log(`[Plugins] Dev-plugin ${pluginName} main entry not found - skipping`);
                            continue;
                        }

                        let loadedPlugin;
                        try {
                            loadedPlugin = require(fullPath);
                        } catch (err) {
                            console.error(`[Plugins] Failed to load dev-plugin ${pluginName}:`, err.message);
                            continue;
                        }

                        if (loadedPlugin.requiresMainProcess !== true) {
                            console.log(`[Plugins] Dev-plugin ${pluginName} does not require main process`);
                            continue;
                        }

                        console.log(`[Plugins] ✅ Initializing dev-plugin ${pluginName} in main process...`);

                        // Build restricted ipcMain for dev-plugin (same as installed plugins)
                        const { ipcMain } = require('electron');
                        const ipcMainRestricted = {
                            handle: (channel, handler) => {
                                const prefixedChannel = `${pluginName}.${channel}`;
                                console.log(`[Plugin ${pluginName}] Registering IPC handler:`, prefixedChannel);
                                ipcMain.handle(prefixedChannel, handler);
                            },
                            on: (channel, listener) => {
                                const prefixedChannel = `${pluginName}.${channel}`;
                                console.log(`[Plugin ${pluginName}] Registering IPC listener:`, prefixedChannel);
                                ipcMain.on(prefixedChannel, listener);
                            },
                            removeHandler: (channel) => {
                                const prefixedChannel = `${pluginName}.${channel}`;
                                ipcMain.removeHandler(prefixedChannel);
                            },
                            removeListener: (channel, listener) => {
                                const prefixedChannel = `${pluginName}.${channel}`;
                                ipcMain.removeListener(prefixedChannel, listener);
                            }
                        };

                        // Configuration and status update functions for dev-plugin
                        const devConfigurationUpdate = function(newConfiguration) {
                            console.log("[Dev-Plugin] updateConfiguration:", pluginName, "=", newConfiguration);
                            const actionPayload = { [pluginName]: newConfiguration };
                            actions.configurationUpdate(actionPayload);
                            store.save();

                            // CRITICAL FIX: electron-redux v2 has broken action sync from main to renderer
                            // Manually broadcast configuration updates to all renderer windows via IPC
                            const { BrowserWindow } = require('electron');
                            const action = {
                                type: 'CONFIGURATION_UPDATE',
                                payload: actionPayload
                            };
                            BrowserWindow.getAllWindows().forEach(win => {
                                if (win && win.webContents) {
                                    console.log('[Dev-Plugin] Broadcasting CONFIGURATION_UPDATE to renderer');
                                    win.webContents.send('CONFIGURATION_UPDATE_SYNC', action);
                                }
                            });
                        };

                        const devStatusUpdate = function(statusData) {
                            console.log('[Dev-Plugin] Status update from', pluginName, ':', statusData.status);
                            actions.pluginStatusUpdate(pluginName, {
                                status: statusData.status,
                                message: statusData.message || '',
                                timestamp: statusData.timestamp || Date.now(),
                                details: statusData.details || {}
                            });
                            store.save();
                        };

                        // Build plugin context
                        const pluginContext = {
                            isMain: true,
                            ipcMain: ipcMainRestricted,
                            BrowserWindow: require('electron').BrowserWindow,
                            configurationUpdate: devConfigurationUpdate,
                            statusUpdate: devStatusUpdate,
                            services: global.services || {},
                            allow2: store && store.getState && store.getState().user ? {
                                on: (event, handler) => {
                                    console.log(`[Dev-Plugin ${pluginName}] Allow2 event listener registered:`, event);
                                },
                                getChildState: async (childId) => {
                                    const state = store.getState();
                                    const child = state.user && state.user.children && state.user.children.find(c => c.id === childId);
                                    return child ? {
                                        paused: child.paused || false,
                                        quota: child.timeToday || 0
                                    } : { paused: true, quota: 0 };
                                }
                            } : null,
                            logActivity: (activityData) => {
                                console.log(`[Dev-Plugin ${pluginName}] Activity:`, activityData);
                            },
                            notify: (notification) => {
                                console.log(`[Dev-Plugin ${pluginName}] Notification:`, notification);
                            },
                            sendToRenderer: (channel, data) => {
                                const prefixedChannel = `${pluginName}.${channel}`;
                                console.log(`[Dev-Plugin ${pluginName}] Sending to renderer:`, prefixedChannel);
                                const { BrowserWindow } = require('electron');
                                BrowserWindow.getAllWindows().forEach(win => {
                                    win.webContents.send(prefixedChannel, data);
                                });
                            }
                        };

                        // Initialize plugin
                        const initializedPlugin = loadedPlugin.plugin(pluginContext);

                        // Load plugin state and call onLoad
                        let devPluginState = currentState[pluginName];
                        if (initializedPlugin.onLoad) {
                            console.log(`[Plugins] Calling onLoad for dev-plugin ${pluginName}`);
                            initializedPlugin.onLoad(devPluginState);
                        }

                        // Store in installed plugins map
                        plugins.installed[pluginName] = {
                            name: pluginName,
                            plugin: initializedPlugin,
                            currentState: devPluginState,
                            isDevPlugin: true
                        };

                        // Register status update IPC handler
                        ipcMain.on(`${pluginName}.status.update`, (event, statusData) => {
                            devStatusUpdate(statusData);
                        });

                        console.log(`[Plugins] ✅ Dev-plugin ${pluginName} initialized successfully`);

                    } catch (err) {
                        console.error(`[Plugins] Error initializing dev-plugin ${dir.name}:`, err);
                    }
                }
            }
        }
        // ==========================================
        // END DEV-PLUGINS MAIN PROCESS INITIALIZATION
        // ==========================================

        callback(null, installedPlugins);
    };

    // Watch for plugin enable/disable state changes
    let previousPlugins = {};
    store.subscribe(() => {
        const state = store.getState();
        const currentPlugins = state.installedPlugins || {};

        // Check each plugin for enabled/disabled state changes
        Object.keys(currentPlugins).forEach(pluginName => {
            const currentPlugin = currentPlugins[pluginName];
            const previousPlugin = previousPlugins[pluginName];

            // Check if disabled state changed
            if (previousPlugin && currentPlugin.disabled !== previousPlugin.disabled) {
                const isEnabled = !currentPlugin.disabled;
                console.log(`[Plugins] Plugin ${pluginName} state changed to:`, isEnabled ? 'enabled' : 'disabled');

                // Call the plugin's onSetEnabled if it exists
                const loadedPlugin = plugins.installed[pluginName];
                if (loadedPlugin && loadedPlugin.plugin && loadedPlugin.plugin.onSetEnabled) {
                    console.log(`[Plugins] Calling onSetEnabled(${isEnabled}) for ${pluginName}`);
                    try {
                        loadedPlugin.plugin.onSetEnabled(isEnabled);
                    } catch (error) {
                        console.error(`[Plugins] Error in onSetEnabled for ${pluginName}:`, error);
                    }
                }
            }
        });

        // Update previous state
        previousPlugins = JSON.parse(JSON.stringify(currentPlugins));
    });

    return plugins;
};