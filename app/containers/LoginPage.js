import { connect } from 'react-redux';
import { push } from 'react-router-redux';
import { bindActionCreators } from 'redux';
import Login from '../components/Login';
import userActions from '../actions/user';

const mapStateToProps = (state) => {
    return state;
};

const mapDispatchToProps = (dispatch) => {
    const user = bindActionCreators(userActions, dispatch);
    return {
        onLogin: (data) => {
            console.log('onLogin called with data:', data);
            user.login(data);
            // Navigation is handled by childStore.js store subscription
        }
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Login);
