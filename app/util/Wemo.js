import React, { Component } from 'react';

var WemoClient = new require('wemo-client');
var async = require('async');


export default class Wemo {

    // set up a timer to check everything
    clients = {};
    wemo = new WemoClient();
    listener = null;

    constructor(listener) {
        this.listener = listener;
        this.pollDevices();
        setInterval(this.pollDevices.bind(this), 10000);
    }

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

            this.clients[client.UDN] = client;

            this.listener && this.listener.onDeviceUpdate && this.listener.onDeviceUpdate({
                [client.UDN]: {
                    type: 'wemo',
                    device: client,
                    state: null
                }
            });

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

                this.listener && this.listener.onDeviceUpdate && this.listener.onDeviceUpdate({
                    [client.UDN]: {
                        type: 'wemo',
                        device: client,
                        state: ( value == 1 )
                    }
                });

            }.bind(this));
        }.bind(this));
    }

    setBinaryState(udn, binaryState, callback) {
        let client = this.clients[udn];
        if (!client) {
            return callback(new Error('not visible'));
        }
        client.setBinaryState(binaryState, callback);
    }

}
