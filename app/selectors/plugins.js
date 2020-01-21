import { createSelector } from 'reselect';

const sortedVisiblePluginsSelector = createSelector(
    [state => state.plugins],
    (plugins) => {
        if (!plugins) { return []; }
        var result = Object.values(plugins).sort((a,b) => a.name.localeCompare(b.name)); // todo: better sorting
        return result;
    }
);

module.exports = {
    sortedVisiblePluginsSelector
};