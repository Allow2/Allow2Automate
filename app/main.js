import path from 'path';
import url from 'url';
import {app, crashReporter, BrowserWindow, Menu, ipcMain as ipc} from 'electron';
import allActions from './actions';
const modal = require('electron-modal');
import configureStore from './mainStore';
import { allow2Request } from './util';
import { bindActionCreators } from 'redux';
const async = require('async');
var allow2 = require('allow2');
import Wemo from './util/Wemo';
var moment = require('moment-timezone');

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

require('./compile-cache');
require('./module-cache');

actions.deviceInit();
actions.timezoneGuess(moment.tz.guess());

//var plugins = require('./plugins')(app);


// seed test data
// actions.pluginUpdate({
//     "d23eb9da-19d6-4898-b56c-02a5a8ca477f": {
//         plugin: "battle.net",
//         data: {
//             name: "Cody",
//             url: "https://us.battle.net/account/parental-controls/manage.html?key=GF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
//             key: "GF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
//             childId: 3
//         }
//     },
//     "2742b8a4-c6e9-416b-9d30-cc7618f5d1b5": {
//         plugin: "battle.net",
//         data: {
//             name: "Mandy",
//             url: "https://us.battle.net/account/parental-controls/manage.html?key=dF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
//             key: "dF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
//             childId: 4
//         }
//     },
//     "9710629a-b82b-436c-8e3c-635861347ba0": {
//         plugin: "ssh",
//         data: {
//             name: "Router",
//             host: "192.168.0.3",
//             creds: {
//                 user: 'user',
//                 pass: 'pass'
//                 //key: '98y89463087gfp938g74fp9784tgf3'
//             },
//             childId: 4,
//             actions: {
//                 4: {
//                     3: {
//                         on: './enable.sh',
//                         off: './disable.sh'
//                     }
//                 }
//             }
//         }
//     }
// });

var devices = new Wemo(
    {
        onDeviceUpdate: (data) => {
            console.log('deviceUpdate');
            actions.deviceUpdate(data);
        }
    }
);

ipc.on('setBinaryState', function(event, params) {
    console.log('setBinaryState', params);
    devices.setBinaryState(params.UDN, params.state, function(err, response) {
        console.log('response:', params.UDN, response);
        event.sender.send('setBinaryStateResponse', params.UDN, err, response);
    }.bind(this));
});

ipc.on('saveState', function(event, params) {
    store.save();
});

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

app.on('ready', async () => {

    // Run this on the ready event to setup everything
    // needed on the main process.
    modal.setup();

    var pollTimer = null;
    var usageTimer = null;

    if (isDevelopment) {
        await installExtensions();
    }

    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                {role: 'about'},
                {type: 'separator'},
                {
                    label: 'Preferences...',
                    accelerator: 'CmdOrCtrl+,',
                    click () { showMainWindow() }
                },
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

    function showMainWindow() {
        if (mainWindow) {
            return mainWindow.show();
        }
        mainWindow = new BrowserWindow({
            width: 660,
            height: 800,
            minWidth: 640,
            maxWidth: 660,
            minHeight: 480,
            show: false,
            title: 'Allow2Automate',
            icon: path.join(__dirname, 'assets/icons/png/64x64.png')
        });

        mainWindow.loadURL(url.format({
            pathname: path.join(__dirname, 'index.html'),
            protocol: 'file:',
            slashes: true
        }));

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
                        return console.log(body.message);
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

        let activeDevices = Object.values(state.devices).filter(function(device) {
            return device.state;
        });
        let pollDevices = activeDevices.reduce(function(memo, device) {
            let pairing = state.pairings[device.device.UDN];
            if (pairing) {
                pairing.device = device.device;
                memo.push(pairing);
            }
            return memo;
        }, []);
        async.each(pollDevices, function(device, callback) {
            console.log('poll', device.name);
            allow2.check({
                userId: device.controllerId,
                pairId: device.id,
                deviceToken: device.deviceToken,
                pairToken: device.pairToken,
                childId: device.ChildId,
                tz: state.util.timezoneGuess,
                activities: [{
                    id: 7,
                    log: true
                }],
                //log: true 			// default is true,
                //staging: true		// default is production
            }, function(err, result) {
                if (err) { return; }    // simple bail out if any errors occur to avoid user not being able to turn on things

                if (!result.allowed) {
                    // only need to grab the client to turn it off
                    if (result.error && (result.error == 'invalid pairToken' )) {
                        actions.pairingRemove(device.device.UDN);
                        store.save();
                        return;
                    }
                    console.log( device.device.device.friendlyName, ' not allowed ', result );
                    devices.setBinaryState(device.device.UDN, 0, () => {});
                    return;
                }
                console.log(device.name, ' is on / running');
                // interpret the result and if not allowed, turn the light back off again!
            });
            callback(null);
        }, function(err) {
            console.log('poll done', err);
        });
    }
    pollUsage();
    usageTimer = setInterval(pollUsage, 10000);
});
