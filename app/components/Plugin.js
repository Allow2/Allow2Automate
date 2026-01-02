import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2AvatarURL } from '../util';
import Dialogs from 'dialogs';
import path from 'path';
import { ipcRenderer, BrowserWindow } from 'electron';
import url from 'url';
import Module from 'module';
import Analytics from '../analytics';


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

        // Provide global persist stub for backward compatibility
        // Some older plugins may reference persist at module scope
        if (!global.persist) {
            global.persist = function(key, value) {
                console.warn('[Plugin] Legacy global persist() called. Plugin should use props.persist instead.');
            };
        }

        this.plugin = null;
        this.pluginPath = pluginPath; // Store for componentDidMount
        this.state = {
            hasError: false,
            pluginPath: pluginPath,
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

    assign(device, token) {
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
            pathname: path.join(__dirname, '../pairModal.html'),
            protocol: 'file:',
            slashes: true
        }));

        win.webContents.on('did-finish-load', () => {
            win.webContents.send('device', { device: device, token: token });
        });

        win.webContents.openDevTools();
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

        const ipcRestricted = {
            send: (channel, ...args) => { ipcSend(`${plugin.name}.${channel}`, ...args) },
            on: (channel, listener) => { ipcOn(`${plugin.name}.${channel}`, listener) },
	        invoke: (channel, ...args) => { ipcInvoke(`${plugin.name}.${channel}`, ...args) },
	        handle: (channel, handler) => { ipcHandle(`${plugin.name}.${channel}`, handler) }
        };

        const pluginName = this.props.plugin.name;
        const onUpdateConfiguration = this.props.onUpdateConfiguration;
        const configurationUpdate = function(newConfiguration) {
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
            <TabContent
                plugin={this.props.plugin}
                data={this.props.data}
                children={this.props.children}
                user={this.props.user}
                pluginPath={this.state.pluginPath}
                // remote={remote}
                ipcRenderer={ipcRestricted}
                configurationUpdate={configurationUpdate}
                statusUpdate={statusUpdate}
                persist={persist}
                assign={this.assign.bind(this)}
                allow2={{
                    avatarURL: allow2AvatarURL
                }}
            />
        );
    }
}
