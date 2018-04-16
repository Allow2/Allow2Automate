import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2Login } from '../util';
import Dialogs from 'dialogs';

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
