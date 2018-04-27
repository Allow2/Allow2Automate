import { connect } from 'react-redux';
import { push } from 'react-router-redux';
import { bindActionCreators } from 'redux';
import Pair from '../components/Pair';
import allActions from '../actions';

const mapStateToProps = (state) => {
    return state;
};

const mapDispatchToProps = (dispatch) => { // eslint-disable-line no-unused-vars
    const actions = bindActionCreators(allActions, dispatch);
    return {

        onNewData: (data) => {
            actions.newData(data);
        },

        onPaired: (data) => {
            actions.pairingUpdate(data);
        }
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Pair);
