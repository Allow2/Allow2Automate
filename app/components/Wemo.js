import React, { Component } from 'react';

var WemoClient = new require('wemo-client');
var async = require('async');

export default class Wemo extends Component {

    // set up a timer to check everything
    clients = {};
    wemo = new WemoClient();

    componentDidMount() {
        this.pollDevices();
        setInterval(this.pollDevices.bind(this), 10000);
    }

    //changeState(device, state) {
    //    var client = (device.device);
    //    client.setBinaryState(state ? 1 : 0);
    //}

    // need to call this a few times (and every so often) to discover all devices, and devices may change.
    pollDevices() {

        // the callback MAY be called if an existing device changes, so we need to cope with that.
        this.wemo.discover(function(err, deviceInfo) {

            if (err) {
                console.log('discovery error', err);
                return;
            }

            console.log('Wemo Device Found', deviceInfo.friendlyName, deviceInfo.serialNumber);



            // Get the client for the found device
            var client = this.wemo.client(deviceInfo);

            console.log(client);

            this.props.onDeviceUpdate({
                [client.UDN]: {
                    type: 'wemo',
                    device: client,
                    state: null
                }
            });

            //this.props.onClient({
            //    username: null,
            //    loggedIn: false
            //});

            // todo: how do we correctly replace and clean up?
            //var existing = clients[deviceInfo.serialNumber];
            //if (existing) {
            //    existing.on('error', null);
            //    existing.on('binaryState', null);
            //    //existing.destroy();
            //}

            client.on('error', function(err) {
                console.log(deviceInfo.friendlyName, deviceInfo.serialNumber, 'Error: %s', err.code);
            });

            // Handle BinaryState events
            client.on('binaryState', function(value) {
                console.log(client.device.friendlyName, ' changed to', value == 1 ? 'on' : 'off');

                this.props.onDeviceUpdate({
                    [client.UDN]: {
                        type: 'wemo',
                        device: client,
                        state: ( value == 1 )
                    }
                });

                //var monitoredDevice = config.devices[client.device.serialNumber];
                //// this will implicitly remove devices that are no longer monitored
                //if ((value == 1) && monitoredDevice) {
                //    monitoredDevice.name = client.device.friendlyName;
                //    runningDevices[client.device.serialNumber] = monitoredDevice;
                //} else {
                //    delete runningDevices[client.device.serialNumber];
                //}
            }.bind(this));
        }.bind(this));
    }


    //checkDevices() {
    //    async.eachOf(runningDevices, function(device, serial, callback) {
    //        allow2.check({
    //            userId: device.userId,
    //            pairId: device.pairId,
    //            deviceToken: device.deviceToken,
    //            childId: device.childId,
    //            tz: device.tz,
    //            activities: device.activities,
    //            //log: true 			// default is true,
    //            //staging: device.staging		// default is production
    //        }, function(err, result) {
    //            if (err) { return; }    // simple bail out if any errors occur to avoid user not being able to turn on things
    //
    //            if (!result.allowed) {
    //                // only need to grab the client to turn it off
    //                var client = clients[serial];
    //                console.log( client.device.friendlyName, ' not allowed ', JSON.stringify(result) );
    //                client.setBinaryState(0);
    //                return;
    //            }
    //            console.log(device.name, ' is on / running');
    //            // interpret the result and if not allowed, turn the light back off again!
    //        });
    //    })
    //}
    //
    //var timer = setInterval(checkDevices, 5000); // doesn't matter we poll every 5 seconds, calls to the web api are throttled

    render() {
        return (
            <div>
            </div>
        );
    }
}
