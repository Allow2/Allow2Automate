import { handleActions } from 'redux-actions';
import actions from '../actions';

const initialState = {
    searchQuery: '',
    categoryFilter: 'all',
    selectedPlugin: null,
    isLoading: false,
    registryLoading: false, // Track registry loading state
    registryError: null, // Track registry errors
    isFromCache: false, // Track if data is from cache
    cacheTimestamp: null, // When cache was created
    featuredPlugins: [],
    installationStatus: {},
    error: null
};

export default handleActions({
    [actions.setSearchQuery]: (state, action) => {
        return {
            ...state,
            searchQuery: action.payload
        };
    },

    [actions.setCategoryFilter]: (state, action) => {
        return {
            ...state,
            categoryFilter: action.payload
        };
    },

    [actions.selectPlugin]: (state, action) => {
        return {
            ...state,
            selectedPlugin: action.payload
        };
    },

    [actions.clearSelectedPlugin]: (state) => {
        return {
            ...state,
            selectedPlugin: null
        };
    },

    [actions.setLoading]: (state, action) => {
        return {
            ...state,
            isLoading: action.payload
        };
    },

    [actions.installPlugin]: (state, action) => {
        return {
            ...state,
            installationStatus: {
                ...state.installationStatus,
                [action.payload]: 'installing'
            }
        };
    },

    [actions.installPluginSuccess]: (state, action) => {
        return {
            ...state,
            installationStatus: {
                ...state.installationStatus,
                [action.payload]: 'installed'
            },
            error: null
        };
    },

    [actions.installPluginFailure]: (state, action) => {
        return {
            ...state,
            installationStatus: {
                ...state.installationStatus,
                [action.payload.pluginName]: 'failed'
            },
            error: action.payload.error
        };
    },

    [actions.uninstallPlugin]: (state, action) => {
        const newInstallationStatus = { ...state.installationStatus };
        delete newInstallationStatus[action.payload];

        return {
            ...state,
            installationStatus: newInstallationStatus
        };
    },

    [actions.setFeaturedPlugins]: (state, action) => {
        return {
            ...state,
            featuredPlugins: action.payload
        };
    },

    [actions.refreshMarketplace]: (state) => {
        return {
            ...state,
            isLoading: true,
            error: null
        };
    },

    [actions.marketplaceRefreshSuccess]: (state) => {
        return {
            ...state,
            isLoading: false
        };
    },

    [actions.marketplaceRefreshFailure]: (state, action) => {
        return {
            ...state,
            isLoading: false,
            error: action.payload
        };
    },

    [actions.registryLoadStart]: (state) => {
        return {
            ...state,
            registryLoading: true,
            registryError: null
        };
    },

    [actions.registryLoadSuccess]: (state, action) => {
        return {
            ...state,
            registryLoading: false,
            isFromCache: action.payload.isFromCache || false,
            cacheTimestamp: action.payload.cacheTimestamp || null,
            registryError: null
        };
    },

    [actions.registryLoadFailure]: (state, action) => {
        return {
            ...state,
            registryLoading: false,
            registryError: action.payload
        };
    }

}, initialState);
