import path from 'path';
import fs from 'fs';
var Module = require("module");
import {
    pluginSelector,
    sortedPluginSelector
} from './selectors';

module.exports = function(app, store) {

    //
    // magically insert our node_modules path to plugin module search paths
    //
    const reactPath = require.resolve('react');
    const modulesIndex = reactPath.lastIndexOf("node_modules");
    const ourModulesPath = path.join(reactPath.substring(0, modulesIndex), 'node_modules');
    console.log("injecting ourModulesPath: ", ourModulesPath);
    (function(moduleWrapCopy) {
        Module.wrap = function(script) {
            script = "module.paths.push('" + ourModulesPath + "');" + script;
            return moduleWrapCopy(script);
        };
    })(Module.wrap);

    var plugins = {
        library: {},
        installed: {},
        configured: {
            "d23eb9da-19d6-4898-b56c-02a5a8ca477f": {
                plugin: "battle.net",
                data: {
                    name: "Cody",
                    url: "https://us.battle.net/account/parental-controls/manage.html?key=GF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    key: "GF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    childId: 3
                }
            },
            "2742b8a4-c6e9-416b-9d30-cc7618f5d1b5": {
                plugin: "battle.net",
                data: {
                    name: "Mandy",
                    url: "https://us.battle.net/account/parental-controls/manage.html?key=dF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    key: "dF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    childId: 4
                }
            },
            "9710629a-b82b-436c-8e3c-635861347ba0": {
                plugin: "ssh",
                data: {
                    name: "Router",
                    host: "192.168.0.3",
                    creds: {
                        user: 'user',
                        pass: 'pass'
                        //key: '98y89463087gfp938g74fp9784tgf3'
                    },
                    childId: 4,
                    actions: {
                        4: {
                            3: {
                                on: './enable.sh',
                                off: './disable.sh'
                            }
                        }
                    }
                }
            }
        }
    };

    function handleStateChange() {
        let nextState = store.getState().configurations;
        for (let plugin of Object.values(plugins.installed)) {
            let currentPluginState = plugin.currentState;
            let nextPluginState = nextState[plugin.name];
            console.log(plugin.name, nextPluginState);
            if (nextPluginState !== currentPluginState) {
                plugin.plugin && plugin.plugin.newState && plugin.plugin.newState(nextPluginState);
                plugin.currentState = nextPluginState;
            }
        }
    }

    let unsubscribe = store.subscribe(handleStateChange);
    // TODO: call unsubscribe when shutting down

    function installPlugin(plugin, callback) {
    }

    function initPlugins() {
        //const userDataPath = (app || remote.app).getPath('userData');
        const userDataPath = app.getPath('userData');
        // We'll use the `configName` property to set the file name and path.join to bring it all together as a string
        app.pluginPath = path.join(userDataPath, "Plugins");
        console.log("Loading Plugins from " + app.pluginPath);

        // should be a network call
        // use https://flight-manual.atom.io/atom-server-side-apis/sections/atom-package-server-api/ as an example

        // GET api.allow2.com/automate/packages?page=1&sort=downloads&direction=desc

        plugins.library = {
            "allow2automate-battle.net": {
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
            "allow2automate-ssh": {
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
            }
        }
    }

    //initPlugins();

    plugins.getLibrary = function(callback) {
        callback(null, {
            "allow2automate-battle.net": {
                name: "allow2automate-battle.net",
                shortName: "battle.net",
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
            "allow2automate-ssh": {
                name: "allow2automate-ssh",
                shortName: "ssh",
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
            "allow2automate-wemo": {
                "name": "allow2automate-wemo",
                "shortName" : "wemo",
                publisher: "allow2",
                releases: {
                    latest: "1.0.0"
                },
                "description": "Enable Allow2Automate the ability to control wemo devices",
                "main": "./index.js",
                "repository": {
                    "type": "git",
                        "url": "https://github.com/Allow2/allow2automate-wemo"
                },
                "keywords" : [
                    "allow2automate", "allow2", "wemo"
                ]
            },
            "mcafee-safefamily": {
                name: "mcafee-safefamily",
                shortName: "Safe Family",
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
            }
        });
    };

    plugins.getInstalled = function(callback) {
        let currentState = store.getState().configurations;
        const installedPlugins = app.epm.list(app.appDataPath, { version: true }).reduce(function(memo, plugin) {
            const parts = plugin.split('@');
            const pluginName = parts[0];
            memo[pluginName] = { version: parts[1] };
            try {
                const fullPath = path.join(app.appDataPath, 'plugIns', pluginName);
                let jsonString = fs.readFileSync(path.join(fullPath, 'package.json'), 'utf8');
                //console.log(jsonString);
                let packageJson = JSON.parse(jsonString);
                packageJson.name = pluginName;
                packageJson.shortName = packageJson.shortName || pluginName;
                //packageJson.fullPath = fullpath;
                memo[pluginName] = packageJson;
                console.log('loading', pluginName);
                var loadedPlugin = app.epm.load(app.appDataPath, pluginName);
                //console.log(loadedPlugin.plugin);

                const ipc = {
                    send: (channel, ...args) => { app.ipc.send( plugin.name + '.' + channel, ...args)},
                    on: (channel, listener) => { app.ipc.on( plugin.name + '.' + channel, listener)}
                };

                const configurationUpdate = function(newConfiguration) {
                    console.log("updateConfiguration: ", plugin.name, " = ", newConfiguration);

                };

                const installedPlugin = loadedPlugin.plugin({
                    isMain: true,
                    ipc: ipc,
                    configurationUpdate: configurationUpdate
                });

                let currentPluginState = currentState[pluginName];
                installedPlugin.onLoad && installedPlugin.onLoad(currentPluginState);
                plugins.installed[pluginName] = {
                    name: pluginName,
                    plugin: installedPlugin,
                    currentState: null
                };

            } catch (err) {
                console.log('Error parsing JSON string', err);
            }
            return memo;
        }, {});
        callback(null, installedPlugins);
    };

    return plugins;
};