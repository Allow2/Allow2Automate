import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { allow2Request, allow2AvatarURL } from '../util';
import Dialogs from 'dialogs';
import { visibleConfigurationsByPluginSelector } from '../selectors';
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
import semver from 'semver';

import { remote, ipcRenderer as ipc } from 'electron';

var dialogs = Dialogs({});


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
            pairing: false,
            library: {
                "allow2-battle.net": {
                    id: "allow2-battle.net",
                    name: "battle.net",
                    publisher: "allow2",
                    releases: {
                        latest: "1.0.0"
                    },
                    description: "Enable Allow2Automate management of World of Warcraft parental controls",
                    main: "./lib/battle.net",
                    repository: {
                        type: "git",
                        url: "https://github.com/Allow2/allow2automate-battle.net"
                    },
                    keywords: [
                        'allow2automate', 'battle.net', 'wow', 'world of warcraft'
                    ]
                },
                "allow2-ssh": {
                    id: "allow2-ssh",
                    name: "ssh",
                    publisher: "allow2",
                    releases: {
                        latest: "1.0.0"
                    },
                    description: "Enable Allow2Automate the ability to use ssh to configure devices",
                    main: "./lib/ssh",
                    repository: {
                        type: "git",
                        url: "https://github.com/Allow2/allow2automate-ssh"
                    },
                    keywords : [
                        'allow2automate', 'allow2', 'ssh'
                    ]
                },
                "mcafee-safefamily": {
                    id: "mcafee-safefamily",
                    name: "safefamily",
                    publisher: "mcafee",
                    releases: {
                        latest: "1.0.0"
                    },
                    description: "Enable Allow2Automate management of McAfee Safe Family parental controls",
                    repository: {
                        type: "git",
                        url: "https://github.com/McAfee/allow2automate-safefamily"
                    },
                    keywords : [
                        'allow2automate', 'mcafee', 'safefamily'
                    ]
                },
                "allow2-facebook": {
                    id: "allow2-facebook",
                    name: "facebook",
                    publisher: "allow2",
                    releases: {
                        latest: "1.0.0"
                    },
                    description: "Enable Allow2Automate management of Facebook parental controls",
                    main: "./lib/facebook",
                    repository: {
                        type: "git",
                        url: "https://github.com/Allow2/allow2automate-ssh"
                    },
                    keywords : [
                        'allow2automate', 'allow2', 'facebook'
                    ]
                }
            }
        };
    }

    componentDidMount = () => {

        // const ipc = require('electron').ipcRenderer;
        // ipc.on('device', (event, message) => {
        //     console.log(message);
        //     this.setState(message);
        // });
        //
        // allow2Request('/rest/info',
        //     {
        //         auth: {
        //             bearer: this.props.user.access_token
        //         },
        //         body: {
        //         }
        //     },
        //
        //     function (error, response, body) {
        //         if (error) {
        //             return dialogs.alert(error.toString());
        //         }
        //         if (!response) {
        //             return dialogs.alert('Invalid Response');
        //         }
        //         if (body && body.message) {
        //             return dialogs.alert(body.message);
        //         }
        //         return dialogs.alert('Oops');
        //     },
        //
        //     this.props.onNewData);
    };

    // handlePair = (children, childArray) => {
    //     if (childArray.length < 1) {
    //         return;
    //     }
    //
    //     this.setState({
    //         ...this.state,
    //         pairing: true
    //     });
    //
    //     let child = children[childArray[0]];
    //     let device = this.state.device;
    //     let onPaired = this.props.onPaired;
    //
    //     allow2Request('/rest/pairDevice',
    //         {
    //             auth: {
    //                 bearer: this.props.user.access_token
    //             },
    //             body: {
    //                 device: device.UDN,
    //                 name: device.device.friendlyName,
    //                 token: this.state.token,
    //                 childId: child.id
    //             }
    //         },
    //
    //         function (error, response, body) {
    //             console.log(error, response, body);
    //             this.setState({
    //                 ...this.state,
    //                 pairing: false
    //             });
    //             if (error) {
    //                 return dialogs.alert(error.toString());
    //             }
    //             if (!response) {
    //                 return dialogs.alert('Invalid Response');
    //             }
    //             if (body && body.message) {
    //                 return dialogs.alert(body.message);
    //             }
    //             return dialogs.alert(response.statusMessage);
    //         }.bind(this),
    //
    //         function(data) {
    //             console.log(data);
    //             onPaired({ [device.UDN] : data });
    //             var window = remote.getCurrentWindow();
    //             window.close();
    //             ipc.send('setBinaryState');
    //         }.bind(this)
    //     );
    // };

    handleCancel = (e) => {
        var window = remote.getCurrentWindow();
        window.close();
    };

    render() {
        let plugins = visibleConfigurationsByPluginSelector(this.props);
        let title = 'Plugins';
        let progress = <LinearProgress mode="indeterminate" />;
        console.log('Plugins', plugins);
        let displayItems = Object.keys(this.state.library).reduce(function(memo, key) {
            let item = this.state.library[key];
            let plugin = memo[key] || { id: item.id, name: item.name };
            plugin.library = item;
            memo[key] = plugin;
            return memo;
        }.bind(this), plugins);
        let displayItemsSorted = Object.values(displayItems).sort(function(a, b) {
            return (a.name || a.id).localeCompare(b.name || b.id);
        });
        console.log('displayItems', displayItems, displayItemsSorted);
        return (
            <div>
                <AppBar
                    title={ title }
                    iconElementLeft={<IconButton disabled={this.state.pairing} onClick={this.handleCancel}><NavigationClose /></IconButton>}
                    iconElementRight={<FlatButton disabled={this.state.pairing} onClick={this.handleCancel} label="Cancel" />}
                    />
                <div>
                    { progress }
                    { displayItemsSorted.length > 0 &&
                    <Table>
                        <TableHeader>
                            <TableRow key={'header'}>
                                <TableHeaderColumn>
                                    Plugin
                                </TableHeaderColumn>
                                <TableHeaderColumn>
                                    Uses
                                </TableHeaderColumn>
                                <TableHeaderColumn>
                                    Installed
                                </TableHeaderColumn>
                                <TableHeaderColumn>
                                    Latest
                                </TableHeaderColumn>
                                <TableHeaderColumn>
                                    Action
                                </TableHeaderColumn>
                            </TableRow>
                        </TableHeader>
                        <TableBody
                            displayRowCheckbox={false}
                            showRowHover={true}
                            stripedRows={true}>
                            { displayItemsSorted.map(function (plugin) {
                                    let imageName = 'test.png';
                                    console.log('key', plugin.id);
                                    return (
                                        <TableRow
                                            key={plugin.id}
                                            selectable={true}>
                                            <TableRowColumn>
                                                <span>{plugin.id}</span>
                                            </TableRowColumn>
                                            <TableRowColumn>
                                                <span>{plugin.configurations && plugin.configurations.length}</span>
                                            </TableRowColumn>
                                            <TableRowColumn>
                                                <span>{plugin.version}</span>
                                            </TableRowColumn>
                                            <TableRowColumn>
                                                { plugin.library && plugin.version &&
                                                <span>{plugin.library.releases.latest}</span>
                                                }
                                                { !plugin.library &&
                                                <span>Not Found</span>
                                                }
                                            </TableRowColumn>
                                            <TableRowColumn>
                                                { plugin.library && !plugin.version &&
                                                <span>Install</span>
                                                }
                                                { plugin.library && plugin.version && semver.lt(plugin.version, plugin.library.releases.latest) &&
                                                <span>Update</span>
                                                }
                                                { plugin.version &&
                                                <span>Remove</span>
                                                }
                                            </TableRowColumn>
                                        </TableRow>
                                    );
                                }.bind(this)
                            )}
                        </TableBody>
                    </Table>
                    }
                </div>
            </div>
        );
    }
}
