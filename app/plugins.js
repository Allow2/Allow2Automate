const fs = require('fs');
const path = require('path');

module.exports = function(app) {
    var plugins = {
        library: {},
        installed: {},
        configured: {
            "i78g98g98g": {
                plugin: "battle.net",
                data: {
                    name: "Cody",
                    url: "https://us.battle.net/account/parental-controls/manage.html?key=GF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    key: "GF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    childId: 3
                }
            },
            "siugikv89is": {
                plugin: "battle.net",
                data: {
                    name: "Mandy",
                    url: "https://us.battle.net/account/parental-controls/manage.html?key=dF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    key: "dF5C30A125702AC5BADF93B43805BA86975B883EDBAD0926ECDA278D640CE3847",
                    childId: 4
                }
            }

    };

    function installPlugin(plugin, callback) {
        // give this a plugin spec (from the catalogue) and it will pull it down as a package and install it (also runs npm for sub dependencies).
        // have a look at how nodered does this maybe? Might have a best practice approach.
//         var fs = require('fs')
//         var resolve = require('path').resolve
//         var join = require('path').join
//         var cp = require('child_process')
//         var os = require('os')
//
// // get library path
//         var lib = resolve(__dirname, '../lib/')
//
//         fs.readdirSync(lib)
//             .forEach(function (mod) {
//                 var modPath = join(lib, mod)
// // ensure path has package.json
//                 if (!fs.existsSync(join(modPath, 'package.json'))) return
//
// // npm binary based on OS
//                 var npmCmd = os.platform().startsWith('win') ? 'npm.cmd' : 'npm'
//
// // install folder
//                 cp.spawn(npmCmd, ['i'], { env: process.env, cwd: modPath, stdio: 'inherit' })
//             })
    }

    function initPlugins() {
        //const userDataPath = (app || remote.app).getPath('userData');
        const userDataPath = app.getPath('userData');
        // We'll use the `configName` property to set the file name and path.join to bring it all together as a string
        app.pluginPath = path.join(userDataPath, "PlugIns");
        console.log("Loading Plugins from " + app.pluginPath);

        plugins.library = {
            "wow": {
                "name": "wow",
                "version": "1.0.0",
                "description": "Enable Allow2Automate management of World of Warcraft parental controls",
                "main": "index.js",
                "scripts": {
                    "test": "echo \"Error: no test specified\" && exit 1"
                },
                "keywords": [
                    'allow2automate'
                ],
                "author": "",
                "license": "ISC"
            },
            "ssh": {
                "name": "ssh",
                "version": "1.0.0",
                "description": "Enable Allow2Automate the ability to use ssh to configure devices",
                "main": "index.js",
                "scripts": {
                    "test": "echo \"Error: no test specified\" && exit 1"
                },
                "keywords" : [
                    'allow2automate'
                ],
                "author": "",
                "license": "ISC"
            },
            "mcafeesafefamily": {
                "name": "mcafeesafefamily",
                "version": "1.0.0",
                "description": "Enable Allow2Automate the ability to use ssh to configure devices",
                "main": "index.js",
                "scripts": {
                    "test": "echo \"Error: no test specified\" && exit 1"
                },
                "keywords" : [
                    'allow2automate'
                ],
                "author": "",
                "license": "ISC"
            }
        }
    }
    }

    initPlugins();

    return plugins;
}