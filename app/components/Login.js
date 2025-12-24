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
import Person from '@material-ui/icons/Person';

var dialogs = Dialogs({});


export default class Login extends Component {
    static propTypes = {
        onLogin: PropTypes.func.isRequired
    };

    state = {
        email: '',
        password: ''
    };

    emailRef = React.createRef();
    passwordRef = React.createRef();

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

    handleKeyPress = (e, currentField) => {
        if (e.key === 'Enter') {
            const { email, password } = this.state;
            const hasEmail = email.trim().length > 0;
            const hasPassword = password.trim().length > 0;

            // Both fields have values - attempt login
            if (hasEmail && hasPassword) {
                this.handleLogin();
                return;
            }

            // Handle field switching logic
            if (currentField === 'email') {
                if (!hasEmail) {
                    // On empty email field - stay focused
                    return;
                }
                // Email has value but password is empty - move to password
                if (!hasPassword && this.passwordRef.current) {
                    this.passwordRef.current.focus();
                }
            } else if (currentField === 'password') {
                if (!hasPassword) {
                    // On empty password field - stay focused
                    return;
                }
                // Password has value but email is empty - move to email
                if (!hasEmail && this.emailRef.current) {
                    this.emailRef.current.focus();
                }
            }
        }
    };

    render() {
        return (
            <div style={{padding: 20}}>
                <AppBar position="static" style={{marginBottom: 20}}>
                    <div style={{padding: 10, display: 'flex', alignItems: 'center'}}>
                        <Avatar style={{marginRight: 10}}>
                            <Person />
                        </Avatar>
                        <span>Login to Allow2</span>
                    </div>
                </AppBar>
                <TextField
                    label="Email"
                    onChange={this.handleChange}
                    onKeyPress={(e) => this.handleKeyPress(e, 'email')}
                    name="email"
                    type="email"
                    fullWidth
                    margin="normal"
                    value={this.state.email}
                    inputRef={this.emailRef}
                    inputProps={{
                        autoComplete: 'username email',
                        autoCapitalize: 'none',
                        autoCorrect: 'off',
                        spellCheck: 'false'
                    }} />
                <TextField
                    type="password"
                    label="Password"
                    onChange={this.handleChange}
                    onKeyPress={(e) => this.handleKeyPress(e, 'password')}
                    name="password"
                    fullWidth
                    margin="normal"
                    value={this.state.password}
                    inputRef={this.passwordRef}
                    inputProps={{
                        autoComplete: 'current-password'
                    }} />
                <Button
                    variant="contained"
                    color="primary"
                    style={{marginTop: 20}}
                    onClick={this.handleLogin}>
                    Log In
                </Button>
            </div>
        );
    }
}
