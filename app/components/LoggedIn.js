import React, { Component } from 'react';
import { push } from 'react-router-redux';
import {
    Avatar,
    Button,
    AppBar,
    Toolbar,
    Tooltip,
    Snackbar } from '@material-ui/core';
import {
    SocialPerson,
    Warning,
    Error,
    CheckCircle,
    HelpOutline } from '@material-ui/icons';
import {
    sortedVisibleDevicesSelector,
    sortedActivePluginSelector,
    pluginDataSelector,
    allPluginStatusSelector } from '../selectors';
import { allow2Request, allow2AvatarURL } from '../util';
import Dialogs from 'dialogs';
import Checkbox from './Checkbox';
import PlugIns from './PlugIns';
import PlugInTab from '../containers/PluginTab';
import path from 'path';
import { remote, ipcRenderer } from 'electron';
import Analytics from '../analytics';
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
            currentTab: 'Allow2AutomateSettingsTab',
            toasts: [] // Array of {id, message, severity}
        };
    }

    messageDevices = {};

    componentDidMount = () => {
        // Track screen view
        Analytics.trackScreenView('logged_in');

	    ipcRenderer.on('loggedOut', function(event) {
            this.props.dispatch(push('/'));
        }.bind(this));

        // Listen for toast notifications via window events
        this.handleToastEvent = (event) => {
            this.showToast(event.detail.message, event.detail.severity || 'info');
        };
        window.addEventListener('show-toast', this.handleToastEvent);
    };

    componentWillUnmount = () => {
        window.removeEventListener('show-toast', this.handleToastEvent);
    };

    showToast = (message, severity = 'info') => {
        const id = Date.now();
        this.setState({
            toasts: [...this.state.toasts, { id, message, severity }]
        });
    };

    handleCloseToast = (id) => {
        this.setState({
            toasts: this.state.toasts.filter(t => t.id !== id)
        });
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
            <Avatar icon={<SocialPerson />} />;
        let plugins = sortedActivePluginSelector(this.props);
        let pluginData = pluginDataSelector(this.props);
        let pluginStatuses = allPluginStatusSelector(this.props);
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
                        const pluginStatus = pluginStatuses && pluginStatuses[plugin.name];

                        // Determine icon based on status
                        let statusIcon = null;
                        let iconStyle = { fontSize: 18, marginRight: 4, verticalAlign: 'middle' };

                        if (!pluginStatus || pluginStatus.status === 'unconfigured') {
                            statusIcon = <HelpOutline style={{ ...iconStyle, color: '#FFA500' }} />;
                        } else if (pluginStatus.status === 'error') {
                            statusIcon = <Error style={{ ...iconStyle, color: '#F44336' }} />;
                        } else if (pluginStatus.status === 'warning' || pluginStatus.status === 'disconnected') {
                            statusIcon = <Warning style={{ ...iconStyle, color: '#FF9800' }} />;
                        } else if (pluginStatus.status === 'connected' || pluginStatus.status === 'configured') {
                            statusIcon = <CheckCircle style={{ ...iconStyle, color: '#4CAF50' }} />;
                        }

                        return (
                            <Tab
                                label={
                                    <Tooltip
                                        title={pluginStatus ? pluginStatus.message : 'Status unknown'}
                                        placement="bottom"
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center' }}>
                                            {statusIcon}
                                            {plugin.shortName || plugin.name}
                                        </span>
                                    </Tooltip>
                                }
                                key={ plugin.name }
                                value={ plugin.name }
                            />
                        );
                    }.bind(this))
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

                {/* Stacked toast notifications - bottom right */}
                {this.state.toasts.map((toast, index) => {
                    const severityColors = {
                        success: '#4caf50',
                        error: '#f44336',
                        warning: '#ff9800',
                        info: '#2196f3'
                    };

                    return (
                        <Snackbar
                            key={toast.id}
                            open={true}
                            autoHideDuration={4000}
                            onClose={() => this.handleCloseToast(toast.id)}
                            message={toast.message}
                            ContentProps={{
                                style: {
                                    backgroundColor: severityColors[toast.severity] || severityColors.info,
                                    color: '#fff',
                                    fontSize: '14px',
                                    minWidth: '250px'
                                }
                            }}
                            anchorOrigin={{
                                vertical: 'bottom',
                                horizontal: 'right'
                            }}
                            style={{
                                bottom: `${24 + (index * 60)}px`
                            }}
                        />
                    );
                })}

            </div>
        );
    }
}

