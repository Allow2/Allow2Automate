import React, { Component } from 'react';
import Wemo from './Wemo';
import { sortedVisibleDevicesSelector } from '../selectors';
import { allow2Request } from '../util';
import Dialogs from 'dialogs';

var dialogs = Dialogs({});

export default class LoggedIn extends Component {

    handleLogout = () => {
        this.props.onLogout();
    };

    assign = (device) => {
        let onPaired = this.props.onPaired;
        allow2Request('/pairDevice',
            {
                headers: {
                    Bearer: this.props.user.access_token
                },
                body: {
                    device: device.UDN,
                    name: device.device.friendlyName
                }
            },

            function (error, response, body) {
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
            },

            onPaired);
    };

    render() {
        let devices = sortedVisibleDevicesSelector(this.props);
        return (
            <div>
                <h2>Visible Devices</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Device</th>
                            <th>State</th>
                        </tr>
                    </thead>
                    <tbody>
                    { devices.map( (device) =>
                        (
                            <tr key={ device.device.UDN } >
                                <td>{ device.device.device.friendlyName }</td>
                                <td>{ device.state ? 'On' : 'Off' }</td>
                                <td><button onClick={this.assign.bind(this, device.device)}>Assign</button></td>
                            </tr>
                        )
                    )}
                    </tbody>
                </table>
                <p>
                    <button onClick={this.handleLogout}>Log Off</button>
                </p>
                <Wemo onDeviceUpdate={this.props.onDeviceUpdate} />
            </div>
        );
    }
}
