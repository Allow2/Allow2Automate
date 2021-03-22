import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2Request, allow2AvatarURL } from '../util';
import Dialogs from 'dialogs';
import { sortedVisibleChildrenSelector } from '../selectors';
import {
    AppBar,
    Toolbar,
    IconButton,
    CircularProgress,
    LinearProgress,
    Button,
    Avatar } from '@material-ui/core';
import {
    Paper,
    Table,
    TableBody,
    TableHead,
    TableContainer,
    TableRow,
    TableCell,
    } from '@material-ui/core';
import { Close } from '@material-ui/icons';

import { remote, ipcRenderer as ipc } from 'electron';

var dialogs = Dialogs({});

var deviceImages = {
    LightSwitch: 'wemo_lightswitch',
    Socket: 'wemo_switch',
    Maker: 'wemo_maker',
    Smart: 'wemo_smart_switch',
    Bulb: 'wemo_bulb'
};


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
                onPaired({ [device.UDN] : data });
                var window = remote.getCurrentWindow();
                window.close();
                ipc.send('setBinaryState');
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
        //    <Button disabled={this.state.pairing} onClick={this.handleCancel} label="Cancel" />;
        let progress = <LinearProgress mode="indeterminate" />;
        let imageName = this.state.device && deviceImages[this.state.device.device.modelName];
        return (
            <div>
                <AppBar position="static">
                    <Toolbar>
                        <IconButton
                            color="primary"
                            aria-label="install plugin"
                            component="span"
                            disabled={this.state.pairing}
                            onClick={this.handleCancel} >
                            <Close />
                        </IconButton>
                        { title }
                        <Button disabled={this.state.pairing} onClick={this.handleCancel} label="Cancel">Cancel</Button>
                    </Toolbar>
                </AppBar>
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
                { //onRowSelection={this.handlePair.bind(this, children)}
                    children.length > 0 &&
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead displaySelectAll={false}>
                            <TableRow key="HeaderRow">
                                <TableCell>Select a Child for this device</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            { children.map((child) => {
                                    let url = allow2AvatarURL(null, child);
                                    return (
                                        <TableRow key={ child.id }>
                                            <TableCell>
                                                <Avatar src={url} />
                                            </TableCell>
                                            <TableCell>
                                                { child.name }
                                            </TableCell>
                                        </TableRow>
                                    );
                                }
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                }
            </div>
        );
    }
}
// selectable={!this.state.pairing && (this.state.token != null)}
// { imageName &&
// <div align="center">
//     <img width="200" height="200" src={ 'assets/img/' + imageName + '.png' } />
// </div>
// }
// { (this.state.pairing || !this.state.device) && progress}
// { children.length < 1 &&
// <p>
//     Could not see any children in your account. Please set up some children and try again.
//     <a href="https://app.allow.com/children">Go to Allow2</a>
// </p>
// }
// { children.length > 0 &&
// <Table onRowSelection={this.handlePair.bind(this, children)}>
//     <TableHeader displaySelectAll={false}>
//         <TableRow>
//             <TableHeaderColumn>Select a Child for this device</TableHeaderColumn>
//         </TableRow>
//     </TableHeader>
//     <TableBody>
//         { children.map((child) => {
//                 let url = allow2AvatarURL(null, child);
//                 return (
//                     <TableRow key={ child.id }>
//                         <TableRowColumn>
//                             <Avatar src={url} />
//                         </TableRowColumn>
//                         <TableRowColumn>
//                             { child.name }
//                         </TableRowColumn>
//                     </TableRow>
//                 );
//             }
//         )}
//     </TableBody>
// </Table>
// }