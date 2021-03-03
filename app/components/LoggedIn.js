import React, { Component } from 'react';
import { push } from 'react-router-redux';
import {
    Avatar,
    Button,
    AppBar,
    Toolbar } from '@material-ui/core';
import { SocialPerson } from '@material-ui/icons';
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
    } from '@material-ui/core';
import {Tabs, Tab, Box } from '@material-ui/core';

var dialogs = Dialogs({});


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

function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box p={3}>
                    {children}
                </Box>
            )}
        </div>
    );
}

export default class Plugins extends Component {

    constructor(...args) {
        super(...args);

        this.state = {
            currentTab: 'Allow2AutomateSettingsTab'
        };
    }

    messageDevices = {};

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

    handleLogout = () => {
        dialogs.confirm('Are you sure you want to log off?', function(ok) {
            if (ok) {
                this.props.onLogout();
            }
        }.bind(this));
    };

    handleTabChange = (el, tab) => {
        //console.log(newValue, tab);
        this.setState({
            currentTab: tab
        });
    };

    render() {
        let user = this.props.user;
        let name = ( user.user && user.user.firstName ) || "...";
        let avatarUrl = allow2AvatarURL(user && user.user, null);
        let avatar = ( user.user && <Avatar src={ avatarUrl } />) ||
            <Avatar icon={<Person />} />;
        let plugins = sortedVisibleConfigurationsByActivePluginSelector(this.props);
        let pluginData = pluginDataSelector(this.props);
        return (
            <div>
                <AppBar position="static">
                    <Toolbar>
                        {avatar}
                        {name}
                        <Button label="Log Off" onClick={this.handleLogout} />
                    </Toolbar>
                </AppBar>
                <Tabs value={this.state.currentTab} onChange={this.handleTabChange.bind(this)} >
                    { plugins.map(function (plugin) {
                        return (
                            <Tab label={ plugin.shortName || plugin.name } key={ plugin.name } value={ plugin.name } />
                        );
                    })
                    }
                    <Tab label="Settings" key="Allow2AutomateSettingsTab" value="Allow2AutomateSettingsTab" />
                </Tabs>

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
                        <TabPanel index={ plugin.name } key={ plugin.name } value={this.state.currentTab} >
                            <PlugInTab
                                plugin={pluginDetail}
                                data={data}
                                children={pluginData.children}
                                user={pluginData.user} />
                        </TabPanel>
                    );
                }.bind(this))
                }

                <TabPanel index="Allow2AutomateSettingsTab" value={this.state.currentTab} >
                    <PlugIns {...this.props} />
                </TabPanel>

            </div>
        );
    }
}

