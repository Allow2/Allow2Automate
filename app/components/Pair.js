import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2Request } from '../util';
import Dialogs from 'dialogs';
import { sortedVisibleChildrenSelector } from '../selectors';
import AppBar from 'material-ui/AppBar';
import IconButton from 'material-ui/IconButton';
import NavigationClose from 'material-ui/svg-icons/navigation/close';
import FlatButton from 'material-ui/FlatButton';
import Avatar from 'material-ui/Avatar';
import {
    Table,
    TableBody,
    TableHeader,
    TableHeaderColumn,
    TableRow,
    TableRowColumn,
    } from 'material-ui/Table';

const remote = require('electron').remote;

var dialogs = Dialogs({});

const apiUrl = 'https://api.allow2.com';

function avatarURL(userId, child) {
    var url = apiUrl + '/avatar?key=account' + userId + '&size=medium';

    if (child) {
        if (child.AccountId) {
            url = apiUrl + '/avatar?key=account' + child.AccountId + '&size=medium';
        } else {
            url = apiUrl + '/avatar?key=child' + child.Parent.id + "-" + child.id + '&size=medium';
        }
    }
    return url;
}


export default class Pair extends Component {
    static propTypes = {
        onNewData: PropTypes.func.isRequired,
        onPaired: PropTypes.func.isRequired
    };

    constructor(...args) {
        super(...args);

        this.state = {
            device: null,
            token: null,
            pairing: false
        };
    }

    componentDidMount = () => {

        const ipc = require('electron').ipcRenderer;
        ipc.on('device', (event, message) => {
            console.log(message);
            this.setState(message);
        });

        allow2Request('/rest/info',
            {
                auth: {
                    bearer: this.props.user.access_token
                },
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

    handlePair = (test1, test2) => {
        this.setState({
            ...this.state,
            pairing: true
        });

        return console.log(test1, test2);
        allow2Request('/rest/pairDevice',
            {
                auth: {
                    bearer: this.props.user.access_token
                },
                body: {
                    device: this.state.device.UDN,
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
        let user = this.props.user;
        let children = sortedVisibleChildrenSelector(this.props);
        let title = this.state.device ? this.state.device.device.friendlyName : 'Loading...';
        return (
            <div>
                <AppBar
                    title={ title }
                    iconElementLeft={<IconButton disabled={this.state.pairing} onClick={this.handleCancel}><NavigationClose /></IconButton>}
                    iconElementRight={<FlatButton disabled={this.state.pairing} onClick={this.handleCancel} label="Cancel" />}
                    />
                { children.length < 1 &&
                    <p>
                        Could not see any children in your account. Please set up some children and try again.
                        <a href="https://app.allow.com/children">Go to Allow2</a>
                    </p>
                }
                { children.length > 0 &&
                <Table onRowSelection={this.handlePair}>
                    <TableHeader displaySelectAll={false}>
                        <TableRow>
                            <TableHeaderColumn>Select a Child for this device</TableHeaderColumn>
                        </TableRow>
                    </TableHeader>
                    <TableBody
                        displayRowCheckbox={false}
                        showRowHover={true}
                        stripedRows={false}
                        >
                    { children.map((child) => {
                            let url = avatarURL(null, child);
                            return (
                                <TableRow key={ child.id }
                                          selectable={!this.state.pairing && (this.state.token != null)}>
                                    <TableRowColumn>
                                        <Avatar src={url} />
                                    </TableRowColumn>
                                    <TableRowColumn>
                                        { child.name }
                                    </TableRowColumn>
                                </TableRow>
                            );
                        }
                    )}
                    </TableBody>
                </Table>
                }
            </div>
        );
    }
}
