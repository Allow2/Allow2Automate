import { createSelector } from 'reselect';

const sortedVisibleDevicesSelector = createSelector(
    [state => state.devices],
    (devices) => {
        if (!devices) { return []; }
        var result = Object.values(devices).sort((a,b) => a.device.device.friendlyName.localeCompare(b.device.device.friendlyName));
        //result.push({
        //    device: {
        //        UDN : 'test001',
        //        device: {
        //            friendlyName: 'Test Device'
        //        }
        //    },
        //    state: true
        //});
        return result;
    }
);

module.exports = {
    sortedVisibleDevicesSelector
};