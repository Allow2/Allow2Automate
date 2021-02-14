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

    render() {
        const library = {
            "allow2-battle.net": {
                name: "battle.net",
                    publisher: "allow2",
                    releases: {
                        latest: "1.0.0"
                    },
                    description: "Enable Allow2Automate management of World of Warcraft parental controls",
                    main: "./lib/battle.net",
                    repository: {
                    type: "git",
                        url: "https://github.com/Allow2/allow2automate-battle.net"
                },
                keywords: [
                    'allow2automate', 'battle.net', 'wow', 'world of warcraft'
                ]
            },
            "allow2-ssh": {
                name: "ssh",
                    publisher: "allow2",
                    releases: {
                        latest: "1.0.0"
                    },
                    description: "Enable Allow2Automate the ability to use ssh to configure devices",
                    main: "./lib/ssh",
                    repository: {
                    type: "git",
                        url: "https://github.com/Allow2/allow2automate-ssh"
                },
                keywords : [
                    'allow2automate', 'allow2', 'ssh'
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
        };
        let plugins = sortedVisibleConfigurationsByPluginSelector(this.props);
        let installed = epm.list(dir, { version: true });
        return (
            <div>
                <div style={{ textAlign: "center" }}>
                    <FlatButton label="Add Plugin" onClick={this.addPlugin.bind(this)}/>
                    <p style={{ width:"75%", margin: "auto" }}>Configure a plugin to control other devices.</p>
                </div>
                { plugins.length > 0 &&
                <Table>
                    <TableBody
                        displayRowCheckbox={false}
                        showRowHover={true}
                        stripedRows={true}>
                        { plugins.map(function (plugin) {
                                let imageName = 'test.png';
                                return (
                                    <TableRow
                                        key={plugin.name}
                                        selectable={true}>
                                        <TableRowColumn>
                                            <span>{plugin.name}</span>
                                        </TableRowColumn>

                                    </TableRow>
                                );
                            }.bind(this)
                        )}
                    </TableBody>
                </Table>
                }
                <Table>
                    <TableBody
                        displayRowCheckbox={false}
                        showRowHover={true}
                        stripedRows={true}>
                        { installed.map(function (plugin) {
                                return (
                                    <TableRow
                                        key={plugin}
                                        selectable={false}>
                                        <TableRowColumn>
                                            <span>{plugin}</span>
                                        </TableRowColumn>

                                    </TableRow>
                                );
                            }.bind(this)
                        )}
                    </TableBody>
                </Table>
            </div>
        );
    }
}
