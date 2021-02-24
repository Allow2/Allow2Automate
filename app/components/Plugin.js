import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2Login } from '../util';
import Dialogs from 'dialogs';
import path from 'path';
import { remote } from 'electron';

const epm = require('electron-plugin-manager');
const dir = path.join(remote.app.getPath('appData'), 'allow2automate');

export default class Login extends Component {
    // static propTypes = {
    //     onLogin: PropTypes.func.isRequired
    // };

    constructor(...args) {
        super(...args);

        const plugin = epm.load(dir, this.props.plugin.name, remote.require);
        this.plugin = plugin({
            updateData: function(data) {
            }
        });

        console.log(this.plugin);
        this.state = {
            hasError: false
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
        console.log(error, errorInfo);
        this.setState({
            ...this.state,
            error: error,
            errorInfo: errorInfo
        });
    }

    render() {
        console.log('tab props 1', this.props);
        //console.log('plugin', this.props.plugin);
        const plugin = this.props.plugin;
        const TabContent = this.plugin.TabContent;
        if (this.state.hasError) {
            console.log(this.state);
            return (<div>
                    <h1>Plugin Error</h1>
                    please check if the plugin has an update.
            </div>);
        }
        if (!this.plugin || !this.plugin.TabContent) {
            return (
                <div>Loading...</div>
            );
        }
        return (
            <TabContent {...plugin.data} />
        );
    }
}
