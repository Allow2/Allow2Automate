import React, { Component } from 'react';
import Wemo from './Wemo';
import { sortedVisibleDevicesSelector } from '../selectors';
import { allow2Request } from '../util';
import Dialogs from 'dialogs';
import Checkbox from './Checkbox';
import deviceActions from '../actions/device';
const modal = require('electron-modal');
const path = require('path');

var dialogs = Dialogs({});

var deviceTokens = {
    LightSwitch: 'ttH8fDKKgn4uTiwg',
    Socket: '9XJDykzCcxhMCci5'
};

class DeviceRow extends Component {

    toggleCheckbox = (device, isChecked) => {
        this.props.onDeviceActive( device.device.UDN, true );
        device.device.setBinaryState(isChecked ? 1 : 0, function(err, response) {
            this.props.onDeviceActive(device.device.UDN, false);
            if (err || ( response.BinaryState == undefined )) {
                return;
            }
            device.state = ( response.BinaryState != '0' );
            this.props.onDeviceUpdate({ [device.device.UDN]: device });

        }.bind(this));
    };


    assign = (device) => {
        let onPaired = this.props.onPaired;
        console.log(path.join(__dirname, '../pairModal.html'));
        modal.open(path.join(__dirname, '../pairModal.html'), {

            // Any BrowserWindow options
            width: 400,
            height: 300

        }, {

            // Any data you want to pass to the modal
            title: 'Assign ' + device.device.friendlyName

        }).then((instance) => {
            instance.on('increment', () => {
                console.log('Increment event received!');
            });

            instance.on('decrement', () => {
                console.log('Decrement event received!');
            });
        });

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

    render() {
        let device = this.props.device;
        let token = deviceTokens[device.device.device.modelName];
        let paired = this.props.pairings[device.UDN];
        return (
            <tr key={ device.device.UDN } >
                <td>
                    { token &&
                    <span>{ device.device.device.friendlyName }</span>
                    }
                    { !token &&
                    <span><i style={{ color: '#555555' }}>{ device.device.device.friendlyName }</i></span>
                    }
                </td>
                <td>
                    <Checkbox
                        label=''
                        isChecked={device.state}
                        isDisabled={!token || device.active ? true : false}
                        handleCheckboxChange={this.toggleCheckbox.bind(this, device)}
                        />
                </td>
                <td>
                    { paired &&
                        <b>Paired</b>
                    }
                    { !paired && token &&
                        <button onClick={this.assign.bind(this, device.device)}>Assign { token }</button>
                    }
                    { !token &&
                        <i style={{ color: '#555555' }}>Device not yet supported</i>
                    }
                </td>
            </tr>
        );
    }
}

export default class LoggedIn extends Component {

    handleLogout = () => {
        this.props.onLogout();
    };

    render() {
        let devices = sortedVisibleDevicesSelector(this.props).reduce(function(memo, device) {
            let token = deviceTokens[device.device.device.modelName];
            if (token) {
                memo.supported.push(device);
            } else {
                memo.notSupported.push(device);
            }
            return memo;
        }, { supported: [], notSupported: [] });
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
                    { devices.supported.map( (device) =>
                        (
                            <DeviceRow key={ device.device.UDN } {...this.props} device={device} />
                        )
                    )}
                    </tbody>
                </table>
                { devices.notSupported.length > 0 &&
                <div>
                    <h2>Unsupported Devices</h2>
                    If you would like any of these devices supported, please contact us at support@allow2.com.
                    <div>
                        <table>
                            <thead>
                            <tr>
                                <th>Device</th>
                            </tr>
                            </thead>
                            <tbody>
                            { devices.supported.map( (device) =>
                                    (
                                        <tr key={ device.device.UDN } >
                                            <td>
                                                <span>{ device.device.device.friendlyName }</span>
                                            </td>
                                        </tr>
                                    )
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
                }
                <p>
                    <button onClick={this.handleLogout}>Log Off</button>
                </p>
                <Wemo onDeviceUpdate={this.props.onDeviceUpdate} />
            </div>
        );
    }
}
