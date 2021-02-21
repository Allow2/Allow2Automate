import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2Login } from '../util';
import Dialogs from 'dialogs';
import RaisedButton from 'material-ui/RaisedButton';
import TextField from 'material-ui/TextField';
import Avatar from 'material-ui/Avatar';
import AppBar from 'material-ui/AppBar';
import Person from 'material-ui/svg-icons/social/person';
import {Tab} from "./LoggedIn";

var dialogs = Dialogs({});


export default class Login extends Component {
    // static propTypes = {
    //     onLogin: PropTypes.func.isRequired
    // };

    render() {
        console.log('tab props', this.props);
        console.log('plugin', this.props.plugin);
        const plugin = this.props.plugin;
        return (
            <div>
                { plugin.name }
            </div>
        );
    }
}
