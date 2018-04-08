import { app, crashReporter, BrowserWindow, Menu } from 'electron';
import { enableLiveReload } from 'electron-compile';
import installExtension, { REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS} from 'electron-devtools-installer';
import path from 'path';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;
let forceQuit = false;

const isDevMode = process.execPath.match(/[\\/]electron/);

if (isDevMode) enableLiveReload({ strategy: 'react-hmr' });

//const installExtensions = async () => {
//    const installer = require('electron-devtools-installer');
//    const extensions = [
//        'REACT_DEVELOPER_TOOLS',
//        'REDUX_DEVTOOLS'
//    ];
//    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
//    for (const name of extensions) {
//        try {
//            await installer.default(installer[name], forceDownload);
//        } catch (e) {
//            console.log(`Error installing ${name} extension: ${e.message}`);
//        }
//    }
//};

crashReporter.start({
    productName: 'Allow2Automate',
    companyName: 'Allow2',
    submitURL: 'https://staging-api.allow2.com/crashReport',
    uploadToServer: false
});

const createWindow = async() => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        icon: path.join(__dirname, 'assets/icons/png/64x64.png')
    });

    // and load the index.html of the app.
    mainWindow.loadURL(`file://${__dirname}/index.html`);

    // Open the DevTools.
    if (isDevMode) {
        //await installExtensions;
        await installExtension(REACT_DEVELOPER_TOOLS);
        await installExtension(REDUX_DEVTOOLS);
        mainWindow.webContents.openDevTools();
    }

    // Emitted when the window is closed.
    //mainWindow.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    //});
};


let template = [
    {
        label: 'Menu 1',
        submenu: [{
            label: 'Menu Item 1'
        }]
    }, {
        label: 'View',
        submenu: [
            {role: 'reload'},
            {role: 'forcereload'},
            {role: 'toggledevtools'},
            {type: 'separator'},
            {role: 'resetzoom'},
            {role: 'zoomin'},
            {role: 'zoomout'},
            {type: 'separator'},
            {role: 'togglefullscreen'}
        ]
}];

if (process.platform === 'darwin') {
    const name = app.getName();
    template.unshift({
        label: name,
        submenu: [{
            role: 'about'
        },{
            type: 'separator'
        },{
            role: 'quit'
        },{
            label: 'Quit',
            accelerator: 'Command+Q',
            click: function() {
                app.quit();
            }
        }]
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
