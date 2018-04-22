import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2Request } from '../util';
import Dialogs from 'dialogs';
import { sortedVisibleChildrenSelector } from '../selectors';

const remote = require('electron').remote;

var dialogs = Dialogs({});

export default class Pair extends Component {
    static propTypes = {
        onNewData: PropTypes.func.isRequired,
        onPaired: PropTypes.func.isRequired
    };

    componentDidMount = () => {
        allow2Request('/rest/info',
            {
                auth: {
                    bearer: this.props.user.access_token
                },
                //headers: {
                //    Bearer: this.props.user.access_token
                //},
                body: {
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

            this.props.onNewData);
    };

    handlePair = () => {
        allow2Request('/rest/pairDevice',
            {
                auth: {
                    bearer: this.props.user.access_token
                },
                //headers: {
                //    Bearer: this.props.user.access_token
                //},
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
        let children = sortedVisibleChildrenSelector(this.props);
        return (
            <div>
                <h2>Link xxxx</h2>
                { children.length < 1 &&
                    <p>
                        Could not see any children in your account. Please set up some children and try again.
                        <a href="https://app.allow.com/children">Go to Allow2</a>
                    </p>
                }
                { children.length > 0 &&
                <table>
                    <thead>
                    <tr>
                        <th>Select a Child for this device</th>
                    </tr>
                    </thead>
                    <tbody>
                    { children.map((child) =>
                            (
                                <tr key={ child.id }>
                                    <td>
                                        <span>{ child.name }</span>
                                    </td>
                                </tr>
                            )
                    )}
                    </tbody>
                </table>
                }

                <p>
                    <button onClick={this.handleCancel}>Cancel</button>
                </p>
            </div>
        );
    }
}
