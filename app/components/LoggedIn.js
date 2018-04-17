import React, { Component } from 'react';
import Wemo from './Wemo';
import { sortedVisibleDevicesSelector } from '../selectors';
import { allow2Request } from '../util';
import Dialogs from 'dialogs';
import Checkbox from './Checkbox';

var dialogs = Dialogs({});

class DeviceRow extends Component {

    toggleCheckbox = (device, isChecked) => {
        device.device.setBinaryState(isChecked ? 1 : 0);
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
        let device = this.props.device;
        return (
            <tr key={ device.device.UDN } >
                <td>{ device.device.device.friendlyName }</td>
                <td>
                    <Checkbox
                        label=''
                        isChecked={device.state}
                        handleCheckboxChange={this.toggleCheckbox.bind(this, device)}
                        />
                </td>
                <td><button onClick={this.assign.bind(this, device.device)}>Assign</button></td>
            </tr>
        );
    }
}

export default class LoggedIn extends Component {

    handleLogout = () => {
        this.props.onLogout();
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
                            <th>On</th>
                        </tr>
                    </thead>
                    <tbody>
                    { devices.map( (device) =>

                        (
                            <DeviceRow key={ device.device.UDN } {...this.props} device={device} />
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
