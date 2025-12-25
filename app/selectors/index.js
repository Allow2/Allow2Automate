import children from './children';
import plugins from './plugins';
import pluginStatus from './pluginStatus';

module.exports = {
    ...children,
    ...plugins,
    ...pluginStatus
};
