import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2AvatarURL } from '../util';
import Dialogs from 'dialogs';
import path from 'path';
import { ipcRenderer, BrowserWindow } from 'electron';
import url from 'url';
import Module from 'module';


export default class Login extends Component {
    // static propTypes = {
    //     onLogin: PropTypes.func.isRequired
    // };

    constructor(...args) {
        super(...args);

        //
        // magically insert our node_modules path to plugin module search paths
        //
        const reactPath = require.resolve('react');
        const modulesIndex = reactPath.lastIndexOf("node_modules");
        const ourModulesPath = path.join(reactPath.substring(0, modulesIndex), 'node_modules');
        //console.log("injecting ourModulesPath: ", ourModulesPath);
        (function(moduleWrapCopy) {
            Module.wrap = function(script) {
                script = "module.paths.push('" + ourModulesPath + "');" + script;
                return moduleWrapCopy(script);
            };
        })(Module.wrap);

        const appPath = ipcRenderer.sendSync('getPath', 'appData');
	    const dir = path.join(appPath, 'allow2automate', 'plugins');

	    const pluginPath = path.join(dir, this.props.plugin.name);
        this.plugin = require(pluginPath);
        console.log('gui', this.props.plugin.name, this.plugin);
        // if (plugin.default) {
        //     plugin = plugin.default;
        // }

        //console.log('plugin', this.plugin);
        this.state = {
            hasError: false,
            pluginPath: pluginPath
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return {
            hasError: true,
            error: error
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
        const TabContent = this.plugin.TabContent;

        // console.log('TabContent', plugin.name, this.props.data);
        if (this.state.hasError) {
            //console.log(this.state);
            return (<div>
                    <h1>Plugin Error</h1>
                    please check if the plugin has an update.
            </div>);
        }
        if (!this.propIsDefined) {
            return (
                <div>Loading...</div>
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
                assign={this.assign.bind(this)}
                allow2={{
                    avatarURL: allow2AvatarURL
                }}
            />
        );
    }
}
