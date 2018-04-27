import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2Request } from '../util';
import Dialogs from 'dialogs';
import { sortedVisibleChildrenSelector } from '../selectors';
import AppBar from 'material-ui/AppBar';
import IconButton from 'material-ui/IconButton';
import NavigationClose from 'material-ui/svg-icons/navigation/close';
import CircularProgress from 'material-ui/CircularProgress';
import LinearProgress from 'material-ui/LinearProgress';
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

const apiUrl = 'https://staging-api.allow2.com';

var deviceImages = {
    LightSwitch: 'wemo_lightswitch',
    Socket: 'wemo_switch',
    Maker: 'wemo_maker',
    Smart: 'wemo_smart_switch',
    Bulb: 'wemo_bulb'
};

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

    handlePair = (children, childArray) => {
        if (childArray.length < 1) {
            return;
        }

        this.setState({
            ...this.state,
            pairing: true
        });

        let child = children[childArray[0]];
        let device = this.state.device;
        let onPaired = this.props.onPaired;

        onPaired({
            [device.UDN] : {
                ChildId: 68,
                controllerId: 6,
                hidden: null,
                id: 21037,
                lastSeen: 1524727195527,
                lastTimezone: null,
                name: "Codys Light",
                timestamp: 1524727195000,
                type: "PairedDevice"
            }
        });

        var window = remote.getCurrentWindow();
        return window.close();

        allow2Request('/rest/pairDevice',
            {
                auth: {
                    bearer: this.props.user.access_token
                },
                body: {
                    device: device.UDN,
                    name: device.device.friendlyName,
                    token: this.state.token,
                    childId: child.id
                }
            },

            function (error, response, body) {
                console.log(error, response, body);
                this.setState({
                    ...this.state,
                    pairing: false
                });
                if (error) {
                    return dialogs.alert(error.toString());
                }
                if (!response) {
                    return dialogs.alert('Invalid Response');
                }
                if (body && body.message) {
                    return dialogs.alert(body.message);
                }
                return dialogs.alert(response.statusMessage);
            }.bind(this),

            function(data) {
                console.log(data);
                return this.setState({
                        ...this.state,
                    pairing: false
                });
                onPaired(data);
                var window = remote.getCurrentWindow();
                window.close();
            }.bind(this)
        );
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
        //let leftButton = this.state.pairing || !this.state.device ? <CircularProgress /> :
        //    <IconButton disabled={this.state.pairing} onClick={this.handleCancel}><NavigationClose /></IconButton>;
        //let rightButton = this.state.pairing || !this.state.device ? <CircularProgress /> :
        //    <FlatButton disabled={this.state.pairing} onClick={this.handleCancel} label="Cancel" />;
        let progress = <LinearProgress mode="indeterminate" />;
        let imageName = this.state.device && deviceImages[this.state.device.device.modelName];
        return (
            <div>
                <AppBar
                    title={ title }
                    iconElementLeft={<IconButton disabled={this.state.pairing} onClick={this.handleCancel}><NavigationClose /></IconButton>}
                    iconElementRight={<FlatButton disabled={this.state.pairing} onClick={this.handleCancel} label="Cancel" />}
                    />
                { imageName &&
                <div align="center">
                    <img width="200" height="200" src={ 'assets/img/' + imageName + '.png' } />
                </div>
                }
                { (this.state.pairing || !this.state.device) && progress}
                { children.length < 1 &&
                    <p>
                        Could not see any children in your account. Please set up some children and try again.
                        <a href="https://app.allow.com/children">Go to Allow2</a>
                    </p>
                }
                { children.length > 0 &&
                <Table onRowSelection={this.handlePair.bind(this, children)}>
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