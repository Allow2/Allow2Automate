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
    sortedActivePluginSelector,
    pluginDataSelector } from '../selectors';
import { allow2Request, allow2AvatarURL } from '../util';
import Dialogs from 'dialogs';
import Checkbox from './Checkbox';
import PlugIns from './PlugIns';
import PlugInTab from '../containers/PluginTab';
import path from 'path';
import { remote, ipcRenderer } from 'electron';
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
	    ipcRenderer.on('loggedOut', function(event) {
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
        let plugins = sortedActivePluginSelector(this.props);
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
                    return (
                        <TabPanel index={ plugin.name } key={ plugin.name } value={this.state.currentTab} >
                            <PlugInTab
                                plugin={pluginDetail}
                                data={plugin.configuration}
                                children={pluginData.children}
                                user={pluginData.user}
                                onUpdateConfiguration={this.props.onUpdateConfiguration} />
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

