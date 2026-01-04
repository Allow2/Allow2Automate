import React, { Component } from 'react';
import { Avatar, TextField, IconButton, Button, Box, Typography, Divider, Chip } from '@material-ui/core';
import {
    sortedPluginSelector,
    activePluginSelector,
    sortedActivePluginSelector
} from '../selectors';
import { allow2Request, allow2AvatarURL } from '../util';
import Dialogs from 'dialogs';
import Checkbox from './Checkbox';
import AgentManagement from './Settings/AgentManagement';
//import deviceActions from '../actions/plugin';
import path from 'path';
import url from 'url';
import { ipcRenderer, BrowserWindow } from 'electron';
import {
    TableContainer,
    Paper,
    Table,
    TableBody,
    TableHead,
    TableRow,
    TableCell
    } from '@material-ui/core';
import { Delete, CloudDownload, AddCircle, Code } from '@material-ui/icons';
import MarketplacePage from '../containers/MarketplacePage';
import Analytics from '../analytics';
//import {Tabs, Tab} from '@material-ui/core';
const epm = require('electron-plugin-manager');
const fs = require('fs');

// const apiUrl = 'https://api.allow2.com/';

var dialogs = Dialogs({});

export default class PlugIns extends Component {

    handleChange = (event) => {
        this.setState({
            pluginName: event.target.value
        });
    };

    constructor(...args) {
        super(...args);

	    const appPath = ipcRenderer.sendSync('getPath', 'appData');

        this.state = {
            device: null,
            token: null,
            pairing: false,
            pluginName: '',
	        dir: path.join(appPath, 'allow2automate'),
            isMarketplaceOpen: false
        };
    }

    componentDidMount() {
        // Auto-open marketplace if no plugins installed
        const installedPluginsCount = this.getInstalledPluginsCount();
        if (installedPluginsCount === 0) {
            this.setState({ isMarketplaceOpen: true });
        }
    }

    componentDidUpdate(prevProps) {
        // Check if plugins were just installed and close marketplace if needed
        const prevCount = Object.keys(prevProps.installedPlugins || {}).length;
        const currentCount = this.getInstalledPluginsCount();

        // If we went from 1+ to 0 plugins, auto-open marketplace (can't close)
        if (prevCount > 0 && currentCount === 0) {
            console.log('[PlugIns] No plugins installed - auto-opening marketplace');
            this.setState({ isMarketplaceOpen: true });
        }

        // If we went from 0 to 1+ plugins, keep marketplace open but enable close button
        if (prevCount === 0 && currentCount > 0) {
            // Just a state update to re-render with close button enabled
            this.forceUpdate();
        }
    }

    getInstalledPluginsCount = () => {
        return Object.keys(this.props.installedPlugins || {}).length;
    };

    handleOpenMarketplace = () => {
        this.setState({ isMarketplaceOpen: true });
    };

    handleCloseMarketplace = () => {
        const installedPluginsCount = this.getInstalledPluginsCount();
        // Only allow closing if there are installed plugins
        if (installedPluginsCount > 0) {
            this.setState({ isMarketplaceOpen: false });
        }
    };

    installPlugin = (pluginName) => {
        const onPluginInstalled = this.props.onPluginInstalled.bind(this);
	    ipcRenderer.on('epm-installed-' + pluginName, (event, err, pluginPath) => {
            //console.log(event, err, pluginPath);
            if (err) {
                dialogs.alert("Unable to find " + pluginName + ': ' + JSON.stringify(err));
                return;
            }
            //epm.load(this.state.dir, pluginName, require);
            // In renderer process
            fs.readFile(path.join(pluginPath, 'package.json'), 'utf8', (err, jsonString) => {
                if (err) {
                    console.log("Package.json read failed:", err);
                    dialogs.alert("Package.json read failed:", err.toString());
                    return
                }
                try {
                    const packageJson = JSON.parse(jsonString);
                    //console.log("package.json:", packageJson); // => "Customer address is: Infinity Loop Drive"
                    packageJson.name = pluginName;
                    onPluginInstalled({ [pluginName] : packageJson });

                } catch(err) {
                    console.log('Error parsing JSON string', err, jsonString);
                    dialogs.alert("Error reading package.json:", err.toString());
                }
            });
        });
	    ipcRenderer.send('epm-install', this.state.dir, pluginName, 'latest');
    };

    addPlugin = () => {
        const pluginName = 'allow2automate-' + this.state.pluginName;

        if (this.props.installedPlugins[pluginName]) {
            dialogs.alert(pluginName + ' is already installed. Remove it first if you want to reinstall it.');
            return;
        }
        console.log('install', pluginName);
        this.installPlugin(pluginName);
        return;

        //let onPaired = this.props.onPaired;
        //function openModal() {
        let win = new BrowserWindow({
            parent: BrowserWindow.getCurrentWindow(),
            modal: true,
            width: 500,
            height: 600,
            minWidth: 500,
            maxWidth: 500,
            minHeight: 600,
            maxHeight: 800,
	        webPreferences: {
		        enableRemoteModule: true
	        }
        });


        //win.loadURL(theUrl);
        win.loadURL(url.format({
            pathname: path.join(__dirname, '../addPlugin.html'),
            protocol: 'file:',
            slashes: true
        }));

        win.webContents.on('did-finish-load', () => {
            win.webContents.send('data', { plugins: activePluginSelector(this.props) });
        });

        //win.webContents.openDevTools();
    };

    reinstallPlugin = (plugin) => {
        console.log('reinstall', plugin.name);
        this.installPlugin(plugin.name);
    };

    deletePlugin = (plugin) => {
        const onPluginRemoved = this.props.onPluginRemoved.bind(this);
        const pluginName = plugin.name;
        const hasConfigurations = Object.values(this.props.configurations).find((configuration) => {
            return configuration.plugin === pluginName;
        });

        const actualDelete = (removeConfiguration) => {
            // need to decommission if the plugin is operational
            // then unload it?
            console.log('unload', pluginName);
            epm.unload(this.state.dir, pluginName, require);
            // then delete it.
	        ipcRenderer.on('epm-uninstalled-' + pluginName, (event, err) => {
                console.log('uninstalled', event, err);
                if (err) {
                    Analytics.trackPluginError(pluginName, pluginName, 'uninstall_failed', err.toString());
                    dialogs.alert(err.toString());
                    return;
                }
                Analytics.trackPluginUninstall(pluginName, pluginName);
                onPluginRemoved({ pluginName : pluginName, removeConfiguration : removeConfiguration });
            });
            console.log('uninstalling', pluginName);
	        ipcRenderer.send('epm-uninstall', this.state.dir, pluginName);
        };

        if (plugin.missing) {
            dialogs.confirm('Are you sure you want to remove ' + plugin.name + ' configurations?', function(ok) {
                if (!ok) {
                    return
                }
                onPluginRemoved({ pluginName : plugin.name, removeConfiguration : true });
            }.bind(this));
            return;
        }
        dialogs.confirm('Are you sure you want to delete the ' + plugin.name + ' plugin?', function(ok) {
            if (!ok) {
                return
            }
            if (!hasConfigurations) {
                return actualDelete(true);
            }
            dialogs.confirm('Keep your  ' + plugin.name + ' configurations?', function(ok) {
                if (ok) {
                    return actualDelete(false);
                }

                dialogs.confirm('So delete the ' + plugin.name + 'plugin, and associated configurations?', function(ok) {
                    if (ok) {
                        return actualDelete(true);
                    }
                }.bind(this));
            }.bind(this));
        }.bind(this));
    };

    toggleCheckbox = (plugin, isChecked) => {
        if (isChecked) {
            Analytics.trackPluginEnable(plugin.name, plugin.name);
        } else {
            Analytics.trackPluginDisable(plugin.name, plugin.name);
        }
        this.props.onSetPluginEnabled( plugin.name, isChecked );
    };

    render() {
        let plugins = sortedPluginSelector(this.props);
        let customStyle = {width: 80, textAlign: 'center'};
        const { isMarketplaceOpen } = this.state;
        const installedPluginsCount = this.getInstalledPluginsCount();

        return (
            <div>
                {/* Agent Management Section - Top Priority */}
                <Box mb={4}>
                    <AgentManagement ipcRenderer={ipcRenderer} />
                </Box>

                <Divider style={{ margin: '32px 0' }} />

                {/* Header with Add Plugin button */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} p={2}>
                    <Typography variant="h5">Plugin Settings</Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddCircle />}
                        onClick={this.handleOpenMarketplace}
                    >
                        Add Plugin
                    </Button>
                </Box>

                {/* Manual plugin entry - Hidden for now, may need later */}
                <div style={{ textAlign: "center", display: "none" }}>
                    allow2automate-
                    <TextField id="pluginName" label="Plugin" value={this.state.pluginName} onChange={this.handleChange.bind(this)} />
                    <IconButton color="primary" aria-label="install plugin" component="span" onClick={this.addPlugin.bind(this)} >
                        <CloudDownload />
                    </IconButton>
                </div>
                { plugins.length > 0 &&
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow key="HeaderRow">
                                <TableCell> <span>Plugin</span> </TableCell>
                                <TableCell style={customStyle}> <span>Installed Version</span> </TableCell>
                                <TableCell style={customStyle}> <span>Enabled</span> </TableCell>
                                <TableCell style={customStyle}> <span>Delete</span> </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            { plugins.map(function (plugin) {
                                    //console.log(plugin);
                                    let version = (plugin.version) || "";
                                    const isDevPlugin = plugin.dev_plugin || false;
                                    const latestVersion = plugin.latestVersion;
                                    const showLatestVersion = isDevPlugin && latestVersion && latestVersion !== version;

                                    return (
                                        <TableRow key={plugin.name}>
                                            <TableCell>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <span>{plugin.name}</span>
                                                    {isDevPlugin && (
                                                        <Chip
                                                            label="DEV"
                                                            size="small"
                                                            color="secondary"
                                                            icon={<Code />}
                                                            style={{ marginLeft: 8 }}
                                                        />
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell style={customStyle}>
                                                {!plugin.missing &&
                                                <Box>
                                                    <span>{version}</span>
                                                    {showLatestVersion && (
                                                        <Typography variant="caption" display="block" color="textSecondary">
                                                            Latest: {latestVersion}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                }
                                                { plugin.missing &&
                                                <Button label="Reinstall" onClick={this.reinstallPlugin.bind(this, plugin)}/>
                                                }
                                            </TableCell>
                                            <TableCell style={customStyle}>
                                                { !plugin.missing &&
                                                <Checkbox
                                                    label=''
                                                    isChecked={!plugin.disabled}
                                                    handleCheckboxChange={this.toggleCheckbox.bind(this, plugin)}
                                                />
                                                }
                                            </TableCell>
                                            <TableCell style={customStyle}>
                                                <IconButton color="primary" aria-label="delete plugin" component="span" onClick={this.deletePlugin.bind(this, plugin)}>
                                                    <Delete />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }.bind(this)
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                }

                {/* Marketplace Modal Overlay */}
                {isMarketplaceOpen && (
                    <MarketplacePage
                        showCloseButton={installedPluginsCount > 0}
                        onClose={this.handleCloseMarketplace}
                    />
                )}
            </div>
        );

    }
}
