import React, { Component } from 'react';
import Avatar from 'material-ui/Avatar';
import FlatButton from 'material-ui/FlatButton';
import TextField from 'material-ui/TextField';
import {
    sortedVisibleConfigurationsByPluginSelector,
    sortedVisibleConfigurationsSelector,
    visibleConfigurationsByPluginSelector,
    visibleConfigurationsByActivePluginSelector,
    sortedVisibleConfigurationsByActivePluginSelector
} from '../selectors';
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


    installPlugin = (pluginName) => {
        const onPluginInstalled = this.props.onPluginInstalled.bind(this);
        ipc.on('epm-installed-' + pluginName, (event, err, pluginPath) => {
            //console.log(event, err, pluginPath);
            if (err) {
                dialogs.alert("Unable to find " + pluginName + ': ' + JSON.stringify(err));
                return;
            }
            //epm.load(dir, pluginName, remote.require);
            // In renderer process
            fs.readFile(path.join(pluginPath, 'package.json'), 'utf8', (err, jsonString) => {
                if (err) {
                    console.log("Package.json read failed:", err);
                    dialogs.alert("Package.json read failed:", err.toString());
                    return
                }
                try {
                    const packageJson = JSON.parse(jsonString);
                    //console.log("package.json:", packageJson); // => "Customer address is: Infinity Loop Drive"
                    packageJson.name = pluginName;
                    onPluginInstalled({ [pluginName] : packageJson });

                } catch(err) {
                    console.log('Error parsing JSON string', err, jsonString);
                    dialogs.alert("Error reading package.json:", err.toString());
                }
            });
        });
        ipc.send('epm-install', dir, pluginName, 'latest');
    };

    addPlugin = () => {
        const pluginName = 'allow2automate-' + this.state.pluginName;

        if (this.props.installedPlugins[pluginName]) {
            dialogs.alert(pluginName + ' is already installed. Remove it first if you want to reinstall it.');
            return;
        }
        console.log('install', pluginName);
        this.installPlugin(pluginName);
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
        console.log('reinstall', plugin.name);
        this.installPlugin(plugin.name);
    };

    deletePlugin = (plugin) => {
        const onPluginRemoved = this.props.onPluginRemoved.bind(this);
        const pluginName = plugin.name;
        const hasConfigurations = Object.values(this.props.configurations).find((configuration) => {
            return configuration.plugin === pluginName;
        });

        const actualDelete = function(removeConfiguration) {
            // need to decommission if the plugin is operational
            // then unload it?
            console.log('unload', pluginName);
            epm.unload(dir, pluginName, remote.require);
            // then delete it.
            ipc.on('epm-uninstalled-' + pluginName, (event, err) => {
                console.log('uninstalled', event, err);
                if (err) {
                    dialogs.alert(err.toString());
                    return;
                }
                onPluginRemoved({ pluginName : pluginName, removeConfiguration : removeConfiguration });
            });
            console.log('uninstalling', pluginName);
            ipc.send('epm-uninstall', dir, pluginName);
        };

        if (plugin.missing) {
            dialogs.confirm('Are you sure you want to remove ' + plugin.name + ' configurations?', function(ok) {
                if (!ok) {
                    return
                }
                onPluginRemoved({ pluginName : plugin.name, removeConfiguration : true });
            }.bind(this));
            return;
        }
        dialogs.confirm('Are you sure you want to delete the ' + plugin.name + ' plugin?', function(ok) {
            if (!ok) {
                return
            }
            if (!hasConfigurations) {
                return actualDelete(true);
            }
            dialogs.confirm('Keep your  ' + plugin.name + ' configurations?', function(ok) {
                if (ok) {
                    return actualDelete(false);
                }

                dialogs.confirm('So delete the ' + plugin.name + 'plugin, and associated configurations?', function(ok) {
                    if (ok) {
                        return actualDelete(true);
                    }
                }.bind(this));
            }.bind(this));
        }.bind(this));
    };

    toggleCheckbox = (plugin, isChecked) => {
        this.props.onSetPluginEnabled( plugin.name, isChecked );
        // ipc.send('setBinaryState', {
        //     UDN: device.device.UDN,
        //     state: isChecked ? 1 : 0
        // });
    };

    render() {
        let plugins = sortedVisibleConfigurationsByPluginSelector(this.props);
        let customStyle = {width: 80, textAlign: 'center'};
        return (
            <div>
                <div style={{ textAlign: "center" }}>
                    allow2automate-
                    <TextField id="pluginName" label="Plugin" value={this.state.pluginName} onChange={this.handleChange.bind(this)} />
                    <FlatButton label="Add Plugin" onClick={this.addPlugin.bind(this)}/>
                </div>
                { plugins.length > 0 &&
                <Table>
                    <TableHeader>
                        <TableRow key="HeaderRow">
                            <TableHeaderColumn> <span>Plugin</span> </TableHeaderColumn>
                            <TableHeaderColumn style={customStyle}> <span>Installed Version</span> </TableHeaderColumn>
                            <TableHeaderColumn style={customStyle}> <span>Enabled</span> </TableHeaderColumn>
                            <TableHeaderColumn style={customStyle}> <span>Delete</span> </TableHeaderColumn>
                        </TableRow>
                    </TableHeader>
                    <TableBody
                        displayRowCheckbox={false}
                        showRowHover={true}
                        stripedRows={true}>
                        { plugins.map(function (plugin) {
                            console.log(plugin);
                            let version = (plugin.version) || "";

                            return (
                                <TableRow
                                    key={plugin.name}
                                    selectable={true}>
                                    <TableRowColumn>
                                        <span>{plugin.name}</span>
                                    </TableRowColumn>
                                    <TableRowColumn style={customStyle}>
                                        {!plugin.missing &&
                                        <span>{version}</span>
                                        }
                                        { plugin.missing &&
                                        <FlatButton label="Reinstall" onClick={this.reinstallPlugin.bind(this, plugin)}/>
                                        }
                                    </TableRowColumn>
                                    <TableRowColumn style={customStyle}>
                                        { !plugin.missing &&
                                        <Checkbox
                                            label=''
                                            isChecked={!plugin.disabled}
                                            handleCheckboxChange={this.toggleCheckbox.bind(this, plugin)}
                                        />
                                        }
                                    </TableRowColumn>
                                    <TableRowColumn style={customStyle}>
                                        <FlatButton label={ plugin.missing ? "Remove" : "Delete" }
                                            onClick={this.deletePlugin.bind(this, plugin)}/>
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
