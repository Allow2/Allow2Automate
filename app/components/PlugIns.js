import React, { Component } from 'react';
import { push } from 'react-router-redux';
import Avatar from 'material-ui/Avatar';
import FlatButton from 'material-ui/FlatButton';
import AppBar from 'material-ui/AppBar';
import Person from 'material-ui/svg-icons/social/person';
import { sortedVisiblePluginsSelector } from '../selectors';
import { allow2Request, allow2AvatarURL } from '../util';
import Dialogs from 'dialogs';
import Checkbox from './Checkbox';
//import deviceActions from '../actions/plugin';
import modal from 'electron-modal';
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


    assign = (device, token) => {
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
            pathname: path.join(__dirname, '../pairModal.html'),
            protocol: 'file:',
            slashes: true
        }));

        win.webContents.on('did-finish-load', () => {
            win.webContents.send('device', { device: device, token: token });
        });

        //win.webContents.openDevTools();
    };

    render() {
        let plugins = sortedVisiblePluginsSelector(this.props);
        return (
            <div>
                { plugins.length < 1 &&
                    <div style={{ textAlign: "center" }}>
                        <h1>Add Plugin</h1>
                        <p style={{ width:"75%", margin: "auto" }}>Configure a plugin to control other devices.</p>
                    </div>
                }
                { plugins.length > 0 &&
                <Table>
                    <TableBody
                        displayRowCheckbox={false}
                        showRowHover={true}
                        stripedRows={true}>
                        { plugins.map(function (device) {
                                let imageName = 'test.png';
                                let paired = this.props.pairings[device.device.UDN];
                                let child = paired && paired.ChildId && this.props.children[paired.ChildId];
                                let detail = child ? (
                                    <b>{child.name}</b>
                                ) : <b>Paired</b>;
                                let url = child && allow2AvatarURL(null, child);
                                return (
                                    <TableRow
                                        key={device.device.UDN}
                                        selectable={false}>
                                        <TableRowColumn>
                                            { imageName &&
                                            <img width="40" height="40"
                                                 src={ 'assets/img/' + imageName + '.png' }/>
                                            }
                                        </TableRowColumn>
                                        <TableRowColumn>
                                            { token &&
                                            <span>{ device.device.device.friendlyName }</span>
                                            }
                                            { !token &&
                                            <span><i
                                                style={{ color: '#555555' }}>{ device.device.device.friendlyName }</i></span>
                                            }
                                        </TableRowColumn>
                                        <TableRowColumn style={{textAlign: 'center'}}>
                                            <Checkbox
                                                label=''
                                                isChecked={device.state}
                                                isDisabled={!token || device.active ? true : false}
                                                handleCheckboxChange={this.toggleCheckbox.bind(this, device)}
                                                />
                                        </TableRowColumn>
                                        <TableRowColumn style={{textAlign: 'right'}}>
                                            { child &&
                                            <Avatar src={url}/>
                                            }
                                        </TableRowColumn>
                                        <TableRowColumn style={{textAlign: 'left'}}>
                                            { paired && detail }
                                            { !paired &&
                                            <FlatButton label="Assign"
                                                        onClick={this.assign.bind(this, device.device, token)}/>
                                            }
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
