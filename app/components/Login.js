import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2Login } from '../util';
import Dialogs from 'dialogs';
import { ipcRenderer } from 'electron';
//import RaisedButton from 'material-ui/RaisedButton';
import {
    Button,
    TextField,
    Avatar,
    AppBar,
    FormControlLabel,
    Checkbox,
    CircularProgress
} from '@material-ui/core';
import Person from '@material-ui/icons/Person';

var dialogs = Dialogs({});


export default class Login extends Component {
    static propTypes = {
        onLogin: PropTypes.func.isRequired
    };

    state = {
        email: '',
        password: '',
        rememberMe: false,
        isLoadingCredentials: true,
        isLoggingIn: false
    };

    emailRef = React.createRef();
    passwordRef = React.createRef();

    componentDidMount() {
        // Load saved credentials if they exist
        ipcRenderer.invoke('loadCredentials').then(credentials => {
            if (credentials) {
                this.setState({
                    email: credentials.email || '',
                    password: credentials.password || '',
                    rememberMe: true,
                    isLoadingCredentials: false
                });
            } else {
                this.setState({ isLoadingCredentials: false });
            }
        }).catch(err => {
            console.error('Error loading saved credentials:', err);
            this.setState({ isLoadingCredentials: false });
        });
    }

    handleLogin = () => {
        const { email, password, rememberMe } = this.state;

        // Set loading state
        this.setState({ isLoggingIn: true });

        allow2Login({
            email,
            pass: password
        }, (error, response, body) => {
            // Reset loading state on error
            this.setState({ isLoggingIn: false });

            if (error) {
                // Enhanced error handling with network-specific messages
                const errorMessage = error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN'
                    ? 'Unable to connect to Allow2 servers. Please check your internet connection.'
                    : error.code === 'ETIMEDOUT'
                    ? 'Connection to Allow2 servers timed out. Please try again.'
                    : error.toString();
                return dialogs.alert(errorMessage);
            }
            if (!response) {
                return dialogs.alert('Invalid response from server. Please check your internet connection and try again.');
            }
            if (body && body.message) {
                return dialogs.alert(body.message);
            }
            return dialogs.alert('Login failed. Please check your credentials and try again.');
        }, (loginData) => {
            // On successful login, save or clear credentials based on rememberMe
            if (rememberMe) {
                ipcRenderer.invoke('saveCredentials', { email, password })
                    .catch(err => console.error('Error saving credentials:', err));
            } else {
                ipcRenderer.invoke('clearCredentials')
                    .catch(err => console.error('Error clearing credentials:', err));
            }

            // Reset loading state on success
            this.setState({ isLoggingIn: false });
            this.props.onLogin(loginData);
        });
    };

    handleChange = (e) => {
        this.setState({
            [e.target.name]: e.target.value
        });
    };

    handleRememberMeChange = (e) => {
        this.setState({
            rememberMe: e.target.checked
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
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={this.state.rememberMe}
                            onChange={this.handleRememberMeChange}
                            color="primary"
                        />
                    }
                    label="Remember Me"
                    style={{marginTop: 10}}
                />
                <Button
                    variant="contained"
                    color="primary"
                    style={{marginTop: 20}}
                    onClick={this.handleLogin}
                    disabled={this.state.isLoadingCredentials || this.state.isLoggingIn}>
                    {this.state.isLoggingIn ? (
                        <span>
                            <CircularProgress size={24} color="inherit" style={{marginRight: 10}} />
                            Logging In...
                        </span>
                    ) : (
                        'Log In'
                    )}
                </Button>
            </div>
        );
    }
}
