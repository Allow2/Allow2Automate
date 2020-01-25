import React, { Component } from 'react';
import Avatar from 'material-ui/Avatar';
import FlatButton from 'material-ui/FlatButton';
import { visibleConfigurationsByPluginSelector, sortedVisibleConfigurationsByPluginSelector } from '../selectors';
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
import configuration from "../actions/configuration";
//import manager from '../package-manager';

const apiUrl = 'https://api.allow2.com/';

var dialogs = Dialogs({});

export default class PlugIns extends Component {

    // toggleCheckbox = (device, isChecked) => {
    //     this.props.onDeviceActive( device.device.UDN, true );
    //     ipc.send('setBinaryState', {
    //         UDN: device.device.UDN,
    //         state: isChecked ? 1 : 0
    //     });
    // };

    // componentDidMount = () => {
    //     ipc.on('setBinaryStateResponse', function (event, UDN, err, response) {
    //         let device = this.props.devices[UDN];
    //         this.props.onDeviceActive(UDN, false);
    //         if (err || ( response.BinaryState == undefined )) {
    //             return;
    //         }
    //         device.active = false;
    //         device.state = ( response.BinaryState != '0' );
    //         this.props.onDeviceUpdate({[UDN]: device});
    //     }.bind(this));
    // };



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

        win.webContents.openDevTools();
    };

    render() {
        let rows = sortedVisibleConfigurationsByPluginSelector(this.props).reduce(function(memo, plugin) {
            const configurations = plugin.configurations;
            if (configurations.length < 1) {
                return [...memo, (
                    <TableRow
                        key={plugin.id + 0}
                        selectable={true}>
                        <TableRowColumn>
                            <span>{plugin.id}</span>
                        </TableRowColumn>
                        <TableRowColumn>
                            <span>Missing</span>
                        </TableRowColumn>
                    </TableRow>
                )];
            }

            return plugin.configurations.reduce(function(memo, configuration) {
                return [...memo, (
                    <TableRow
                        key={configuration.id}
                        selectable={true}>
                        <TableRowColumn>
                            <span>{plugin.id}</span>
                        </TableRowColumn>
                        <TableRowColumn>
                            <span>{configuration.data.name}</span>
                        </TableRowColumn>
                    </TableRow>
                )];
            }, memo);

        }, []);
        return (
            <div>

                {rows.length > 0 &&
                    <div style={{ textAlign: "right" }}>
                        <FlatButton label="COG" onClick={this.addPlugin.bind(this)}/>
                    </div>
                }
                {rows.length < 1 &&
                    <div style={{ textAlign: "center" }}>
                        <FlatButton label="Add Plugin" onClick={this.addPlugin.bind(this)}/>
                        <p style={{width: "75%", margin: "auto"}}>Configure a plugin to control other devices.</p>
                    </div>
                }

                { rows.length > 0 &&
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderColumn>
                                Library
                            </TableHeaderColumn>
                            <TableHeaderColumn>
                                Version
                            </TableHeaderColumn>
                            <TableHeaderColumn>
                                Action
                            </TableHeaderColumn>
                        </TableRow>
                    </TableHeader>
                    <TableBody
                        displayRowCheckbox={false}
                        showRowHover={true}
                        stripedRows={true}>
                        {rows}

                    </TableBody>
                </Table>
                }
            </div>
        );
    }
}
