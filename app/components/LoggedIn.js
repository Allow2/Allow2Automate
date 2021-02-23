import React, { Component } from 'react';
import { push } from 'react-router-redux';
import Avatar from 'material-ui/Avatar';
import FlatButton from 'material-ui/FlatButton';
import AppBar from 'material-ui/AppBar';
import Person from 'material-ui/svg-icons/social/person';
import {
    sortedVisibleDevicesSelector,
    sortedVisibleConfigurationsByActivePluginSelector,
    pluginDataSelector } from '../selectors';
import { allow2Request, allow2AvatarURL } from '../util';
import Dialogs from 'dialogs';
import Checkbox from './Checkbox';
import PlugIns from './PlugIns';
import PlugInTab from '../containers/PluginTab';
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

var deviceTokens = {
    LightSwitch: 'TczDIlwkOxMVlCTJ',
    Socket: 'Bw6tUTmmHVykUxGM'
};

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

export default class Plugins extends Component {

    constructor(...args) {
        super(...args);

        this.state = {
            currentTab: 'Allow2AutomateSettingsTab'
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
        ipc.on('loggedOut', function(event) {
            this.props.dispatch(push('/'));
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

    handleTabChange = (newValue) => {
        this.setState({
            currentTab: newValue
        });
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
        let avatarUrl = allow2AvatarURL(user && user.user, null);
        let avatar = ( user.user && <Avatar src={ avatarUrl } />) ||
            <Avatar icon={<Person />} />;
        let plugins = sortedVisibleConfigurationsByActivePluginSelector(this.props);
        let pluginData = pluginDataSelector(this.props);

        return (
            <div>
                <AppBar
                    title={name}
                    iconElementLeft={avatar}
                    iconElementRight={<FlatButton label="Log Off" onClick={this.handleLogout} />}
                    />
                <Tabs value={this.state.currentTab} onChange={this.handleTabChange.bind(this)} >
                    { plugins.map(function (plugin) {
                        const pluginDetail = {
                            name: plugin.name,
                            shortName: plugin.shortName,
                            version: plugin.version
                        };
                        const data = Object.values(plugin.configurations).reduce((memo, configuration) => {
                            memo[configuration.id] = configuration.data;
                            return memo;
                        }, {});
                        return (
                            <Tab label={ plugin.shortName || plugin.name } key={ plugin.name } value={ plugin.name } >
                                <PlugInTab
                                    plugin={pluginDetail}
                                    data={data}
                                    children={pluginData.children}
                                    user={pluginData.user} />
                            </Tab>
                        );
                    })
                    }
                    <Tab label="Settings" key="Allow2AutomateSettingsTab" value="Allow2AutomateSettingsTab" >
                        <PlugIns {...this.props} />
                    </Tab>
                </Tabs>
            </div>
        );
    }
}
