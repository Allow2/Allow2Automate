import { connect } from 'react-redux';
import { push } from 'react-router-redux';
import { bindActionCreators } from 'redux';
import Pair from '../components/Pair';
import userActions from '../actions/user';
import deviceActions from '../actions/device';

const mapStateToProps = (state) => {
    return state;
};

const mapDispatchToProps = (dispatch) => { // eslint-disable-line no-unused-vars
    const user = bindActionCreators(userActions, dispatch);
    const device = bindActionCreators(deviceActions, dispatch);
    return {

        onPaired: (data) => {
            console.log(data);
            //device.paired(data);
        }
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Pair);
