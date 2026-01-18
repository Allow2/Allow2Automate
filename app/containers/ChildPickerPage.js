import { connect } from 'react-redux';
import ChildPicker from '../components/ChildPicker';
import { sortedVisibleChildrenSelector } from '../selectors/children';

const mapStateToProps = (state) => {
    return {
        children: sortedVisibleChildrenSelector(state),
        user: state.user
    };
};

export default connect(mapStateToProps)(ChildPicker);
