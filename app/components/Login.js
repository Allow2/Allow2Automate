import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2Login } from '../util';
import Dialogs from 'dialogs';
//import RaisedButton from 'material-ui/RaisedButton';
import {
    Button,
    TextField,
    Avatar,
    AppBar
} from '@material-ui/core';
import { SocialPerson } from '@material-ui/icons';

var dialogs = Dialogs({});


export default class Login extends Component {
    static propTypes = {
        onLogin: PropTypes.func.isRequired
    };

    state = {
        email: '',
        password: ''
    };

    handleLogin = () => {
        allow2Login({
            email: this.state.email,
            pass: this.state.password
        }, function (error, response, body) {
            if (error) {
                return dialogs.alert(error.toString());
            }
            if (!response) {
                return dialogs.alert('Invalid Response');
            }
            if (body && body.message) {
                return dialogs.alert(body.message);
            }
            return dialogs.alert('Oops');
        }, this.props.onLogin);
    };

    handleChange = (e) => {
        this.setState({
            [e.target.name]: e.target.value
        });
    };

    render() {
        return (
            <div>
                <AppBar
                    title="Login to Allow2"
                    iconElementLeft={<Avatar icon={<Person />} />}
                    />
                <TextField
                    floatingLabelText="Email"
                    onChange={this.handleChange}
                    name="email"
                    value={this.state.email} />
                <TextField
                    type="password"
                    hintText=""
                    floatingLabelText="Password"
                    onChange={this.handleChange}
                    name="password"
                    value={this.state.password} />
                <Button variant="contained" onClick={this.handleLogin}>
                    Log In
                </Button>
            </div>
        );
    }
}
