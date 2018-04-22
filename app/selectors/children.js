import { createSelector } from 'reselect';

const sortedVisibleChildrenSelector = createSelector(
    [state => state.children],
    (children) => {
        if (!children) { return []; }
        var result = Object.values(children).sort((a,b) => a.name.localeCompare(b.name));
        return result;
    }
);

module.exports = {
    sortedVisibleChildrenSelector
};