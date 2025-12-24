import { createAction } from 'redux-actions';

export default {
    // Plugin search and filtering
    setSearchQuery: createAction('MARKETPLACE_SET_SEARCH_QUERY'),
    setCategoryFilter: createAction('MARKETPLACE_SET_CATEGORY_FILTER'),

    // Plugin installation/uninstallation
    installPlugin: createAction('MARKETPLACE_INSTALL_PLUGIN'),
    uninstallPlugin: createAction('MARKETPLACE_UNINSTALL_PLUGIN'),
    installPluginSuccess: createAction('MARKETPLACE_INSTALL_PLUGIN_SUCCESS'),
    installPluginFailure: createAction('MARKETPLACE_INSTALL_PLUGIN_FAILURE'),

    // Plugin details
    selectPlugin: createAction('MARKETPLACE_SELECT_PLUGIN'),
    clearSelectedPlugin: createAction('MARKETPLACE_CLEAR_SELECTED_PLUGIN'),

    // Loading states
    setLoading: createAction('MARKETPLACE_SET_LOADING'),

    // Plugin ratings and reviews
    ratePlugin: createAction('MARKETPLACE_RATE_PLUGIN'),
    addReview: createAction('MARKETPLACE_ADD_REVIEW'),

    // Featured plugins
    setFeaturedPlugins: createAction('MARKETPLACE_SET_FEATURED_PLUGINS'),

    // Marketplace data refresh
    refreshMarketplace: createAction('MARKETPLACE_REFRESH'),
    marketplaceRefreshSuccess: createAction('MARKETPLACE_REFRESH_SUCCESS'),
    marketplaceRefreshFailure: createAction('MARKETPLACE_REFRESH_FAILURE')
};
