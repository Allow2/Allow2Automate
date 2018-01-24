allow2wemo
==========

Example of how to monitor and control devices associated with child accounts.

refer to https://github.com/Allow2/Allow2.github.io/wiki for more details.

# Installation

Clone the repo, then install packages and run allow2wemo to discover devices.

```js
npm install
node index.js
```

If you leave this running and turn devices on and off, you will see the device names
and uuids.

```js
Wemo Device Found Michaels Light 221244K11009A3
Wemo Device Found Janes Fan 221524S0000F65
Wemo Device Found Garage Light 221351K13015D7
Michaels Light  changed to off
Garage Light  changed to off
Michaels Light  changed to on
Michaels Light  changed to off
```

Here you can see the IDs for Michaels Bedroom Light and Janes Bedroom Fan.

Due to how the discovery process works for Wemo devices, you may need to leave it running for a minute or so
to have it discover all devices on your network.

## installing the service

Once configured (see below) and tested, you can install the service to start on boot:
```js
sudo node install.js
```

And also uninstall using the appropriate script:
```js
sudo node unistall.js
```

# Pairing

Set up a pairing with Allow2 for any of these devices

```js
> node node_modules/allow2/a2pair.js -u your@allow2.account.email -p yourpassword 221244K11009A3 "Michaels Light"
null { status: 'success', pairId: 18066, userId: 10278, children: [{ id: 4238, name: 'Michael' }, { id: 76533, name: 'Jane' }] }
```
NOTE: production is not yet live on the new API, so use staging instead (below).

### Working on the staging environment:

To work on the staging environment, pass '-s' to a2pair:

```js
> node node_modules/allow2/a2pair.js -u your@allow2.account.email -p yourpassword -s 221244K11009A3 "Michaels Light"
null { status: 'success', pairId: 18066, userId: 10278, children: [{ id: 4238, name: 'Michael' }, { id: 76533, name: 'Jane' }] }
```

Then set up the config.js file:

```js
    devices: {
        '221244K11009A3' : {    // Michael's light
            userId: 10278,
            pairId: 18066,
            deviceToken: 'wSUWvPoeYpFl1tNd',
            childId: 4238,
            tz: 'Australia/Sydney',
            activities: [{
                id: 7,
                log: true
            }],
            staging: true
        }
    },
```
note: id 7 = electricity
note: wSUWvPoeYpFl1tNd = pre-created Wemo Allow2 Device, or you can create your own as a developer for your product.

## A note on pairing

You can configure allow2wemo 2 different ways.

As "devices" in Allow2 typically refer to a single device (such as a light switch, globe, fan, etc)
then you really should use a2pair to create pairing for each device separately and use those pairings in the config.js file.

You CAN (if individual device granularity is not important to you) use a single pairing for all devices in the config.js file
but the offshoot will be that pairing should be called "wemo devices" and you will only see one device in Allow2 that represents all
wemo devices in the house.

## todo

* add a pairing function for initial setup / installation
* add command-line functions to update pairings
* add notifications if devices go missing?
