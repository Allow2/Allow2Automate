import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Plugin from '../components/Plugin';
import configurationActions from '../actions/configuration';

const mapStateToProps = (state) => {
    return {};  // hide the overall state from the plugin
};

const mapDispatchToProps = (dispatch) => {
    const configuration = bindActionCreators(configurationActions, dispatch);
    return {
        updateData: (data) => {
            configuration.updateData(data);
        }
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Plugin);
