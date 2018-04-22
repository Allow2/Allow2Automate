import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2Login } from '../util';
import Dialogs from 'dialogs';

const remote = require('electron').remote;

var dialogs = Dialogs({});

export default class Pair extends Component {
    static propTypes = {
        onPaired: PropTypes.func.isRequired
    };

    handlePair = () => {
        //allow2Request('/rest/pairDevice',
        //    {
        //        auth: {
        //            bearer: this.props.user.access_token
        //        },
        //        //headers: {
        //        //    Bearer: this.props.user.access_token
        //        //},
        //        body: {
        //            device: device.UDN,
        //            name: device.device.friendlyName
        //        }
        //    },
        //
        //    function (error, response, body) {
        //        if (error) {
        //            return dialogs.alert(error.toString());
        //        }
        //        if (!response) {
        //            return dialogs.alert('Invalid Response');
        //        }
        //        if (body && body.message) {
        //            return dialogs.alert(body.message);
        //        }
        //        return dialogs.alert('Oops');
        //    },
        //
        //    onPaired);
    };

    handleChange = (e) => {
        this.setState({
            [e.target.name]: e.target.value
        });
    };

    handleCancel = (e) => {
        var window = remote.getCurrentWindow();
        window.close();
    };

    render() {
        return (
            <div>
                <h2>Link xxxx</h2>
                <p>
                    <button onClick={this.handleCancel}>Cancel</button>
                </p>
            </div>
        );
    }
}
