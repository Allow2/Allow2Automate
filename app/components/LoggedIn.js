import React, { Component } from 'react';

export default class LoggedIn extends Component {

    handleLogout = () => {
        this.props.onLogout({
            username: null,
            loggedIn: false
        });
    };

    render() {
        return (
            <div>
                <h2>Logged in as {this.props.user.username}</h2>
                <button onClick={this.handleLogout}>Log Off</button>
            </div>
        );
    }
}
