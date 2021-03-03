import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2AvatarURL } from '../util';
import Dialogs from 'dialogs';
import path from 'path';
import { remote, ipcRenderer } from 'electron';

//const epm = require('electron-plugin-manager');
const dir = path.join(remote.app.getPath('appData'), 'allow2automate', 'plugins');

export default class Login extends Component {
    // static propTypes = {
    //     onLogin: PropTypes.func.isRequired
    // };

    constructor(...args) {
        super(...args);

        //const plugin = epm.load(dir, this.props.plugin.name, remote.require);
        console.log(dir);
        const pluginPath = path.join(dir, this.props.plugin.name);
        var plugin = require(pluginPath);
        //console.log('gui', this.props.plugin.name, plugin);
        if (plugin.default) {
            plugin = plugin.default;
        }

        this.plugin = plugin({
            updateData: function(data) {
            }
        });
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

    render() {
        // console.log('tab props 1', this.props);
        // console.log(JSON.parse(JSON.stringify(this.plugin)));
        // console.log(this.plugin.test);
        //console.log('plugin', this.props.plugin);
        const plugin = this.props.plugin;
        const TabContent = this.plugin.TabContent;

        console.log('TabContent', plugin.name, this.props.data);
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

        const ipc = {
            send: (channel, ...args) => { ipcRenderer.send( pluginName + '.' + channel, ...args)},
            on: (channel, listener) => { ipcRenderer.on( pluginName + '.' + channel, listener)}
        };

        return (
            <TabContent
                plugin={this.props.plugin}
                data={this.props.data}
                children={this.props.children}
                user={this.props.user}
                pluginPath={this.state.pluginPath}
                remote={remote}
                ipc={ipc}
                allow2={{
                    avatarURL: allow2AvatarURL
                }}
            />
        );
    }
}
