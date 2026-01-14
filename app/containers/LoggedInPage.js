import { connect } from 'react-redux';
import { push } from 'react-router-redux';
import { bindActionCreators } from 'redux';
import LoggedIn from '../components/LoggedIn';
import allActions from '../actions';

const mapStateToProps = (state) => {
    return state;
};

const mapDispatchToProps = (dispatch) => { // eslint-disable-line no-unused-vars
    const actions = bindActionCreators(allActions, dispatch);
    return {

        onLogout: (data) => {
            actions.logout(data);
            dispatch(push('/'));
        },

        onDeviceUpdate: (data) => {
            console.log('onDeviceUpdate', data);
            actions.deviceUpdate(data);
        },

        onUpdateConfiguration: (pluginName, configuration) => {
            actions.configurationUpdate({
                [pluginName]: configuration
            });
        },

        onSetPluginEnabled: ( pluginName, isChecked ) => {
            console.log('[PluginPersistence] Setting plugin enabled:', pluginName, isChecked);
            actions.setPluginEnabled({
                pluginName: pluginName,
                isChecked: isChecked
            });
            console.log('[PluginPersistence] Action dispatched - auto-save will trigger in 1s');
        },

        onPluginInstalled: (data) => {
            console.log('[PluginPersistence] Installing plugin:', Object.keys(data));
            actions.installedPluginUpdate(data);
            console.log('[PluginPersistence] Action dispatched - auto-save will trigger in 1s');
        },

        onPluginRemoved: (data) => {
            console.log('[PluginPersistence] Removing plugin:', data.pluginName);
            actions.installedPluginRemove(data);
            console.log('[PluginPersistence] Action dispatched - auto-save will trigger in 1s');
        }

    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LoggedIn);
