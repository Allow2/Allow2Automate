import React, { Component } from 'react';
import { push } from 'react-router-redux';
import {
    Avatar,
    Button,
    AppBar,
    Toolbar,
    Tooltip,
    Snackbar,
    Drawer,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Box } from '@material-ui/core';
import {
    SocialPerson,
    Warning,
    Error,
    CheckCircle,
    HelpOutline,
    Settings as SettingsIcon,
    ExitToApp,
    Extension,
    Router,
    Terminal,
    Devices,
    SportsEsports,
    Cloud } from '@material-ui/icons';
import * as MuiIcons from '@material-ui/icons';
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
    TableRowColumn } from '@material-ui/core';

var dialogs = Dialogs({});

const drawerWidth = 240;

/**
 * Get plugin icon component
 * Resolves custom icons from plugin metadata
 */
function getPluginIcon(plugin) {
    const { ipcRenderer } = require('electron');
    const fs = require('fs');

    console.log('[PluginIcon] Getting icon for plugin:', plugin.name, 'icon:', plugin.icon, 'fullPath:', plugin.fullPath);

    // Get plugin directory
    const pluginsDir = ipcRenderer.sendSync('getPath', 'plugins');
    let pluginDir;

    // Use fullPath if available (set by plugin loader)
    if (plugin.fullPath) {
        pluginDir = plugin.fullPath;
        console.log('[PluginIcon] Using fullPath:', pluginDir);
    } else if (plugin.dev_plugin && plugin.installation && plugin.installation.local_path) {
        pluginDir = plugin.installation.local_path;
        console.log('[PluginIcon] Using local_path:', pluginDir);
    } else {
        pluginDir = path.join(pluginsDir, 'node_modules', plugin.name);
        console.log('[PluginIcon] Using computed path:', pluginDir);
    }

    // Check if plugin has custom icon
    if (plugin.icon) {
        const iconType = plugin.iconType || 'file';
        console.log('[PluginIcon] Icon type:', iconType);

        if (iconType === 'material-ui') {
            // Use Material-UI icon by name
            const IconComponent = MuiIcons[plugin.icon];
            if (IconComponent) {
                return <IconComponent />;
            }
            console.warn('[PluginIcon] Material-UI icon not found:', plugin.icon);
        } else if (iconType === 'data-url' || plugin.icon.startsWith('data:')) {
            // Data URL (base64)
            return (
                <img
                    src={plugin.icon}
                    width={24}
                    height={24}
                    alt=""
                    style={{ objectFit: 'contain' }}
                />
            );
        } else {
            // File path - resolve relative to plugin directory
            let iconPath = path.join(pluginDir, plugin.icon);
            console.log('[PluginIcon] Initial icon path:', iconPath);

            // Resolve symlinks to get actual file path
            try {
                if (fs.existsSync(iconPath)) {
                    const resolvedPath = fs.realpathSync(iconPath);
                    console.log('[PluginIcon] Resolved symlink:', iconPath, '->', resolvedPath);
                    iconPath = resolvedPath;
                } else {
                    console.warn('[PluginIcon] Icon file does not exist:', iconPath);
                }
            } catch (err) {
                console.warn('[PluginIcon] Error resolving icon path:', err);
            }

            console.log('[PluginIcon] Final icon path for', plugin.name, ':', iconPath);

            return (
                <img
                    src={`file://${iconPath}`}
                    width={24}
                    height={24}
                    alt=""
                    style={{ objectFit: 'contain' }}
                    onError={(e) => {
                        console.error('[PluginIcon] ❌ Failed to load icon for', plugin.name, '- path:', iconPath);
                        e.target.style.display = 'none';
                    }}
                    onLoad={() => {
                        console.log('[PluginIcon] ✅ Successfully loaded icon for', plugin.name);
                    }}
                />
            );
        }
    }

    console.log('[PluginIcon] No icon specified, using fallback for', plugin.name);
    // Fallback to default Extension icon
    return <Extension />;
}

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

        // Restore currentTab from localStorage to preserve navigation across refreshes
        let savedTab = 'Allow2AutomateSettingsTab';
        try {
            const stored = localStorage.getItem('allow2automate-current-tab');
            if (stored) {
                savedTab = stored;
            }
        } catch (e) {
            console.warn('[LoggedIn] Could not read currentTab from localStorage:', e);
        }

        // Restore dismissed banners from localStorage
        let dismissedBanners = new Set();
        try {
            const stored = localStorage.getItem('allow2automate-dismissed-banners');
            if (stored) {
                dismissedBanners = new Set(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('[LoggedIn] Could not read dismissedBanners from localStorage:', e);
        }

        this.state = {
            currentTab: savedTab,
            toasts: [], // Array of {id, message, severity}
            dismissedBanners: dismissedBanners, // Set of plugin names with permanently dismissed banners
            temporarilyShowBanner: null // Plugin name to temporarily show banner for
        };
    }

    messageDevices = {};

    /**
     * Optimize re-renders: only update when relevant props/state actually change.
     * This prevents the component from re-rendering when unrelated state changes.
     */
    shouldComponentUpdate(nextProps, nextState) {
        // Always update if local state changed (tab switch, toasts, banners)
        if (this.state.currentTab !== nextState.currentTab) {
            return true;
        }
        if (this.state.toasts.length !== nextState.toasts.length) {
            return true;
        }
        // Banner state changes
        if (this.state.dismissedBanners !== nextState.dismissedBanners) {
            return true;
        }
        if (this.state.temporarilyShowBanner !== nextState.temporarilyShowBanner) {
            return true;
        }

        // Check if relevant props changed (shallow comparison of references)
        // These are the props that actually affect rendering
        if (
            this.props.user !== nextProps.user ||
            this.props.children !== nextProps.children ||
            this.props.installedPlugins !== nextProps.installedPlugins ||
            this.props.configurations !== nextProps.configurations ||
            this.props.pluginLibrary !== nextProps.pluginLibrary ||
            this.props.pluginStatus !== nextProps.pluginStatus
        ) {
            return true;
        }

        // No relevant changes, skip re-render
        return false;
    }

    componentDidMount = () => {
        // Track screen view
        Analytics.trackScreenView('logged_in');

        // Validate saved tab - ensure the plugin still exists
        const { currentTab } = this.state;
        if (currentTab && currentTab !== 'Allow2AutomateSettingsTab') {
            const plugins = sortedActivePluginSelector(this.props);
            const pluginExists = plugins.some(p => p.name === currentTab);
            if (!pluginExists) {
                console.log('[LoggedIn] Saved tab plugin no longer exists, reverting to Settings');
                this.setState({ currentTab: 'Allow2AutomateSettingsTab' });
                try {
                    localStorage.setItem('allow2automate-current-tab', 'Allow2AutomateSettingsTab');
                } catch (e) {}
            }
        }

	    ipcRenderer.on('loggedOut', function(event) {
            this.props.dispatch(push('/'));
        }.bind(this));

        // Listen for toast notifications via window events
        this.handleToastEvent = (event) => {
            this.showToast(event.detail.message, event.detail.severity || 'info');
        };
        window.addEventListener('show-toast', this.handleToastEvent);

        // Listen for navigation to agents (from ManageAgentsButton)
        this.handleNavigateToAgents = () => {
            console.log('[LoggedIn] Navigate to Agents requested');
            this.setState({
                currentTab: 'Allow2AutomateSettingsTab',
                settingsInitialTab: 0 // Device Monitoring tab
            });
            // Persist to localStorage
            try {
                localStorage.setItem('allow2automate-current-tab', 'Allow2AutomateSettingsTab');
            } catch (e) {}
        };
        window.addEventListener('navigate-to-agents', this.handleNavigateToAgents);
    };

    componentWillUnmount = () => {
        window.removeEventListener('show-toast', this.handleToastEvent);
        window.removeEventListener('navigate-to-agents', this.handleNavigateToAgents);
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

        // Persist to localStorage so navigation survives refreshes
        try {
            localStorage.setItem('allow2automate-current-tab', tab);
        } catch (e) {
            console.warn('[LoggedIn] Could not save currentTab to localStorage:', e);
        }

        // Track navigation to plugin tabs
        if (tab !== 'Allow2AutomateSettingsTab') {
            Analytics.trackPluginTabView(tab);
        }
    };

    /**
     * Get display title for the active tab
     * @param {Array} plugins - List of active plugins
     * @returns {string} Display title for the active tab
     */
    getActiveTabTitle = (plugins) => {
        const { currentTab } = this.state;

        if (currentTab === 'Allow2AutomateSettingsTab') {
            return 'Settings';
        }

        // Find the plugin and return its display name
        const plugin = plugins.find(p => p.name === currentTab);
        if (plugin) {
            return plugin.shortName || plugin.displayName || plugin.name;
        }

        return currentTab;
    };

    /**
     * Permanently dismiss banner for a plugin (persists across reboots)
     * @param {string} pluginName - Plugin name to dismiss banner for
     */
    handleDismissBanner = (pluginName) => {
        const newDismissed = new Set(this.state.dismissedBanners);
        newDismissed.add(pluginName);

        this.setState({
            dismissedBanners: newDismissed,
            temporarilyShowBanner: null
        });

        // Persist to localStorage
        try {
            localStorage.setItem('allow2automate-dismissed-banners', JSON.stringify([...newDismissed]));
        } catch (e) {
            console.warn('[LoggedIn] Could not save dismissedBanners to localStorage:', e);
        }
    };

    /**
     * Temporarily show banner for a plugin (doesn't persist)
     * Banner will be hidden again when user navigates away or dismisses it
     * @param {string} pluginName - Plugin name to show banner for
     */
    handleShowBannerTemporarily = (pluginName) => {
        this.setState({
            temporarilyShowBanner: pluginName
        });
    };

    /**
     * Check if banner should be shown for a plugin
     * @param {string} pluginName - Plugin name to check
     * @returns {boolean} True if banner should be visible
     */
    isBannerVisible = (pluginName) => {
        const { dismissedBanners, temporarilyShowBanner } = this.state;

        // If temporarily showing this plugin's banner, show it
        if (temporarilyShowBanner === pluginName) {
            return true;
        }

        // Otherwise, show if not permanently dismissed
        return !dismissedBanners.has(pluginName);
    };

    /**
     * Check if the help icon should be shown in title bar
     * @param {string} pluginName - Current plugin name
     * @returns {boolean} True if help icon should be visible
     */
    shouldShowHelpIcon = (pluginName) => {
        const { dismissedBanners, temporarilyShowBanner } = this.state;

        // Show help icon if banner is dismissed AND not temporarily shown
        return dismissedBanners.has(pluginName) && temporarilyShowBanner !== pluginName;
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
            <div style={{ display: 'flex' }}>
                {/* Header AppBar */}
                <AppBar position="fixed" style={{ zIndex: 1201 }}>
                    <Toolbar>
                        {avatar}
                        <span style={{ marginLeft: 8 }}>{name}</span>
                        {/* Centered title showing active tab with optional help icon */}
                        <div style={{ flexGrow: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>
                                {this.getActiveTabTitle(plugins)}
                            </span>
                            {/* Show help icon when plugin banner is dismissed */}
                            {this.state.currentTab !== 'Allow2AutomateSettingsTab' &&
                             this.shouldShowHelpIcon(this.state.currentTab) && (
                                <Tooltip title="Show plugin information">
                                    <IconButton
                                        color="inherit"
                                        size="small"
                                        style={{ marginLeft: 8 }}
                                        onClick={() => this.handleShowBannerTemporarily(this.state.currentTab)}
                                    >
                                        <HelpOutline fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </div>
                        <Tooltip title="Log Out">
                            <IconButton color="inherit" onClick={this.handleLogout}>
                                <ExitToApp />
                            </IconButton>
                        </Tooltip>
                    </Toolbar>
                </AppBar>

                {/* Left Navigation Drawer */}
                <Drawer
                    variant="permanent"
                    sx={{
                        width: drawerWidth,
                        flexShrink: 0,
                        '& .MuiDrawer-paper': {
                            width: drawerWidth,
                            boxSizing: 'border-box',
                            marginTop: '64px'
                        }
                    }}
                    PaperProps={{
                        style: {
                            width: drawerWidth,
                            marginTop: '64px',
                            height: 'calc(100vh - 64px)',
                            display: 'flex',
                            flexDirection: 'column'
                        }
                    }}
                >
                    {/* Scrollable plugin list */}
                    <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                        <List>
                            { plugins.map(function (plugin) {
                                const pluginStatus = pluginStatuses && pluginStatuses[plugin.name];
                                const isSelected = this.state.currentTab === plugin.name;

                                // Determine status icon
                                let statusIcon = null;
                                let iconStyle = { fontSize: 18 };

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
                                    <Tooltip
                                        key={plugin.name}
                                        title={pluginStatus ? pluginStatus.message : 'Status unknown'}
                                        placement="right"
                                    >
                                        <ListItem
                                            button
                                            selected={isSelected}
                                            onClick={() => this.handleTabChange(null, plugin.name)}
                                        >
                                            <ListItemIcon>
                                                {getPluginIcon(plugin)}
                                            </ListItemIcon>
                                            <ListItemText primary={plugin.shortName || plugin.name} />
                                            <ListItemSecondaryAction>
                                                {statusIcon}
                                            </ListItemSecondaryAction>
                                        </ListItem>
                                    </Tooltip>
                                );
                            }.bind(this))
                            }
                        </List>
                    </div>

                    {/* Fixed footer for Settings */}
                    <div style={{
                        borderTop: '1px solid rgba(0, 0, 0, 0.12)',
                        backgroundColor: '#fafafa'
                    }}>
                        <List>
                            <ListItem
                                button
                                selected={this.state.currentTab === 'Allow2AutomateSettingsTab'}
                                onClick={() => this.handleTabChange(null, 'Allow2AutomateSettingsTab')}
                            >
                                <ListItemIcon>
                                    <SettingsIcon />
                                </ListItemIcon>
                                <ListItemText primary="Settings" />
                            </ListItem>
                        </List>
                    </div>
                </Drawer>

                {/* Main Content Area */}
                <Box
                    component="main"
                    sx={{ flexGrow: 1, p: 3, marginTop: '64px', marginLeft: `${drawerWidth}px` }}
                    style={{ marginTop: '64px', marginLeft: `${drawerWidth}px`, padding: 24, flexGrow: 1 }}
                >

                { plugins.map(function (plugin) {
                    const pluginDetail = {
                        name: plugin.name,
                        shortName: plugin.shortName,
                        version: plugin.version,
                        description: plugin.description || (plugin.packageJson && plugin.packageJson.description),
                        main: plugin.packageJson && plugin.packageJson.main,
                        dev_plugin: plugin.dev_plugin,
                        installation: plugin.installation || (plugin.available && plugin.available.installation)
                    };
                    return (
                        <TabPanel index={ plugin.name } key={ plugin.name } value={this.state.currentTab} >
                            <PlugInTab
                                plugin={pluginDetail}
                                data={plugin.configuration}
                                children={pluginData.children}
                                user={pluginData.user}
                                onUpdateConfiguration={this.props.onUpdateConfiguration}
                                bannerVisible={this.isBannerVisible(plugin.name)}
                                onDismissBanner={() => this.handleDismissBanner(plugin.name)} />
                        </TabPanel>
                    );
                }.bind(this))
                }

                    <TabPanel index="Allow2AutomateSettingsTab" value={this.state.currentTab} >
                        <PlugIns
                            {...this.props}
                            initialTab={this.state.settingsInitialTab}
                            onInitialTabConsumed={() => this.setState({ settingsInitialTab: undefined })}
                        />
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
                </Box>
            </div>
        );
    }
}

