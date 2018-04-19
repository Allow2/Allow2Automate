import { connect } from 'react-redux';
import { push } from 'react-router-redux';
import { bindActionCreators } from 'redux';
import LoggedIn from '../components/LoggedIn';
import userActions from '../actions/user';
import deviceActions from '../actions/device';

const mapStateToProps = (state) => {
    return state;
};

const mapDispatchToProps = (dispatch) => { // eslint-disable-line no-unused-vars
    const user = bindActionCreators(userActions, dispatch);
    const device = bindActionCreators(deviceActions, dispatch);
    return {

        onLogout: (data) => {
            user.logout(data);
            dispatch(push('/'));
        },

        onDeviceUpdate: (data) => {
            device.update(data);
        },

        onDeviceActive: (UDN, active) => {
            device.setActive({
                UDN: UDN,
                active: active
            });
        },

        onPaired: (data) => {
            console.log(data);
            //device.paired(data);
        }
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LoggedIn);
