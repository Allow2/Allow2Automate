import path from 'path';
import url from 'url';
import { app, crashReporter, BrowserWindow, Menu, ipcMain } from 'electron';
import allActions from './actions';
import configureStore from './mainStore';
import { allow2Request } from './util';
import { bindActionCreators } from 'redux';
const async = require('async');
var allow2 = require('allow2');
var moment = require('moment-timezone');
app.epm = require('electron-plugin-manager');
const appConfig = require('electron-settings');

// Make React faster
//const { resourcePath, devMode } = getWindowLoadSettings();
const devMode = false;
if (!devMode && process.env.NODE_ENV == null) {
    process.env.NODE_ENV = 'production';
}
const isDevelopment = (process.env.NODE_ENV === 'development');

let mainWindow = null;
let forceQuit = false;

const store = configureStore();
const actions = bindActionCreators(allActions, store.dispatch);

app.appDataPath = path.join(app.getPath('appData'), 'allow2automate');

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
	event.returnValue = app.getPath(name || "appData");
});

actions.deviceInit();
actions.timezoneGuess(moment.tz.guess());

var plugins = require('./plugins')(app, store, actions);

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
// load plugins
//
plugins.getLibrary((err, pluginLibrary) => {
    // console.log('pluginLibrary', pluginLibrary);
    if (err) {
        console.log('plugins.getLibrary', err);
        return;
    }
    actions.libraryReplace(pluginLibrary);
});

plugins.getInstalled((err, installedPlugins) => {
    //console.log('installedPlugins', installedPlugins);
    if (err) {
        console.log('plugins.getInstalled', err);
        return;
    }
    actions.installedPluginReplace(installedPlugins);
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
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

function windowStateKeeper(windowName) {
    let window, windowState;
    function setBounds() {
        // Restore from appConfig
        if (appConfig.has(`windowState.${windowName}`)) {
            windowState = appConfig.get(`windowState.${windowName}`);
            return;
        }
        // Default
        windowState = {
            x: undefined,
            y: undefined,
            width: 1000,    //660
            height: 800
        };
    }
    function saveState() {
        if (!windowState.isMaximized) {
            windowState = window.getBounds();
        }
        windowState.isMaximized = window.isMaximized();
        appConfig.set(`windowState.${windowName}`, windowState);
    }
    function track(win) {
        window = win;
        ['resize', 'move', 'close'].forEach(event => {
            win.on(event, saveState);
        });
    }
    setBounds();
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

    const mainWindowStateKeeper = windowStateKeeper('main');

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

        // show window once on first load
        mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.show();
        });

        mainWindow.webContents.on('did-finish-load', () => {
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
