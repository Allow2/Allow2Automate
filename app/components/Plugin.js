import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2AvatarURL } from '../util';
import Dialogs from 'dialogs';
import path from 'path';
import { ipcRenderer } from 'electron';
import Module from 'module';
import Analytics from '../analytics';
import { Paper, IconButton, Typography } from '@material-ui/core';
import { Close as CloseIcon } from '@material-ui/icons';
import ManageAgentsButton from './ManageAgentsButton';


export default class Login extends Component {
    // static propTypes = {
    //     onLogin: PropTypes.func.isRequired
    // };

    constructor(...args) {
        super(...args);

        //
        // Configure shared module paths for plugins in renderer process
        // This makes React, Material-UI, and other host dependencies available to dynamically loaded plugins
        //
        const reactPath = require.resolve('react');
        const modulesIndex = reactPath.lastIndexOf("node_modules");
        const ourModulesPath = path.join(reactPath.substring(0, modulesIndex), 'node_modules');

        // Also resolve specific shared dependency paths
        const reactDomPath = path.dirname(require.resolve('react-dom'));
        const muiCorePath = path.dirname(require.resolve('@material-ui/core'));
        const reduxPath = path.dirname(require.resolve('redux'));
        const reactReduxPath = path.dirname(require.resolve('react-redux'));

        console.log("[Plugin Component] Injecting shared module paths for:", this.props.plugin.name);

        // Store original Module.wrap
        if (!Module._originalWrap) {
            Module._originalWrap = Module.wrap;
        }

        // Inject module paths into loaded plugin modules via Module.wrap
        // This ensures plugins use the host app's React instance
        Module.wrap = function(script) {
            // Build the path injection script
            const pathInjectionScript = [
                `module.paths.push('${ourModulesPath}');`,
                `module.paths.push('${path.join(reactDomPath, '..')}');`,
                `module.paths.push('${path.join(muiCorePath, '..', '..')}');`,
                `module.paths.push('${path.join(reduxPath, '..')}');`,
                `module.paths.push('${path.join(reactReduxPath, '..')}');`
            ].join('');

            script = pathInjectionScript + script;
            return Module._originalWrap(script);
        };

        // Get environment-aware plugin path from main process
        const pluginsDir = ipcRenderer.sendSync('getPath', 'plugins');

        // Determine plugin directory based on whether it's a dev plugin or installed plugin
        let pluginDir;
        if (this.props.plugin.dev_plugin && this.props.plugin.installation && this.props.plugin.installation.local_path) {
            // Dev plugins: use the direct path from installation.local_path
            pluginDir = this.props.plugin.installation.local_path;
            console.log('[Plugin] Using dev plugin directory:', pluginDir);
        } else {
            // Installed plugins: in node_modules subdirectory
            pluginDir = path.join(pluginsDir, 'node_modules', this.props.plugin.name);
            console.log('[Plugin] Using installed plugin directory:', pluginDir);
        }

        // Build the full path to the plugin's entry point using the 'main' field
        const entryPoint = this.props.plugin.main || 'dist/index.js';
        const pluginPath = path.join(pluginDir, entryPoint);
        console.log('[Plugin] Plugin entry point:', pluginPath);
        console.log('[Plugin] Plugin directory:', pluginDir);

        // Provide global persist stub for backward compatibility
        // Some older plugins may reference persist at module scope
        if (!global.persist) {
            global.persist = function(key, value) {
                console.warn('[Plugin] Legacy global persist() called. Plugin should use props.persist instead.');
            };
        }

        this.plugin = null;
        this.pluginPath = pluginPath; // Store for componentDidMount (loading only)
        this.pluginDir = pluginDir;   // Store plugin directory for TabContent
        this.state = {
            hasError: false,
            pluginDir: pluginDir,
            isLoading: true
        };
    }

    componentDidMount() {
        // Load plugin after component is mounted to avoid setState warnings
        this.loadPlugin(this.pluginPath);
    }

    async loadPlugin(pluginPath) {
        try {
            console.log('[Plugin] Loading plugin from:', pluginPath);

            // CRITICAL: Clear require cache to ensure fresh load with injected paths
            // This prevents cached modules from using wrong React instances
            if (require.cache[pluginPath]) {
                console.log('[Plugin] Clearing cached module:', pluginPath);
                delete require.cache[pluginPath];
            }

            // Try to load the plugin - use dynamic import which supports both CJS and ESM
            let loadedPlugin;

            // First try CommonJS require (more reliable in Electron)
            try {
                loadedPlugin = require(pluginPath);
                console.log('[Plugin] Loaded as CommonJS:', this.props.plugin.name);
            } catch (requireError) {
                console.log('[Plugin] CommonJS require failed, trying ES import:', requireError.message);

                // If require fails, try dynamic import for ES modules
                // Note: Dynamic import in Electron can be unstable, so we use require first
                try {
                    const fileUrl = `file://${pluginPath}`;
                    loadedPlugin = await import(fileUrl);
                    console.log('[Plugin] Loaded as ES module via file URL:', this.props.plugin.name);

                    // ES modules export as default
                    if (loadedPlugin.default) {
                        loadedPlugin = loadedPlugin.default;
                    }
                } catch (importError) {
                    console.error('[Plugin] Both CommonJS and ESM loading failed');
                    throw new Error(`Cannot load plugin: CommonJS error: ${requireError.message}, ESM error: ${importError.message}`);
                }
            }

            this.plugin = loadedPlugin;
            console.log('[Plugin] Successfully loaded:', this.props.plugin.name, this.plugin);

            this.setState({
                isLoading: false,
                hasError: false
            });
        } catch (error) {
            console.error('[Plugin] Failed to load plugin:', this.props.plugin.name, error);
            this.setState({
                hasError: true,
                error: error,
                isLoading: false
            });
        }
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return {
            hasError: true,
            error: error,
            isLoading: false
        };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        // console.log('eroiugriugr', error, errorInfo);
        this.setState({
            ...this.state,
            error: error,
            errorInfo: errorInfo
        });
    }

    get propIsDefined () {
        return this.plugin !== undefined && this.plugin.TabContent !== undefined
    }

    /**
     * Open the child picker and return the result
     *
     * @param {Object} device - Device being assigned (any device info object)
     * @param {string} token - Device token for pairing API
     * @param {Object} options - Additional options
     * @param {string} options.currentSelection - Currently assigned child ID
     * @param {boolean} options.allowClear - Whether to show clear button (default: true)
     * @returns {Promise<Object>} Result object:
     *   - { selected: true, childId, childName, device, token }
     *   - { cleared: true, device, token }
     *   - { cancelled: true, device, token }
     */
    async assign(device, token, options = {}) {
        try {
            const result = await ipcRenderer.invoke('openChildPicker', {
                title: (device && device.friendlyName) ? `Assign: ${device.friendlyName}` : 'Select a Child',
                currentSelection: options.currentSelection || null,
                allowClear: options.allowClear !== false,
                context: { device, token }
            });

            console.log('[Plugin] Child picker result:', result);

            // Return the result for the plugin to handle
            return result;
        } catch (error) {
            console.error('[Plugin] Error opening child picker:', error);
            return { cancelled: true, error: error.message, context: { device, token } };
        }
    }

    // IPC masking
	ipcSend(channel, ...args) {
		console.log('plugin ipcRenderer send', channel, ipcRenderer.send);
		ipcRenderer.send( channel, ...args)
	}

	ipcOn(channel, listener) {
		console.log('plugin ipcRenderer on', channel);
		ipcRenderer.on( channel, listener)
	}

	async ipcInvoke(channel, ...args) {
		console.log('plugin ipcRenderer invoke', channel);
		return await ipcRenderer.invoke( channel, ...args)
	}

	ipcHandle(channel, handler) {
		console.log('plugin ipcRenderer handle', channel);
		ipcRenderer.handle( channel, handler)
	}

    /**
     * Render the plugin info banner
     * Shows plugin description with dismiss button
     */
    renderBanner() {
        const { plugin, bannerVisible, onDismissBanner } = this.props;

        // Don't render if banner is not visible or no description
        if (!bannerVisible) {
            return null;
        }

        const description = plugin.description || 'No description available for this plugin.';

        return (
            <Paper
                elevation={1}
                style={{
                    padding: '12px 16px',
                    marginBottom: 16,
                    backgroundColor: '#e3f2fd',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-start'
                }}
            >
                <Typography
                    variant="body2"
                    style={{ flex: 1, paddingRight: 32 }}
                >
                    {description}
                </Typography>
                <IconButton
                    size="small"
                    onClick={onDismissBanner}
                    style={{
                        position: 'absolute',
                        top: 4,
                        right: 4
                    }}
                    aria-label="Dismiss plugin info"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Paper>
        );
    }

	render() {
        // console.log('tab props 1', this.props);
        // console.log(JSON.parse(JSON.stringify(this.plugin)));
        // console.log(this.plugin.test);
        //console.log('plugin', this.props.plugin);
        const plugin = this.props.plugin;

        // Show loading state while plugin is loading
        if (this.state.isLoading || !this.plugin) {
            return (
                <div style={{ padding: 20, textAlign: 'center' }}>
                    <p>Loading plugin: {plugin.name}...</p>
                </div>
            );
        }

        const TabContent = this.plugin.TabContent;

        // console.log('TabContent', plugin.name, this.props.data);
        if (this.state.hasError) {
            //console.log(this.state);
            return (<div style={{ padding: 20 }}>
                    <h1>Plugin Error</h1>
                    <p>There was an error loading the plugin: {plugin.name}</p>
                    <p>{this.state.error ? this.state.error.message : 'Unknown error'}</p>
                    <p>Please check if the plugin has an update.</p>
            </div>);
        }
        if (!this.propIsDefined) {
            return (
                <div style={{ padding: 20 }}>
                    <p>Plugin loaded but TabContent not found: {plugin.name}</p>
                </div>
            );
        }
        // var TabContent =
        // var component = React.createFactory(TabContent);
        // var element = component({...plugin.data});
        // data will be at least one key and data pair: {
        //   <key> : <data1>
        // }

        // Plugin-specific IPC (channels prefixed with plugin name)
        const ipcRestricted = {
            send: (channel, ...args) => { this.ipcSend(`${plugin.name}.${channel}`, ...args) },
            on: (channel, listener) => { this.ipcOn(`${plugin.name}.${channel}`, listener) },
	        invoke: async (channel, ...args) => { return await this.ipcInvoke(`${plugin.name}.${channel}`, ...args) },
	        handle: (channel, handler) => { this.ipcHandle(`${plugin.name}.${channel}`, handler) }
        };

        // Global IPC for app-wide handlers (pairDevice, unpairDevice, openChildPicker, etc.)
        const globalIpc = {
            invoke: async (channel, ...args) => { return await ipcRenderer.invoke(channel, ...args) },
            send: (channel, ...args) => { ipcRenderer.send(channel, ...args) }
        };

        const pluginName = this.props.plugin.name;
        const onUpdateConfiguration = this.props.onUpdateConfiguration;
        const currentConfig = this.props.data || {};
        const configurationUpdate = function(newConfiguration) {
            // Calculate delta of changed fields
            const changedFields = {};
            Object.keys(newConfiguration).forEach(key => {
                if (JSON.stringify(currentConfig[key]) !== JSON.stringify(newConfiguration[key])) {
                    changedFields[key] = newConfiguration[key];
                }
            });

            // Track configuration changes with delta
            if (Object.keys(changedFields).length > 0) {
                Analytics.trackConfigurationChange(pluginName, changedFields);
            }

            onUpdateConfiguration(pluginName, newConfiguration);
        };

        // Plugin status update interface
        const statusUpdate = function(statusData) {
            console.log('[Plugin] Status update from', pluginName, statusData);
            ipcRenderer.send(`${pluginName}.status.update`, statusData);
        };

        // Plugin data persistence interface (backward compatibility)
        const persist = function(key, value) {
            console.log('[Plugin] Persist data from', pluginName, key, value);
            // For backward compatibility, persist data via configuration
            const currentConfig = plugin.configuration || {};
            const updatedConfig = {
                ...currentConfig,
                [key]: value
            };
            configurationUpdate(updatedConfig);
        };


        return (
            <div>
                {this.renderBanner()}
                <TabContent
                    plugin={this.props.plugin}
                    data={this.props.data}
                    children={this.props.children}
                    user={this.props.user}
                    pluginDir={this.state.pluginDir}
                    ipcRenderer={ipcRestricted}
                    ipc={ipcRestricted}
                    globalIpc={globalIpc}
                    configurationUpdate={configurationUpdate}
                    statusUpdate={statusUpdate}
                    persist={persist}
                    assign={this.assign.bind(this)}
                    allow2={{
                        avatarURL: allow2AvatarURL
                    }}
                    ManageAgentsButton={ManageAgentsButton}
                />
            </div>
        );
    }
}
