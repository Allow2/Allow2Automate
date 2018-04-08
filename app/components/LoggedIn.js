import React, { Component } from 'react';
import Wemo from './Wemo';

export default class LoggedIn extends Component {

    handleLogout = () => {
        this.props.onLogout();
    };

    render() {
        let devices = Object.values(this.props.devices).sort((a,b) => a.device.device.friendlyName.localeCompare(b.device.device.friendlyName));
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
