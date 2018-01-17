let path = require('path');
var Service = require('node-mac').Service;
 
// Create a new service object 
let allow2wemoPath = path.resolve(__dirname, 'index.js');

var svc = new Service({
    name:'Allow2Wemo',
    description: 'Example wemo switch control for Electricity Quotas.',
    script: allow2wemoPath
});
 
// Listen for the "install" event, which indicates the 
// process is available as a service. 
svc.on('install',function(){
    svc.start();
});
 
svc.install();
