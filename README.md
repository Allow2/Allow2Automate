Allow2Automate
==============

This is a userspace app for Mac OSX, Linux and Windows that can be deployed to all relevant
App Stores for these platforms.

The intention is:
1. Provide a base, self contained Electron User Space App that:
    * Provides a fully self-contained app to run in user space with no elevated privileges.
    * Manages an overall user connection to the API back end (rest based)
    * Allows the user to see and monitor Wemo, Homekit and other devices on the local network
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

```sh
npm run pack:mac
```

## Mac App Store


```sh
./sign.sh
```

Then upload with *Application Loader*


# Notes

For installation of the daemon helper:
[https://www.npmjs.com/package/electron-sudo](https://www.npmjs.com/package/electron-sudo)
