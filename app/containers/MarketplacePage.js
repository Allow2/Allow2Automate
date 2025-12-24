import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Marketplace from '../components/Marketplace';
import actions from '../actions';

const mapStateToProps = (state, ownProps) => {
    return {
        pluginLibrary: state.pluginLibrary,
        installedPlugins: state.installedPlugins,
        marketplace: state.marketplace,
        searchQuery: state.marketplace.searchQuery,
        categoryFilter: state.marketplace.categoryFilter,
        selectedPlugin: state.marketplace.selectedPlugin,
        isLoading: state.marketplace.isLoading,
        featuredPlugins: state.marketplace.featuredPlugins,
        installationStatus: state.marketplace.installationStatus,
        // Pass through props from parent
        showCloseButton: ownProps.showCloseButton,
        onClose: ownProps.onClose
    };
};

const mapDispatchToProps = (dispatch) => {
    return bindActionCreators({
        onInstallPlugin: (pluginName, callback) => {
            return (dispatch, getState) => {
                // Set loading state
                dispatch(actions.installPlugin(pluginName));
                dispatch(actions.setLoading(true));

                try {
                    // Add to installed plugins
                    dispatch(actions.installedPluginUpdate({
                        [pluginName]: {
                            name: pluginName,
                            enabled: true,
                            installedAt: Date.now()
                        }
                    }));

                    // Mark as successfully installed
                    dispatch(actions.installPluginSuccess(pluginName));
                    dispatch(actions.setLoading(false));

                    if (callback) {
                        callback(null);
                    }
                } catch (error) {
                    // Handle installation failure
                    dispatch(actions.installPluginFailure({
                        pluginName,
                        error: error.message
                    }));
                    dispatch(actions.setLoading(false));

                    if (callback) {
                        callback(error);
                    }
                }
            };
        },
        onUninstallPlugin: actions.uninstallPlugin,
        onSearchChange: actions.setSearchQuery,
        onCategoryChange: actions.setCategoryFilter,
        onSelectPlugin: actions.selectPlugin,
        onClearSelection: actions.clearSelectedPlugin,
        onRefreshMarketplace: actions.refreshMarketplace
    }, dispatch);
};

export default connect(mapStateToProps, mapDispatchToProps)(Marketplace);
