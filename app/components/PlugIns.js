import React, { Component } from 'react';
import Avatar from 'material-ui/Avatar';
import FlatButton from 'material-ui/FlatButton';
import TextField from 'material-ui/TextField';
import { sortedVisibleConfigurationsByPluginSelector } from '../selectors';
import { allow2Request, allow2AvatarURL } from '../util';
import Dialogs from 'dialogs';
import Checkbox from './Checkbox';
//import deviceActions from '../actions/plugin';
//import modal from 'electron-modal';
import path from 'path';
import url from 'url';
import { remote, ipcRenderer as ipc } from 'electron';
import {
    Table,
    TableBody,
    TableHeader,
    TableHeaderColumn,
    TableRow,
    TableRowColumn,
    } from 'material-ui/Table';
import {Tabs, Tab} from 'material-ui/Tabs';
const epm = require('electron-plugin-manager');
const dir = path.join(remote.app.getPath('appData'), 'allow2automate');
const fs = require('fs');

const apiUrl = 'https://api.allow2.com/';

var dialogs = Dialogs({});

export default class PlugIns extends Component {

    handleChange = (event) => {
        this.setState({
            pluginName: event.target.value
        });
    };

    constructor(...args) {
        super(...args);

        this.state = {
            device: null,
            token: null,
            pairing: false,
            pluginName: ''
        };
    }
    messageDevices = {};

    toggleCheckbox = (device, isChecked) => {
        this.props.onDeviceActive( device.device.UDN, true );
        ipc.send('setBinaryState', {
            UDN: device.device.UDN,
            state: isChecked ? 1 : 0
        });
    };

    componentDidMount = () => {
        ipc.on('setBinaryStateResponse', function (event, UDN, err, response) {
            let device = this.props.devices[UDN];
            this.props.onDeviceActive(UDN, false);
            if (err || ( response.BinaryState == undefined )) {
                return;
            }
            device.active = false;
            device.state = ( response.BinaryState != '0' );
            this.props.onDeviceUpdate({[UDN]: device});
        }.bind(this));
    };


    addPlugin = () => {
        const pluginName = this.state.pluginName;
        const onPluginInstalled = this.props.onPluginInstalled.bind(this);
        ipc.on('epm-installed-' + pluginName, (event, err, pluginPath) => {
            console.log(event, err, pluginPath);
            if (err) {
                return;
            }
            epm.load(dir, pluginName, remote.require);
            // In renderer process
            fs.readFile(path.join(pluginPath, 'package.json'), 'utf8', (err, jsonString) => {
                if (err) {
                    console.log("File read failed:", err);
                    return
                }
                try {
                    const packageJson = JSON.parse(jsonString);
                    //console.log("package.json:", packageJson); // => "Customer address is: Infinity Loop Drive"
                    packageJson.name = pluginName;
                    onPluginInstalled({ [pluginName] : packageJson });

                } catch(err) {
                    console.log('Error parsing JSON string', err, jsonString);
                }
            });
        });
        ipc.send('epm-install', dir, this.state.pluginName, 'latest');
        return;

        //let onPaired = this.props.onPaired;
        //function openModal() {
        let win = new remote.BrowserWindow({
            parent: remote.getCurrentWindow(),
            modal: true,
            width: 500,
            height: 600,
            minWidth: 500,
            maxWidth: 500,
            minHeight: 600,
            maxHeight: 800
        });


        //win.loadURL(theUrl);
        win.loadURL(url.format({
            pathname: path.join(__dirname, '../addPlugin.html'),
            protocol: 'file:',
            slashes: true
        }));

        win.webContents.on('did-finish-load', () => {
            win.webContents.send('data', { plugins: visibleConfigurationsByPluginSelector(this.props) });
        });

        //win.webContents.openDevTools();
    };

    reinstallPlugin = (plugin) => {

    };

    deletePlugin = (plugin) => {
        console.log(JSON.stringify(plugin));
        dialogs.confirm('Are you sure you want to delete ' + plugin.name + '?', function(ok) {
            if (!ok) {
                return
            }
            console.log('delete');
        }.bind(this));

        return;
        // need to decommission if the plugin is operational
        // then unload it?
        epm.unload(dir, plugin.name, remote.require);
        // then delete it.
        ipc.on('epm-uninstalled-' + pluginName, (event, err, pluginPath) => {
            console.log(event, err, pluginPath);
            if (err) {
                return;
            }
            try {
                const packageJson = JSON.parse(jsonString);
                //console.log("package.json:", packageJson); // => "Customer address is: Infinity Loop Drive"
                onPluginRemoved({ pluginName : packageJson });
            } catch(err) {
                console.log('Error parsing JSON string', err, jsonString);
            }
        });
        ipc.send('epm-uninstalled', dir, this.state.pluginName, 'latest');
    };

    toggleCheckbox = (device, isChecked) => {
        // this.props.onDeviceActive( device.device.UDN, true );
        // ipc.send('setBinaryState', {
        //     UDN: device.device.UDN,
        //     state: isChecked ? 1 : 0
        // });
    };

    render() {
        let plugins = sortedVisibleConfigurationsByPluginSelector(this.props);
        console.log(plugins);
        return (
            <div>
                <div style={{ textAlign: "center" }}>
                    <TextField id="pluginName" label="Plugin" value={this.state.pluginName} onChange={this.handleChange.bind(this)} />
                    <FlatButton label="Add Plugin" onClick={this.addPlugin.bind(this)}/>
                </div>
                { plugins.length > 0 &&
                <Table>
                    <TableHeader>
                        <TableRow key="HeaderRow">
                            <TableHeaderColumn> <span>Plugin</span> </TableHeaderColumn>
                            <TableHeaderColumn> <span>Installed Version</span> </TableHeaderColumn>
                            <TableHeaderColumn> <span>Enable</span> </TableHeaderColumn>
                            <TableHeaderColumn> <span>x</span> </TableHeaderColumn>
                        </TableRow>
                    </TableHeader>
                    <TableBody
                        displayRowCheckbox={false}
                        showRowHover={true}
                        stripedRows={true}>
                        { plugins.map(function (plugin) {
                            let version = (plugin.installed && plugin.version) || "";

                            return (
                                <TableRow
                                    key={plugin.name}
                                    selectable={true}>
                                    <TableRowColumn>
                                        <span>{plugin.name}</span>
                                    </TableRowColumn>
                                    <TableRowColumn>
                                        {plugin.version &&
                                        <span>{plugin.version}</span>
                                        }
                                        { !plugin.version &&
                                        <FlatButton label="Install" onClick={this.reinstallPlugin.bind(this, plugin)}/>
                                        }
                                    </TableRowColumn>
                                    <TableRowColumn style={{textAlign: 'center'}}>
                                        { plugin.installed &&
                                        <Checkbox
                                            label=''
                                            isChecked={!plugin.disabled}
                                            handleCheckboxChange={this.toggleCheckbox.bind(this, plugin)}
                                        />
                                        }
                                    </TableRowColumn>
                                    <TableRowColumn>
                                        <FlatButton label="Delete" onClick={this.deletePlugin.bind(this, plugin)}/>
                                    </TableRowColumn>
                                </TableRow>
                            );
                        }.bind(this)
                        )}
                    </TableBody>
                </Table>
                }
            </div>
        );

    }
}

// <p style={{ width:"75%", margin: "auto" }}>Configure a plugin to control other devices.</p>
// <Table>
//                     <TableBody
//                         displayRowCheckbox={false}
//                         showRowHover={true}
//                         stripedRows={true}>
//                         { installed.map(function (plugin) {
//                                 return (
//                                     <TableRow
//                                         key={plugin}
//                                         selectable={false}>
//                                         <TableRowColumn>
//                                             <span>{plugin}</span>
//                                         </TableRowColumn>
//
//                                     </TableRow>
//                                 );
//                             }.bind(this)
//                         )}
//                     </TableBody>
//                 </Table>