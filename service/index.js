var Wemo = new require('wemo-client');
var async = require('async');
var allow2 = require('allow2');
var config = require('./config');

console.log(config);

// set up a timer to check everything
var runningDevices = {};
var clients = {};

var wemo = new Wemo();

// need to call this a few times (and every so often) to discover all devices, and devices may change.
function pollDevices() {

    // the callback MAY be called if an existing device changes, so we need to cope with that.
    wemo.discover(function(err, deviceInfo) {

        if (err) {
            console.log('discovery error', err);
            return;
        }

        console.log('Wemo Device Found', deviceInfo.friendlyName, deviceInfo.serialNumber);

        // Get the client for the found device
        var client = wemo.client(deviceInfo);

        // todo: how do we correctly replace and clean up?
        var existing = clients[deviceInfo.serialNumber];
        if (existing) {
            existing.on('error', null);
            existing.on('binaryState', null);
            //existing.destroy();
        }

        clients[deviceInfo.serialNumber] = client;

        client.on('error', function(err) {
            console.log(deviceInfo.friendlyName, deviceInfo.serialNumber, 'Error: %s', err.code);
        });

        // Handle BinaryState events
        client.on('binaryState', function(value) {
            console.log(client.device.friendlyName, ' changed to', value == 1 ? 'on' : 'off');
            var monitoredDevice = config.devices[client.device.serialNumber];
            // this will implicitly remove devices that are no longer monitored
            if ((value == 1) && monitoredDevice) {
	        monitoredDevice.name = client.device.friendlyName;
                runningDevices[client.device.serialNumber] = monitoredDevice;
            } else {
                delete runningDevices[client.device.serialNumber];
            }
        });
    });
}

pollDevices();
setInterval(pollDevices, 10000);

function checkDevices() {
    async.eachOf(runningDevices, function(device, serial, callback) {
        allow2.check({
            userId: device.userId,
            pairId: device.pairId,
            deviceToken: device.deviceToken,
            childId: device.childId,
            tz: device.tz,
            activities: device.activities,
            //log: true 			// default is true,
	    //staging: device.staging		// default is production
        }, function(err, result) {
            if (err) { return; }    // simple bail out if any errors occur to avoid user not being able to turn on things

            if (!result.allowed) {
                // only need to grab the client to turn it off
                var client = clients[serial];
                console.log( client.device.friendlyName, ' not allowed ', JSON.stringify(result) );
		client.setBinaryState(0);
                return;
            }
	    console.log(device.name, ' is on / running');
            // interpret the result and if not allowed, turn the light back off again!
        });
    })
}

var timer = setInterval(checkDevices, 5000); // doesn't matter we poll every 5 seconds, calls to the web api are throttled and 

//var wemoSwitch = new WeMo('192.168.0.39', 49153);
//
//wemoSwitch.setBinaryState(1, function(err, result) { // switch on
//    if (err) console.error(err);
//    console.log(result); // 1
//    wemoSwitch.getBinaryState(function(err, result) {
//        if (err) console.error(err);
//        console.log(result); // 1
//    });
//});
