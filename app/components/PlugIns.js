import React, { Component } from 'react';
import Avatar from 'material-ui/Avatar';
import FlatButton from 'material-ui/FlatButton';
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

const apiUrl = 'https://api.allow2.com/';

var dialogs = Dialogs({});

export default class PlugIns extends Component {

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

    installPlugin = (plugin) => {

    };

    deletePlugin = () => {

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
                            let version = (plugin.installed && plugin.installed.version) || "";

                            return (
                                <TableRow
                                    key={plugin.name}
                                    selectable={true}>
                                    <TableRowColumn>
                                        <span>{plugin.name}</span>
                                    </TableRowColumn>
                                    <TableRowColumn>
                                        {plugin.installed &&
                                        <span>{version}</span>
                                        }
                                        { !plugin.installed &&
                                        <FlatButton label="Install" onClick={this.installPlugin.bind(this, plugin)}/>
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