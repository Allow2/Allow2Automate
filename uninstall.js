let path = require('path');
var Service = require('node-mac').Service;
 
let allow2wemoPath = path.resolve(__dirname, 'index.js');

// Create a new service object 
var svc = new Service({
    name:'Allow2Wemo',
    script: allow2wemoPath
});
 
// Listen for the "uninstall" event so we know when it's done. 
svc.on('uninstall',function(){
    console.log('Uninstall complete.');
    console.log('The service exists: ', svc.exists);
});
 
// Uninstall the service. 
svc.uninstall();

