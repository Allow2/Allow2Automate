import React, { Component } from 'react';
import Avatar from 'material-ui/Avatar';
import FlatButton from 'material-ui/FlatButton';
import AppBar from 'material-ui/AppBar';
import Person from 'material-ui/svg-icons/social/person';
import Wemo from './Wemo';
import { sortedVisibleDevicesSelector } from '../selectors';
import { allow2Request } from '../util';
import Dialogs from 'dialogs';
import Checkbox from './Checkbox';
//import deviceActions from '../actions/device';
import modal from 'electron-modal';
import path from 'path';
import url from 'url';
import { remote } from 'electron';

import {
    Table,
    TableBody,
    TableHeader,
    TableHeaderColumn,
    TableRow,
    TableRowColumn,
    } from 'material-ui/Table';
import {Tabs, Tab} from 'material-ui/Tabs';

var dialogs = Dialogs({});

var deviceTokens = {
    LightSwitch: 'ttH8fDKKgn4uTiwg',
    Socket: '9XJDykzCcxhMCci5'
};
//var deviceTokens = {
//    LightSwitch: 'TczDIlwkOxMVlCTJ',
//    Socket: 'Bw6tUTmmHVykUxGM'
//};

var deviceImages = {
    LightSwitch: 'wemo_lightswitch',
    Socket: 'wemo_switch',
    Maker: 'wemo_maker',
    Smart: 'wemo_smart_switch',
    Bulb: 'wemo_bulb'
};

//class DeviceRow extends Component {
//
//    toggleCheckbox = (device, isChecked) => {
//        this.props.onDeviceActive( device.device.UDN, true );
//        device.device.setBinaryState(isChecked ? 1 : 0, function(err, response) {
//            this.props.onDeviceActive(device.device.UDN, false);
//            if (err || ( response.BinaryState == undefined )) {
//                return;
//            }
//            device.state = ( response.BinaryState != '0' );
//            this.props.onDeviceUpdate({ [device.device.UDN]: device });
//
//        }.bind(this));
//    };
//
//
//    assign = (device) => {
//        //let onPaired = this.props.onPaired;
//        //function openModal() {
//        let win = new remote.BrowserWindow({
//            parent: remote.getCurrentWindow(),
//            modal: true
//        });
//
//
//        //win.loadURL(theUrl);
//        win.loadURL(url.format({
//            pathname: path.join(__dirname, '../pairModal.html'),
//            protocol: 'file:',
//            slashes: true
//        }));
//
//        win.webContents.openDevTools();
//    };
//
//    render() {
//        let device = this.props.device;
//        let token = deviceTokens[device.device.device.modelName];
//        let paired = this.props.pairings[device.device.UDN];
//        console.log(device);
//        return (
//            <TableRow>
//                <TableRowColumn>
//                    { token &&
//                    <span>{ device.device.device.friendlyName }</span>
//                    }
//                    { !token &&
//                    <span><i style={{ color: '#555555' }}>{ device.device.device.friendlyName }</i></span>
//                    }
//                </TableRowColumn>
//                <TableRowColumn>
//                    <Checkbox
//                        label=''
//                        isChecked={device.state}
//                        isDisabled={!token || device.active ? true : false}
//                        handleCheckboxChange={this.toggleCheckbox.bind(this, device)}
//                        />
//                </TableRowColumn>
//                <TableRowColumn>
//                    { paired &&
//                        <b>Paired</b>
//                    }
//                    { !paired && token &&
//                        <button onClick={this.assign.bind(this, device.device)}>Assign { token }</button>
//                    }
//                    { !token &&
//                        <i style={{ color: '#555555' }}>Device not yet supported</i>
//                    }
//                </TableRowColumn>
//            </TableRow>
//        );
//    }
//}

export default class LoggedIn extends Component {

    toggleCheckbox = (device, isChecked) => {
        this.props.onDeviceActive( device.device.UDN, true );
        device.device.setBinaryState(isChecked ? 1 : 0, function(err, response) {
            this.props.onDeviceActive(device.device.UDN, false);
            if (err || ( response.BinaryState == undefined )) {
                return;
            }
            device.state = ( response.BinaryState != '0' );
            this.props.onDeviceUpdate({ [device.device.UDN]: device });

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

    handleLogout = () => {
        dialogs.confirm('Are you sure you want to log off?', function(ok) {
            if (ok) {
                this.props.onLogout();
            }
        }.bind(this));
    };

    render() {
        let devices = sortedVisibleDevicesSelector(this.props).reduce(function(memo, device) {
            let token = deviceTokens[device.device.device.modelName];
            if (token) {
                memo.supported.push(device);
            } else {
                memo.notSupported.push(device);
            }
            return memo;
        }, { supported: [], notSupported: [] });
        let user = this.props.user;
        let name = ( user.user && user.user.firstName ) || "...";
        let avatar = ( user.user && <Avatar src={'https://staging-api.allow2.com/avatar?key=account' + user.user.id + '&size=medium'} />) ||
            <Avatar icon={<Person />} />;
        return (
            <div>
                <AppBar
                    title={name}
                    iconElementLeft={avatar}
                    iconElementRight={<FlatButton label="Log Off" onClick={this.handleLogout} />}
                    />
                <Tabs>
                    <Tab label="Devices" >
                        <Table>
                            <TableHeader displaySelectAll={false}>
                                <TableRow>
                                    <TableHeaderColumn></TableHeaderColumn>
                                    <TableHeaderColumn>Device</TableHeaderColumn>
                                    <TableHeaderColumn>On</TableHeaderColumn>
                                    <TableHeaderColumn>Child</TableHeaderColumn>
                                </TableRow>
                            </TableHeader>
                            <TableBody
                                displayRowCheckbox={false}
                                showRowHover={true}
                                stripedRows={true}>
                            { devices.supported.map( function(device) {
                                    let token = deviceTokens[device.device.device.modelName];
                                    let imageName = deviceImages[device.device.device.modelName];
                                    let paired = this.props.pairings[device.device.UDN];
                                    let child = paired && paired.ChildId && this.props.children[paired.ChildId];
                                    let detail = child ? (
                                            <b>{child.name}</b>
                                        ) : <b>Paired</b>;
                                    return (
                                        <TableRow
                                            key={device.device.UDN}
                                            selectable={false}>
                                            <TableRowColumn>
                                                { imageName &&
                                                <img width="40" height="40" src={ 'assets/img/' + imageName + '.png' } />
                                                }
                                            </TableRowColumn>
                                            <TableRowColumn>
                                                { token &&
                                                <span>{ device.device.device.friendlyName }</span>
                                                }
                                                { !token &&
                                                <span><i style={{ color: '#555555' }}>{ device.device.device.friendlyName }</i></span>
                                                }
                                            </TableRowColumn>
                                            <TableRowColumn>
                                                <Checkbox
                                                    label=''
                                                    isChecked={device.state}
                                                    isDisabled={!token || device.active ? true : false}
                                                    handleCheckboxChange={this.toggleCheckbox.bind(this, device)}
                                                    />
                                            </TableRowColumn>
                                            <TableRowColumn>
                                                { paired && detail }
                                                { !paired &&
                                                <FlatButton label="Assign" onClick={this.assign.bind(this, device.device, token)} />
                                                }
                                            </TableRowColumn>
                                        </TableRow>
                                    );
                                }.bind(this)
                            )}
                            </TableBody>
                        </Table>
                        <Wemo onDeviceUpdate={this.props.onDeviceUpdate} />
                    </Tab>
                    { devices.notSupported.length > 0 &&
                    <Tab label="Unsupported" >
                        <div>
                            <h2>Unsupported Devices</h2>
                            If you would like any of these devices supported, please contact us at support@allow2.com.
                            <div>
                                <Table>
                                    <TableHeader displaySelectAll={false}>
                                        <TableRow>
                                            <TableHeaderColumn></TableHeaderColumn>
                                            <TableHeaderColumn>Device</TableHeaderColumn>
                                            <TableHeaderColumn>Type</TableHeaderColumn>
                                            <TableHeaderColumn>Version</TableHeaderColumn>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody
                                        displayRowCheckbox={false}
                                        showRowHover={true}
                                        stripedRows={true}>
                                    { devices.notSupported.map( (device) => {
                                        let imageName = deviceImages[device.device.device.modelName];
                                        return (
                                            <TableRow key={ device.device.UDN }
                                                      selectable={false}>
                                                <TableRowColumn>
                                                    { imageName &&
                                                    <img width="40" height="40" src={ 'assets/img/' + imageName + '.png' } />
                                                    }
                                                </TableRowColumn>
                                                <TableRowColumn>
                                                    { device.device.device.friendlyName }
                                                </TableRowColumn>
                                                <TableRowColumn>
                                                    { device.device.device.modelName }
                                                </TableRowColumn>
                                                <TableRowColumn>
                                                    { device.device.device.modelNumber }
                                                </TableRowColumn>
                                            </TableRow>
                                        );
                                    })
                                    }
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </Tab>
                    }

                </Tabs>
            </div>
        );
    }
}
