Allow2Automate
==============

This is a userspace app for Mac OSX, Linux and Windows that can be deployed to all relevant
App Stores for these platforms.

The intention is:
1. Provide a base, self contained Electron User Space App that:
    * Provides a fully self-contained app to run in user space with no elevated privileges.
    * Manages an overall user connection to the API back end (rest based)
    * Allows the user to see and monitor Wemo, Homekit and other devices on the local network
    * Switched to a pluggable architecture to support other integrations - now you can publish your own integrations with other services/devices
    * Allows to "connect" (pair) devices selectively to (and remove them from) the currently active Allow2 account
    * May allow some other basic functions in future
2. Provide a separate capability to detect (and authenticate against?) a separate elevated daemon service that runs
on system boot.
3. Includes the ability to automatically install the elevated daemon service where the relevant App Store
allows the binary to provide that capability.
4. Includes a reference to how to download and install the separate daemon installer for those App Stores that
do not permit the background process to be included in the installer (Yes Apple, I am looking at you!).

The base operation is intended to show a "Network Wide" view of all detected automation devices, and provide the ability to
link/authenticate with them directly, with bridges and otherwise, and de-duplicate any that may come through separate channels
(ie: direct wemo connections and the same device via a homekit bridge).
It also provides a pluggable module framework to support communication with 3rd party services and devices.

# Screenshots

![Allow2Automate on OSX](/ScreenShots/Screen%20Shot%204.png?raw=true "Allow2Automate on OSX")

# Development notes

The following provides more detail on the structure and intent of the application and components.

## Installation

This is a standard electron app, to get started simply clone the repo and run npm install.

```sh
git clone https://github.com/Allow2/Allow2Automate.git
cd Allow2Automate
npm install
```

To run in dev mode (launch the user space app with hot-loader):

```sh
npm run develop
```

## Deployment

To build for all platforms:

```sh
npm run pack
```

or for a specific platform:

## Mac App Store

```sh
npm run pack:mac
```

```sh
./sign.sh
```

Then upload with *Application Loader*

## Windows App Store

NOTE: cannot currently build on Mac without using a Paid pro version of Parallel.
So need to do that, or build on a VM

```sh
npm run pack:win
```

Then drag into https://developer.microsoft.com/

## Linux Snap

```sh
npm run pack:linux
```

```sh
snapcraft push dist/Allow2Automate_1.1.0_amd64.snap
```

# Notes

For installation of the daemon helper:
[https://www.npmjs.com/package/electron-sudo](https://www.npmjs.com/package/electron-sudo)

# Creating PlugIns

Plugins are new and provide an ability to hook in to Allow2 and use it to control external devices/etc. For example, if you use battle.net parental controls,
they provide no API and are not integrated with Allow2. However, you can develop a plugin and submit it to the directory and within that plugin
create the necessary bridge to translate controls.

The rationale is if users can set up a process on their own computer or device, and put their credentials in that instance, then it is inherently
more secure. The endpoint on the parents home network has the credentials in a highly decentralised model. Otherwise they would need to entrust
their credentials to a cloud service. This is inherently less secure and also creates a much bigger target for hackers.

In the case of battle.net (one of the examples), it uses web calls to the html page and scrapes it using the supplied credentials. This enables
the end user to set it up and have the Allow2 controls take effect on the web interface for battle.net parental controls.

The second example (both are on github) is a ssh plugin. This can be set to trigger on "interesting" state changes (ie: child 2 runs out of
internet time) and do an automatic ssh to a device and run a pre-configured command, this also looks for a return code to indicate if there is a
success or failure. This can be used to do things like ssh in to a flashed router and run a script to change firewall rules and reboot the router.
Or it could ssh into a light and run a script or command to turn it red.

Plugins package.json require a few extra fields:
allow2Token: create a new "app/device" token at https://developer.allow2.com/ and enter that token here. All plugins need to have a token to
communicate with the Allow2 platform.
engines: { "allow2automate": "*" } - specifies the version range with which the plugin is tested/compatible.

## Analytics & Privacy

Allow2Automate includes **Firebase Analytics** to help us improve the product and better understand how plugins are being used. This data helps us:

- **Improve User Experience**: Understand which features are most valuable to parents
- **Plugin Insights**: Identify popular plugins and usage patterns to guide marketplace recommendations
- **Product Development**: Make data-driven decisions about which features to enhance
- **Support**: Correlate usage data with user support requests for faster troubleshooting

### What We Track

- **App Usage**: Application startup, navigation, feature usage
- **Plugin Lifecycle**: Installation, activation, deactivation, and deletion of plugins
- **Plugin Interactions**: Settings changes, authentication events, blocking/unblocking actions
- **Marketplace Activity**: Plugin searches, views, and installations
- **Usage Aggregation**: How frequently plugins are used (e.g., gaming control frequency)

### Privacy & Your Data

- **User ID**: We track Allow2 user IDs to enable support correlation and user journey analysis
- **No Personal Information**: We do not collect passwords, personal messages, or sensitive data
- **Transparency**: All analytics events are documented in `/docs/ANALYTICS_EVENT_CATALOG.md`
- **Open Source**: The analytics implementation is fully visible in this repository

### Analytics Architecture

Analytics data is tagged by installation source:
- **Official Builds**: Mac App Store, Microsoft Store, Snap Store
- **Development Builds**: Includes git branch and commit information
- **Custom Builds**: Forks and custom installations are separately identified

This helps us understand the distribution of our user base and focus improvements on official channels.

For developers adding new features, analytics integration is **mandatory**. See `/docs/ANALYTICS_INTEGRATION_GUIDE.md` for implementation guidelines.