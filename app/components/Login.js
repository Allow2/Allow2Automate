import React, { Component } from 'react';
import PropTypes from 'prop-types';
import request from 'request';
import Dialogs from 'dialogs';

var dialogs = Dialogs({});

const apiUrl = 'https://staging-api.allow2.com';

export default class Login extends Component {
    static propTypes = {
        onLogin: PropTypes.func.isRequired
    };

    state = {
        email: '',
        password: ''
    };

    handleLogin = () => {
        let onLogin = this.props.onLogin;
        request({
            url: apiUrl + '/login',
            method: 'POST',
            json: true,
            body: {
                email: this.state.email,
                pass: this.state.password
            }
        }, function (error, response, body) {
            if (error) {
                console.log('error:', error);
                return dialogs.alert(error.toString());
            }
            if (!response) {
                console.log('Invalid Response');
                return dialogs.alert('Invalid Response');
            }
            if (!response.statusCode || (response.statusCode != 200)) {
                console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
                console.log('body:', body); // Print the HTML for the Google homepage.
                if (body && body.message) {
                    return dialogs.alert(body.message);
                }
                return dialogs.alert('Oops');
            }
            onLogin(body);
        });
    };

    handleChange = (e) => {
        this.setState({
            [e.target.name]: e.target.value
        });
    };

    render() {
        return (
            <div>
                <h2>Login</h2>
                <p>
                    Email: <input onChange={this.handleChange} type="text" name="email" value={this.state.email}/>
                </p>
                <p>
                    Password: <input onChange={this.handleChange} type="password" name="password" value={this.state.password}/>
                </p>
                <p>
                    <button onClick={this.handleLogin}>Log In</button>
                </p>
            </div>
        );
    }
}
