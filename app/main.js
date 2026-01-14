import path from 'path';
import url from 'url';
import { app, crashReporter, BrowserWindow, Menu, ipcMain, safeStorage } from 'electron';
import allActions from './actions';
import configureStore from './mainStore';
import { allow2Request } from './util';
import { bindActionCreators } from 'redux';
import { getPluginPath, getPathByName, getPluginPathInfo, isDevelopmentMode } from './pluginPaths';
const async = require('async');
var allow2 = require('allow2');
var moment = require('moment-timezone');
app.epm = require('electron-plugin-manager');
const appConfig = require('electron-settings');

//
// Configure shared module paths for plugins
// This makes React, Material-UI, and other host dependencies available to plugins
//
const Module = require('module');

// Get paths to shared dependencies
const reactPath = path.dirname(require.resolve('react'));
const reactDomPath = path.dirname(require.resolve('react-dom'));
const muiCorePath = path.dirname(require.resolve('@material-ui/core'));
const muiIconsPath = path.dirname(require.resolve('@material-ui/icons'));
const reduxPath = path.dirname(require.resolve('redux'));
const reactReduxPath = path.dirname(require.resolve('react-redux'));

// Add shared module paths to Node's resolution paths
const sharedModulePaths = [
    path.join(reactPath, '..'),        // node_modules/react
    path.join(reactDomPath, '..'),     // node_modules/react-dom
    path.join(muiCorePath, '..', '..'), // node_modules/@material-ui (parent of 'core')
    path.join(reduxPath, '..'),        // node_modules/redux
    path.join(reactReduxPath, '..')    // node_modules/react-redux
];

// Inject shared paths into module resolution
sharedModulePaths.forEach(modulePath => {
    if (!Module.globalPaths.includes(modulePath)) {
        Module.globalPaths.push(modulePath);
    }
});

console.log('[Main] Configured shared module paths for plugins:', sharedModulePaths);

//
// NOTE: Firebase Analytics initialization happens in renderer process only
// Analytics is imported and initialized in app/analytics/index.js
// Main process does not need to initialize Firebase
//

// Make React faster
//const { resourcePath, devMode } = getWindowLoadSettings();
const devMode = false;
if (!devMode && process.env.NODE_ENV == null) {
    process.env.NODE_ENV = 'production';
}
const isDevelopment = isDevelopmentMode();

let mainWindow = null;
let forceQuit = false;

const store = configureStore(app);
const actions = bindActionCreators(allActions, store.dispatch);

// CRITICAL: electron-redux v2 action replay
// Listen for actions from renderer and dispatch them to main store
// This is essential for login state, installed plugins, and other renderer actions to sync to main
const IPCEvents = {
    INIT_STATE: '@@ELECTRON_REDUX/INIT_STATE',
    INIT_STATE_ASYNC: '@@ELECTRON_REDUX/INIT_STATE_ASYNC',
    ACTION: '@@ELECTRON_REDUX/ACTION'
};

// Synchronous initial state - for backward compatibility
ipcMain.on(IPCEvents.INIT_STATE, (event) => {
    console.log('[electron-redux] Renderer requested initial state (sync)');
    const state = store.getState();
    event.returnValue = JSON.stringify(state);
});

// Asynchronous initial state - preferred method
ipcMain.handle(IPCEvents.INIT_STATE_ASYNC, async () => {
    console.log('[electron-redux] Renderer requested initial state (async)');
    const state = store.getState();
    return JSON.stringify(state);
});

// CRITICAL: Replay actions from renderer to main store
ipcMain.on(IPCEvents.ACTION, (event, action) => {
    console.log('[electron-redux] Replaying action from renderer:', action.type);

    // Dispatch the action to the main store
    store.dispatch(action);

    // Broadcast to ALL renderer windows (not just sender)
    BrowserWindow.getAllWindows().forEach(win => {
        if (win.webContents !== event.sender) {
            win.webContents.send(IPCEvents.ACTION, action);
        }
    });
});

console.log('[electron-redux] IPC handlers registered for state sync and action replay');

app.appDataPath = path.join(app.getPath('appData'), 'allow2automate');

// Log plugin path configuration on startup
const pluginPathInfo = getPluginPathInfo(app);
console.log('[Main] ========== PLUGIN PATH CONFIGURATION ==========');
console.log('[Main] Environment:', pluginPathInfo.environment);
console.log('[Main] Platform:', pluginPathInfo.platform);
console.log('[Main] Current plugin path:', pluginPathInfo.currentPath);
console.log('[Main] Production path:', pluginPathInfo.productionPath);
console.log('[Main] Development path:', pluginPathInfo.developmentPath);
console.log('[Main] ====================================================');

//app.ipcMain = ipcMain;
app.epm.manager(ipcMain);

// IPC masking
app.ipcSend = (channel, ...args) => {
	console.log('plugin ipcMain send', channel, ipcMain.send);
	ipcMain.send( channel, ...args)
};

app.ipcOn = (channel, listener) => {
	console.log('plugin ipcMain on', channel);
	ipcMain.on( channel, listener)
};

app.ipcInvoke = async (channel, ...args) => {
	console.log('plugin ipcMain invoke', channel);
	return await ipcMain.invoke( channel, ...args)
};

app.ipcHandle = (channel, handler) => {
	console.log('plugin ipcMain handle', channel);
	ipcMain.handle( channel, handler)
};

ipcMain.on('getPath', (event, name) => {
	// Use plugin path utility for environment-aware path resolution
	event.returnValue = getPathByName(app, name || "appData");
});

// Secure credential storage handlers using safeStorage
// This works across Windows (DPAPI), macOS (Keychain), and Linux (libsecret)
ipcMain.handle('saveCredentials', async (event, credentials) => {
    try {
        if (!safeStorage.isEncryptionAvailable()) {
            console.warn('safeStorage encryption not available, using electron-settings fallback');
            // Fallback to electron-settings (less secure but works everywhere)
            await appConfig.set('savedCredentials', credentials);
            return { success: true };
        }

        // Encrypt credentials using platform-specific secure storage
        const encryptedEmail = safeStorage.encryptString(credentials.email);
        const encryptedPassword = safeStorage.encryptString(credentials.password);

        // Store encrypted data
        await appConfig.set('savedCredentials', {
            email: encryptedEmail.toString('base64'),
            password: encryptedPassword.toString('base64'),
            encrypted: true
        });

        return { success: true };
    } catch (error) {
        console.error('Error saving credentials:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('loadCredentials', async (event) => {
    try {
        const saved = await appConfig.get('savedCredentials');

        if (!saved) {
            return null;
        }

        // Check if credentials are encrypted
        if (saved.encrypted && safeStorage.isEncryptionAvailable()) {
            const emailBuffer = Buffer.from(saved.email, 'base64');
            const passwordBuffer = Buffer.from(saved.password, 'base64');

            return {
                email: safeStorage.decryptString(emailBuffer),
                password: safeStorage.decryptString(passwordBuffer)
            };
        }

        // Return unencrypted credentials from fallback storage
        return {
            email: saved.email || '',
            password: saved.password || ''
        };
    } catch (error) {
        console.error('Error loading credentials:', error);
        return null;
    }
});

ipcMain.handle('clearCredentials', async (event) => {
    try {
        await appConfig.unset('savedCredentials');
        return { success: true };
    } catch (error) {
        console.error('Error clearing credentials:', error);
        return { success: false, error: error.message };
    }
});

actions.deviceInit();
actions.timezoneGuess(moment.tz.guess());

var plugins = require('./plugins')(app, store, actions);

//
// Initialize agent services (network device monitoring)
//
import { initializeAgentServices } from './main-agent-integration.js';
let agentServices = null;

//
// migrate configurations < v2.0.0
//
function migrateWemo() {
    let state = store.getState();
    if ( state.devices || state.pairings ) {
        console.log('migration needed');
    }

    if (state.devices || state.pairings) {
        // move data into the wemo configuration
        actions.configurationUpdate({
            "allow2automate-wemo": {
                devices: state.devices,
                pairings: state.pairings
            }
        });
        // clean up
        actions.pairingWipe();
        actions.deviceWipe();
    }
}
migrateWemo();

//
// load plugins - OPTIMIZED FOR INSTANT MARKETPLACE READINESS
// Uses stale-while-revalidate pattern: show cached data immediately, update in background
//
(async function loadPluginLibrary() {
    const loadStartTime = Date.now();
    console.log('[Main] ⚡ Starting optimized plugin library load...');

    // Dispatch loading start action
    actions.registryLoadStart();

    try {
        // This is now non-blocking - uses cache first, then updates in background
        const pluginLibrary = await plugins.getLibraryAsync();
        const loadDuration = Date.now() - loadStartTime;

        console.log(`[Main] ✅ Loaded ${Object.keys(pluginLibrary).length} plugins in ${loadDuration}ms`);
        console.log('[Main] Plugin library keys:', Object.keys(pluginLibrary).slice(0, 5), '...');

        // Debug: Check for dev_plugin flags
        const devPluginsInMain = Object.values(pluginLibrary).filter(p => p && p.dev_plugin);
        console.log('[Main] Dev-plugins before dispatch:', devPluginsInMain.length);
        if (devPluginsInMain.length > 0) {
            devPluginsInMain.forEach(p => {
                console.log('[Main]   -', p.name, '(dev_plugin:', p.dev_plugin, ')');
            });
        }

        // Update plugin library
        actions.libraryReplace(pluginLibrary);

        // Dispatch success with cache metadata
        actions.registryLoadSuccess({
            isFromCache: pluginLibrary._fromCache || false,
            cacheTimestamp: pluginLibrary._cacheTimestamp || null
        });

        // Verify state update (non-blocking)
        setTimeout(() => {
            const currentState = store.getState();
            console.log('[Main] State verification - pluginLibrary keys:',
                currentState.pluginLibrary ? Object.keys(currentState.pluginLibrary).length : 'undefined');
            console.log('[Main] Registry loading state:', currentState.marketplace && currentState.marketplace.registryLoading);

            // WORKAROUND: Force re-dispatch to ensure renderer gets the plugins
            // This handles the electron-redux v2 sync timing issue
            console.log('[Main] Force re-dispatching LIBRARY_REPLACE to ensure renderer sync...');
            actions.libraryReplace(currentState.pluginLibrary);
        }, 500);
    } catch (err) {
        const loadDuration = Date.now() - loadStartTime;
        console.error(`[Main] ❌ Error loading plugin library (${loadDuration}ms):`, err.message);

        // Dispatch error action
        actions.registryLoadFailure({
            errorMessage: err.message,
            errorCode: err.code,
            timestamp: Date.now()
        });

        console.log('[Main] Using fallback plugin library');
        // Use fallback library if registry fails
        const fallbackLibrary = {
            '@allow2/allow2automate-wemo': {
                name: '@allow2/allow2automate-wemo',
                shortName: 'wemo',
                publisher: 'allow2',
                description: 'Control WeMo smart devices',
                category: 'iot',
                releases: { latest: '0.0.4' }
            },
            '@allow2/allow2automate-ssh': {
                name: '@allow2/allow2automate-ssh',
                shortName: 'ssh',
                publisher: 'allow2',
                description: 'SSH device control',
                category: 'connectivity',
                releases: { latest: '0.0.2' }
            }
        };
        actions.libraryReplace(fallbackLibrary);
    }
})();

plugins.getInstalled((err, installedPlugins) => {
    if (err) {
        console.log('[Plugins] Error getting installed plugins:', err);
        return;
    }

    console.log('[Plugins] Found installed plugins:', Object.keys(installedPlugins || {}).length);
    if (installedPlugins && Object.keys(installedPlugins).length > 0) {
        console.log('[Plugins] Installed plugin names:', Object.keys(installedPlugins));
    }

    // Dispatch action to update store
    actions.installedPluginReplace(installedPlugins);
    console.log('[Plugins] Dispatched installedPluginReplace action to main store');

    // Verify it's in the store
    const currentState = store.getState();
    console.log('[Plugins] Installed plugins in main store:', Object.keys(currentState.installedPlugins || {}).length);
});

// seed test data
function testData() {

    actions.configurationUpdate({
        "allow2automate-battle.net": {
            plugin: "allow2automate-battle.net",
            data: {
                cody: {
                    name: "Cody",
                    url: "https://us.battle.net/account/parental-controls/manage.html?key=GF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    key: "GF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    childId: 3
                },
                mandy: {
                    name: "Mandy",
                    url: "https://us.battle.net/account/parental-controls/manage.html?key=dF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    key: "dF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    childId: 4
                }
            }
        },
        "allow2automate-blah.net": {
            plugin: "allow2automate-blah.net",
            data: {
                name: "dfred"
            }
        },
        "allow2automate-ssh": {
            plugin: "allow2automate-ssh",
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
    });
}
//testData();

//console.log('setup 1', ipcMain.on, ipcMain.send, ipcMain.invoke, ipcMain.handle);
ipcMain.on('saveState', function(event, params) {
    store.save();
});
// ipcMain.handle('handleTest', function(event, params) {
// 	return 1;
// });
// ipcMain.send('sendTest', "bob");
// ipcMain.invoke('invokeTest', "bob");

//console.log('setup 2');

const installExtensions = async () => {
    const installer = require('electron-devtools-installer');
    const extensions = [
        'REACT_DEVELOPER_TOOLS',
        'REDUX_DEVTOOLS'
    ];
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    for (const name of extensions) {
        try {
            await installer.default(installer[name], forceDownload);
        } catch (e) {
            console.log(`Error installing ${name} extension: ${e.message}`);
        }
    }
};

crashReporter.start({
    productName: 'Allow2Automate',
    companyName: 'Allow2',
    submitURL: 'https://api.allow2.com/crashReport',
    uploadToServer: false
});

const template = [
    {
        label: 'Edit',
        submenu: [
            {role: 'cut'},
            {role: 'copy'},
            {role: 'paste'}
        ]
    },
    {
        role: 'window',
        submenu: [
            {
                role: 'minimize'
            },
            {
                role: 'close'
            }
        ]
    }
    //,
    //{
    //    role: 'help',
    //    submenu: [
    //        {
    //            label: 'Learn More',
    //            click () { require('electron').shell.openExternal('http://electron.atom.io') }
    //        }
    //    ]
    //}
];

app.on('window-all-closed', () => {
    // Track app shutdown before quitting
    // Note: Analytics tracking happens in renderer, so we send an IPC message
    // to trigger tracking before the window closes
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send('app-shutting-down');
    }

    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

async function windowStateKeeper(windowName) {
    let window, windowState;

    // Restore from appConfig (electron-settings v4 requires await)
    if (await appConfig.has(`windowState.${windowName}`)) {
        windowState = await appConfig.get(`windowState.${windowName}`);
        console.log(`[WindowState] Restored ${windowName} window state:`, windowState);
    } else {
        // Default
        windowState = {
            x: undefined,
            y: undefined,
            width: 1000,    //660
            height: 800
        };
        console.log(`[WindowState] Using default ${windowName} window state:`, windowState);
    }

    async function saveState() {
        if (!windowState.isMaximized) {
            windowState = window.getBounds();
        }
        windowState.isMaximized = window.isMaximized();
        // electron-settings v4 returns a Promise - await it
        await appConfig.set(`windowState.${windowName}`, windowState);
        console.log(`[WindowState] Saved ${windowName} window state:`, windowState);
    }

    function track(win) {
        window = win;
        ['resize', 'move', 'close'].forEach(event => {
            win.on(event, saveState);
        });
    }

    return({
        x: windowState.x,
        y: windowState.y,
        width: windowState.width,
        height: windowState.height,
        isMaximized: windowState.isMaximized,
        track,
    });
}

app.on('ready', async () => {

    var pollTimer = null;
    var usageTimer = null;

    if (isDevelopment) {
        await installExtensions();
    }

    // Initialize agent services for network device monitoring
    try {
        console.log('[Main] Starting agent services initialization...');
        agentServices = await initializeAgentServices(app, store, actions);
        console.log('[Main] ✅ Agent services initialized successfully');
    } catch (error) {
        console.error('[Main] ❌ Failed to initialize agent services:', error);
        console.error('[Main] Error stack:', error.stack);
        // Continue without agent services - they are optional
    }

    if (process.platform === 'darwin') {
        template.unshift({
            label: 'Allow2Automate', //app.getName(),
            submenu: [
                {role: 'about'},
                {type: 'separator'},
                {
                    label: 'Preferences...',
                    accelerator: 'CmdOrCtrl+,',
                    click () { showMainWindow() }
                },
                {type: 'separator'},
                {role: 'services'},
                {type: 'separator'},
                {role: 'hide'},
                {role: 'hideothers'},
                {role: 'unhide'},
                {type: 'separator'},
                {role: 'quit'}
            ]
        });
        const menu = Menu.buildFromTemplate(template)
        Menu.setApplicationMenu(menu)
    }

    const mainWindowStateKeeper = await windowStateKeeper('main');

    function showMainWindow() {
        if (mainWindow) {
            return mainWindow.show();
        }
        mainWindow = new BrowserWindow({
            x: mainWindowStateKeeper.x,
            y: mainWindowStateKeeper.y,
            width: mainWindowStateKeeper.width,
            height: mainWindowStateKeeper.height,
            minWidth: 640,
            minHeight: 480,
            show: false,
            title: 'Allow2Automate',
            icon: path.join(__dirname, 'assets/icons/png/64x64.png'),
            webPreferences: {
	            nodeIntegration: true,
	            contextIsolation: false,
                enableRemoteModule: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });

        mainWindow.loadURL(url.format({
            pathname: path.join(__dirname, 'index.html'),
            protocol: 'file:',
            slashes: true
        }));

        mainWindowStateKeeper.track(mainWindow);

        // Restore maximized state if it was maximized before
        if (mainWindowStateKeeper.isMaximized) {
            mainWindow.maximize();
        }

        // show window once on first load
        mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.show();
        });

        mainWindow.webContents.on('did-finish-load', () => {
            // CRITICAL FIX: electron-redux v2 is completely broken for forwarding actions
            // Bypass it entirely and send plugin library directly via IPC
            setTimeout(() => {
                const currentState = store.getState();
                if (currentState.pluginLibrary && Object.keys(currentState.pluginLibrary).length > 0) {
                    console.log('[Main] Renderer ready - sending plugin library via IPC with', Object.keys(currentState.pluginLibrary).length, 'plugins');

                    // Send directly to renderer via IPC
                    if (mainWindow && mainWindow.webContents) {
                        mainWindow.webContents.send('PLUGIN_LIBRARY_SYNC', {
                            type: 'LIBRARY_REPLACE',
                            payload: currentState.pluginLibrary
                        });
                    }
                }
            }, 1000); // Give renderer 1 second to fully initialize

            // Handle window logic properly on macOS:
            // 1. App should not terminate if window has been closed
            // 2. Click on icon in dock should re-open the window
            // 3. ⌘+Q should close the window and quit the app
            if (process.platform === 'darwin') {
                mainWindow.on('close', function (e) {
                    store.save();
                    if (!forceQuit) {
                        e.preventDefault();
                        mainWindow.hide();
                    }
                });

                app.on('activate', () => {
                    mainWindow.show();
                });

                app.on('before-quit', () => {
                    store.save();
                    forceQuit = true;
                });
            } else {
                mainWindow.on('closed', () => {
                    console.log('Persisting');
                    store.save();
                    mainWindow = null;
                });
            }
        });

        if (isDevelopment) {
            // auto-open dev tools
            mainWindow.webContents.openDevTools();

            // add inspect element on right click menu
            mainWindow.webContents.on('context-menu', (e, props) => {
                Menu.buildFromTemplate([{
                    label: 'Inspect element',
                    click() {
                        mainWindow.inspectElement(props.x, props.y);
                    }
                }]).popup(mainWindow);
            });
        }
    }
    showMainWindow();

    function pollInfo() {
        let state = store.getState();
        console.log("polling info");
        if (state && state.user && state.user.access_token) {
            allow2Request('/rest/info',
                {
                    auth: {
                        bearer: state.user.access_token
                    },
                    body: {}
                },

                function (error, response, body) {
                    if (error) {
                        return console.log(error.toString());
                    }
                    if (!response) {
                        return console.log('Invalid Response');
                    }
                    if (response.statusCode == 403) {
                        console.log('kicked out');
                        actions.logout();
                        mainWindow.webContents.send('loggedOut');
                        return
                    }
                    if (body && body.message) {
                        return console.log("body:", body.message);
                    }
                    return console.log('Oops');
                },

                function (data) {
                    actions.newData(data);
                });
        }
    }
    pollInfo();
    pollTimer = setInterval(pollInfo, 30000);

    function pollUsage() {
        let state = store.getState();

        // let activeDevices = Object.values(state.devices).filter(function(device) {
        //     return device.state;
        // });
        // let pollDevices = activeDevices.reduce(function(memo, device) {
        //     let pairing = state.pairings[device.device.UDN];
        //     if (pairing) {
        //         pairing.device = device.device;
        //         memo.push(pairing);
        //     }
        //     return memo;
        // }, []);
        // async.each(pollDevices, function(device, callback) {
        //     console.log('poll', device.name);
        //     const params = {
        //         userId: device.controllerId,
        //         pairId: device.id,
        //         deviceToken: device.deviceToken,
        //         pairToken: device.pairToken,
        //         childId: device.ChildId,
        //         tz: state.util.timezoneGuess,
        //         activities: [{
        //             id: 7,
        //             log: true
        //         }],
        //         //log: true 			// default is true,
        //         //staging: true		// default is production
        //     };
        //
        //     //console.log(params);
        //
        //     allow2.check(params, function(err, result) {
        //         if (err) { return; }    // simple bail out if any errors occur to avoid user not being able to turn on things
        //
        //         if (!result.allowed) {
        //             // only need to grab the client to turn it off
        //             if (result.error && (result.error == 'invalid pairToken' )) {
        //                 actions.pairingRemove(device.device.UDN);
        //                 store.save();
        //                 return;
        //             }
        //             console.log( device.device.device.friendlyName, ' not allowed ', result );
        //             devices.setBinaryState(device.device.UDN, 0, () => {});
        //             return;
        //         }
        //         console.log(device.name, ' is on / running');
        //         // interpret the result and if not allowed, turn the light back off again!
        //     });
        //     callback(null);
        // }, function(err) {
        //     console.log('poll done', err);
        // });
    }
    pollUsage();
    usageTimer = setInterval(pollUsage, 10000);

});
