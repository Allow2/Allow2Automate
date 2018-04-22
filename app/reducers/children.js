import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({
    [actions.newData]: (state, action) => {
        let children = action.payload.children;
        if (!children) {
            return { ...state };
        }

        let newState = action.payload.children.reduce( function(memo, child) {
            memo[child.id] = child;
            return memo;
        }, {});
        return newState;
    }
}, {});
