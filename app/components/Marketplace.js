import React, { Component } from 'react';
import PropTypes from 'prop-types';
import marked from 'marked';
import {
    Grid,
    Card,
    CardContent,
    CardActions,
    TextField,
    Button,
    Typography,
    Chip,
    Avatar,
    InputAdornment,
    Box,
    CircularProgress,
    IconButton,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tooltip,
    Select,
    MenuItem,
    FormControl
} from '@material-ui/core';
import {
    Search,
    GetApp,
    CheckCircle,
    Extension,
    Close,
    Refresh,
    Warning,
    Error as ErrorIcon,
    Info,
    Sort
} from '@material-ui/icons';
import Dialogs from 'dialogs';
import Analytics from '../analytics';

const dialogs = Dialogs({});

export default class Marketplace extends Component {
    static propTypes = {
        pluginLibrary: PropTypes.object,
        installedPlugins: PropTypes.object,
        onInstallPlugin: PropTypes.func.isRequired,
        showCloseButton: PropTypes.bool,
        onClose: PropTypes.func,
        onRefresh: PropTypes.func,
        registryLoading: PropTypes.bool,
        registryError: PropTypes.object,
        isFromCache: PropTypes.bool,
        cacheTimestamp: PropTypes.number
    };

    state = {
        searchQuery: '',
        selectedCategory: 'all',
        sortOrder: 'name',
        installing: {},
        isRefreshing: false,
        lastRefreshTime: null,
        refreshError: null,
        errorDialogOpen: false,
        errorDetails: null,
        detailDialogOpen: false,
        selectedPlugin: null,
        pluginReadme: null,
        loadingReadme: false
    };

    componentDidMount() {
        Analytics.trackMarketplaceView();
    }

    componentDidUpdate(prevProps) {
        console.log('[Marketplace] componentDidUpdate called');
        console.log('[Marketplace] prevProps.pluginLibrary:', prevProps.pluginLibrary);
        console.log('[Marketplace] this.props.pluginLibrary:', this.props.pluginLibrary);

        // Force re-render when pluginLibrary updates
        if (prevProps.pluginLibrary !== this.props.pluginLibrary) {
            console.log('[Marketplace] pluginLibrary CHANGED!');
            console.log('[Marketplace] Previous keys:', prevProps.pluginLibrary ? Object.keys(prevProps.pluginLibrary).length : 0);
            console.log('[Marketplace] New keys:', this.props.pluginLibrary ? Object.keys(this.props.pluginLibrary).length : 0);
        }

        // Show error dialog when registry error occurs (and not from cache)
        if (this.props.registryError && !prevProps.registryError && !this.props.isFromCache) {
            this.showErrorDialog(this.props.registryError);
        }
    }

    handleSearchChange = (event) => {
        this.setState({
            searchQuery: event.target.value
        });
    };

    handleSortChange = (event) => {
        this.setState({
            sortOrder: event.target.value
        });
        Analytics.trackMarketplaceSort(event.target.value);
    };

    handleRefresh = async () => {
        const { lastRefreshTime } = this.state;
        const now = Date.now();
        const minimumInterval = 5000; // 5 seconds

        // Check rate limit
        if (lastRefreshTime && (now - lastRefreshTime) < minimumInterval) {
            const remainingTime = Math.ceil((minimumInterval - (now - lastRefreshTime)) / 1000);
            dialogs.alert(`Please wait ${remainingTime} second(s) before refreshing again.`);
            return;
        }

        this.setState({
            isRefreshing: true,
            refreshError: null
        });

        try {
            // Call the plugin registry reload method if available
            if (this.props.pluginLibrary && this.props.pluginLibrary.reload) {
                await this.props.pluginLibrary.reload();
            } else if (this.props.onRefresh) {
                await this.props.onRefresh();
            }

            this.setState({
                isRefreshing: false,
                lastRefreshTime: Date.now()
            });
        } catch (error) {
            this.setState({
                isRefreshing: false,
                refreshError: error.message || 'Failed to refresh marketplace'
            });
            dialogs.alert(`Refresh failed: ${error.message || 'Unknown error'}`);
        }
    };

    handleInstall = (pluginName) => {
        const { installedPlugins, onInstallPlugin, pluginLibrary } = this.props;

        if (installedPlugins && installedPlugins[pluginName]) {
            dialogs.alert(`${pluginName} is already installed.`);
            return;
        }

        this.setState({
            installing: { ...this.state.installing, [pluginName]: true }
        });

        onInstallPlugin(pluginName, (error) => {
            this.setState({
                installing: { ...this.state.installing, [pluginName]: false }
            });

            if (error) {
                // Track failed installation
                const plugin = pluginLibrary ? pluginLibrary[pluginName] : null;
                Analytics.trackPluginInstall(
                    pluginName,
                    pluginName,
                    plugin ? plugin.version : 'unknown'
                );
                Analytics.trackPluginError(
                    pluginName,
                    pluginName,
                    'install_failed',
                    error.toString()
                );

                // Emit error toast event via window event
                window.dispatchEvent(new CustomEvent('show-toast', {
                    detail: {
                        message: `Failed to install ${pluginName}: ${error.toString()}`,
                        severity: 'error'
                    }
                }));
            } else {
                // Track successful installation
                const plugin = pluginLibrary ? pluginLibrary[pluginName] : null;
                Analytics.trackPluginInstall(
                    pluginName,
                    pluginName,
                    plugin ? plugin.version : 'unknown'
                );

                // Emit success toast event via window event
                window.dispatchEvent(new CustomEvent('show-toast', {
                    detail: {
                        message: `${pluginName} installed successfully!`,
                        severity: 'success'
                    }
                }));
            }
        });
    };

    isPluginInstalled = (pluginName) => {
        const { installedPlugins } = this.props;
        return installedPlugins && installedPlugins[pluginName];
    };

    getFilteredPlugins = () => {
        const { pluginLibrary } = this.props;
        const { searchQuery, selectedCategory, sortOrder } = this.state;

        if (!pluginLibrary || Object.keys(pluginLibrary).length === 0) {
            return [];
        }

        const filtered = Object.entries(pluginLibrary).filter(([name, plugin]) => {
            // Skip null/undefined plugins
            if (!plugin) return false;

            // Skip metadata properties (start with _)
            if (name.startsWith('_')) return false;

            const matchesSearch = searchQuery === '' ||
                name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (plugin.description && plugin.description.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesCategory = selectedCategory === 'all' ||
                (plugin.category && plugin.category === selectedCategory);

            return matchesSearch && matchesCategory;
        }).map(([name, plugin]) => ({
            name,
            ...plugin
        }));

        // Sort the filtered plugins
        return filtered.sort((a, b) => {
            switch (sortOrder) {
                case 'name':
                    // Sort alphabetically by name
                    return a.name.localeCompare(b.name);

                case 'newest':
                    // Sort by creation date (newest first)
                    const dateA = new Date(a.createdAt || 0).getTime();
                    const dateB = new Date(b.createdAt || 0).getTime();
                    return dateB - dateA;

                case 'updated':
                    // Sort by last update (most recently updated first)
                    const updateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                    const updateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
                    return updateB - updateA;

                case 'rating':
                    // Sort by rating (highest first)
                    const ratingA = a.rating || 0;
                    const ratingB = b.rating || 0;
                    return ratingB - ratingA;

                default:
                    return 0;
            }
        });
    };

    getCategories = () => {
        const { pluginLibrary } = this.props;
        if (!pluginLibrary) return ['all'];

        const categories = new Set(['all']);
        Object.values(pluginLibrary).forEach(plugin => {
            if (plugin && plugin.category) {
                categories.add(plugin.category);
            }
        });
        return Array.from(categories);
    };

    getCategoryColor = (category) => {
        const colors = {
            'automation': 'primary',
            'integration': 'secondary',
            'utility': 'default',
            'notification': 'primary',
            'gaming': 'primary',
            'connectivity': 'secondary',
            'iot': 'primary',
            'parental-control': 'secondary'
        };
        return colors[category] || 'default';
    };

    handleErrorDialogClose = () => {
        this.setState({ errorDialogOpen: false, errorDetails: null });
    };

    handleOpenPluginDetails = async (plugin) => {
        this.setState({
            detailDialogOpen: true,
            selectedPlugin: plugin,
            pluginReadme: null,
            loadingReadme: true
        });

        // Fetch README from GitHub
        try {
            const repoUrl = plugin.repository && plugin.repository.url;
            if (!repoUrl) {
                this.setState({
                    pluginReadme: '# No README Available\n\nRepository information not found for this plugin.',
                    loadingReadme: false
                });
                return;
            }

            // Extract owner/repo from GitHub URL
            const githubMatch = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
            if (!githubMatch) {
                this.setState({
                    pluginReadme: '# No README Available\n\nCould not parse repository URL.',
                    loadingReadme: false
                });
                return;
            }

            const [, owner, repo] = githubMatch;
            const version = (plugin.releases && plugin.releases.latest) || 'master';

            // Try to fetch README.md from the specific version/tag
            const readmeUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${version}/README.md`;
            console.log('[Marketplace] Fetching README from:', readmeUrl);

            const response = await fetch(readmeUrl);
            if (!response.ok) {
                // Fallback to master/main branch
                const fallbackUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`;
                console.log('[Marketplace] Version README not found, trying master branch:', fallbackUrl);
                const fallbackResponse = await fetch(fallbackUrl);

                if (!fallbackResponse.ok) {
                    throw new Error('README not found');
                }

                const readme = await fallbackResponse.text();
                this.setState({ pluginReadme: readme, loadingReadme: false });
            } else {
                const readme = await response.text();
                this.setState({ pluginReadme: readme, loadingReadme: false });
            }
        } catch (error) {
            console.error('[Marketplace] Failed to fetch README:', error);
            this.setState({
                pluginReadme: `# README Not Available\n\nFailed to fetch README: ${error.message}`,
                loadingReadme: false
            });
        }
    };

    handleClosePluginDetails = () => {
        this.setState({
            detailDialogOpen: false,
            selectedPlugin: null,
            pluginReadme: null,
            loadingReadme: false
        });
    };

    showErrorDialog = (errorDetails) => {
        this.setState({
            errorDialogOpen: true,
            errorDetails
        });
    };


    formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Unknown';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };

    render() {
        const {
            pluginLibrary,
            showCloseButton,
            onClose,
            registryLoading,
            registryError,
            isFromCache,
            cacheTimestamp
        } = this.props;
        const {
            searchQuery,
            selectedCategory,
            installing,
            isRefreshing,
            errorDialogOpen,
            errorDetails,
            detailDialogOpen,
            selectedPlugin,
            pluginReadme,
            loadingReadme
        } = this.state;
        const filteredPlugins = this.getFilteredPlugins();
        const categories = this.getCategories();

        // Show loading spinner if:
        // 1. Registry is actively loading (registryLoading = true), OR
        // 2. pluginLibrary is null, undefined, or empty object
        const isLoading = registryLoading || !pluginLibrary || (typeof pluginLibrary === 'object' && Object.keys(pluginLibrary).length === 0);

        console.log('[Marketplace] render() - pluginLibrary:', pluginLibrary);
        console.log('[Marketplace] render() - registryLoading:', registryLoading);
        console.log('[Marketplace] render() - isLoading:', isLoading);
        console.log('[Marketplace] render() - registryError:', registryError);
        console.log('[Marketplace] render() - isFromCache:', isFromCache);
        console.log('[Marketplace] render() - filteredPlugins length:', filteredPlugins.length);

        // If loading and there's a registry error, show error state with retry
        if (isLoading && registryError && !isFromCache) {
            return (
                <Box
                    position="fixed"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    bgcolor="rgba(0, 0, 0, 0.5)"
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    zIndex={1300}
                >
                    <Paper
                        elevation={8}
                        style={{
                            padding: '48px',
                            maxWidth: '500px',
                            textAlign: 'center',
                            borderRadius: '8px'
                        }}
                    >
                        <ErrorIcon style={{ fontSize: 64, color: '#f44336', marginBottom: 16 }} />
                        <Typography variant="h5" gutterBottom>
                            Unable to Load Plugin Registry
                        </Typography>
                        <Typography variant="body1" color="textSecondary" paragraph>
                            {registryError.errorMessage || 'Please check your internet connection and try again.'}
                        </Typography>
                        <Box mt={3}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={this.handleRefresh}
                                disabled={isRefreshing}
                                startIcon={<Refresh />}
                            >
                                {isRefreshing ? 'Retrying...' : 'Retry'}
                            </Button>
                            {showCloseButton && onClose && (
                                <Button
                                    variant="outlined"
                                    onClick={onClose}
                                    style={{ marginLeft: 16 }}
                                >
                                    Close
                                </Button>
                            )}
                        </Box>
                    </Paper>
                </Box>
            );
        }

        // Show loading spinner during initial load
        if (isLoading) {
            return (
                <Box
                    position="fixed"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    bgcolor="rgba(0, 0, 0, 0.5)"
                    display="flex"
                    flexDirection="column"
                    justifyContent="center"
                    alignItems="center"
                    zIndex={1300}
                >
                    <CircularProgress size={60} />
                    <Typography variant="body1" style={{ marginTop: 24, color: '#fff' }}>
                        Loading plugin marketplace...
                    </Typography>
                </Box>
            );
        }

        return (
            <Box
                position="fixed"
                top={0}
                left={0}
                right={0}
                bottom={0}
                bgcolor="rgba(0, 0, 0, 0.5)"
                display="flex"
                justifyContent="center"
                alignItems="center"
                zIndex={1300}
                style={{ backdropFilter: 'blur(4px)' }}
            >
                <Paper
                    elevation={8}
                    style={{
                        width: '90%',
                        maxWidth: '1200px',
                        height: '90%',
                        maxHeight: '900px',
                        position: 'relative',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}
                >
                    {/* Fixed Top Bar */}
                    <Box
                        p={3}
                        pb={2}
                        style={{
                            flexShrink: 0,
                            borderBottom: '1px solid #e0e0e0',
                            backgroundColor: '#fff'
                        }}
                    >
                        {/* Header with title, refresh, and close */}
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                            <Box flex={1}>
                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                    <Typography variant="h4" style={{ marginBottom: 0 }}>
                                        Plugin Marketplace
                                    </Typography>
                                    {isFromCache && (
                                        <Tooltip title={`Using cached data from ${this.formatTimestamp(cacheTimestamp)}. Network unavailable.`}>
                                            <Warning style={{ color: '#ff9800', fontSize: 28, cursor: 'help', marginLeft: 8 }} />
                                        </Tooltip>
                                    )}
                                </Box>
                                <Typography variant="body1" color="textSecondary" style={{ marginBottom: 4 }}>
                                    Discover and install plugins to extend Allow2 Automate functionality
                                </Typography>
                                {isFromCache && cacheTimestamp && (
                                    <Typography variant="caption" style={{ color: '#ff9800', fontWeight: 500 }}>
                                        Last updated: {this.formatTimestamp(cacheTimestamp)}
                                    </Typography>
                                )}
                            </Box>
                            <Box>
                                <Tooltip title="Refresh marketplace (5 second cooldown)">
                                    <IconButton
                                        onClick={this.handleRefresh}
                                        disabled={isRefreshing}
                                        aria-label="refresh marketplace"
                                        style={{ marginRight: 8 }}
                                    >
                                        <Refresh
                                            style={{
                                                animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                                            }}
                                        />
                                    </IconButton>
                                </Tooltip>
                                {showCloseButton && onClose && (
                                    <IconButton
                                        onClick={onClose}
                                        aria-label="close marketplace"
                                    >
                                        <Close />
                                    </IconButton>
                                )}
                            </Box>
                        </Box>
                        <style>
                            {`
                                @keyframes spin {
                                    from {
                                        transform: rotate(0deg);
                                    }
                                    to {
                                        transform: rotate(360deg);
                                    }
                                }

                                /* Markdown content styling */
                                .markdown-content h1 {
                                    font-size: 2rem;
                                    font-weight: 500;
                                    margin: 16px 0 8px 0;
                                    color: rgba(0, 0, 0, 0.87);
                                }
                                .markdown-content h2 {
                                    font-size: 1.5rem;
                                    font-weight: 500;
                                    margin: 14px 0 8px 0;
                                    color: rgba(0, 0, 0, 0.87);
                                }
                                .markdown-content h3 {
                                    font-size: 1.25rem;
                                    font-weight: 500;
                                    margin: 12px 0 6px 0;
                                    color: rgba(0, 0, 0, 0.87);
                                }
                                .markdown-content p {
                                    margin: 0 0 16px 0;
                                    line-height: 1.6;
                                }
                                .markdown-content code {
                                    background-color: #e0e0e0;
                                    padding: 2px 6px;
                                    border-radius: 3px;
                                    font-family: 'Courier New', monospace;
                                    font-size: 0.875rem;
                                }
                                .markdown-content pre {
                                    background-color: #e0e0e0;
                                    padding: 12px;
                                    border-radius: 4px;
                                    overflow: auto;
                                    margin: 12px 0;
                                }
                                .markdown-content pre code {
                                    background-color: transparent;
                                    padding: 0;
                                }
                                .markdown-content ul, .markdown-content ol {
                                    padding-left: 24px;
                                    margin: 12px 0;
                                }
                                .markdown-content li {
                                    margin: 4px 0;
                                }
                                .markdown-content a {
                                    color: #2196f3;
                                    text-decoration: none;
                                }
                                .markdown-content a:hover {
                                    text-decoration: underline;
                                }
                                .markdown-content blockquote {
                                    border-left: 4px solid #e0e0e0;
                                    padding-left: 16px;
                                    margin: 12px 0;
                                    color: rgba(0, 0, 0, 0.6);
                                }
                                .markdown-content table {
                                    border-collapse: collapse;
                                    width: 100%;
                                    margin: 12px 0;
                                }
                                .markdown-content th, .markdown-content td {
                                    border: 1px solid #e0e0e0;
                                    padding: 8px;
                                    text-align: left;
                                }
                                .markdown-content th {
                                    background-color: #f5f5f5;
                                    font-weight: 500;
                                }
                            `}
                        </style>

                        {/* Warning Banner for Offline/Cache Mode */}
                        {isFromCache && registryError && (
                            <Box
                                bgcolor="#fff3e0"
                                border="1px solid #ff9800"
                                borderRadius="4px"
                                p={2}
                                mb={2}
                                display="flex"
                                alignItems="center"
                                justifyContent="space-between"
                            >
                                <Box display="flex" alignItems="center" gap={1}>
                                    <Warning style={{ color: '#ff9800' }} />
                                    <Box>
                                        <Typography variant="body2" style={{ fontWeight: 600 }}>
                                            Offline Mode
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            {registryError.errorMessage || 'Unable to connect to plugin registry.'} Showing cached data.
                                        </Typography>
                                    </Box>
                                </Box>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={this.handleRefresh}
                                    disabled={isRefreshing}
                                    style={{ color: '#ff9800', borderColor: '#ff9800' }}
                                >
                                    Retry
                                </Button>
                            </Box>
                        )}

                        {/* Search Bar and Sort */}
                        <Box display="flex" gap={2} mb={2}>
                            <TextField
                                fullWidth
                                variant="outlined"
                                placeholder="Search plugins..."
                                value={searchQuery}
                                onChange={this.handleSearchChange}
                                size="small"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Search />
                                        </InputAdornment>
                                    )
                                }}
                            />
                            <FormControl variant="outlined" size="small" style={{ minWidth: 180 }}>
                                <Select
                                    value={this.state.sortOrder}
                                    onChange={this.handleSortChange}
                                    startAdornment={
                                        <InputAdornment position="start">
                                            <Sort style={{ marginLeft: 8 }} />
                                        </InputAdornment>
                                    }
                                >
                                    <MenuItem value="name">Sort by Name</MenuItem>
                                    <MenuItem value="newest">Sort by Newest</MenuItem>
                                    <MenuItem value="updated">Sort by Latest Updates</MenuItem>
                                    <MenuItem value="rating">Sort by Highest Rating</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>

                        {/* Category Filters */}
                        <Box display="flex" gap={1} flexWrap="wrap">
                            {categories.map(category => (
                                <Chip
                                    key={category}
                                    label={category.charAt(0).toUpperCase() + category.slice(1)}
                                    onClick={() => this.setState({ selectedCategory: category })}
                                    color={selectedCategory === category ? 'primary' : 'default'}
                                    variant={selectedCategory === category ? 'default' : 'outlined'}
                                    size="small"
                                />
                            ))}
                        </Box>
                    </Box>

                    {/* Scrollable Content Area */}
                    <Box
                        p={3}
                        style={{
                            flexGrow: 1,
                            overflow: 'auto'
                        }}
                    >
                        <Grid container spacing={3}>

                    {/* Plugin Cards */}
                    {filteredPlugins.length === 0 ? (
                        <Grid item xs={12}>
                            <Box textAlign="center" py={6}>
                                <Extension style={{ fontSize: 64, color: '#ccc' }} />
                                <Typography variant="h6" color="textSecondary" style={{ marginTop: 16 }}>
                                    No plugins found
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    {searchQuery ? 'Try adjusting your search' : 'Check back later for new plugins'}
                                </Typography>
                            </Box>
                        </Grid>
                    ) : (
                        filteredPlugins.map(plugin => {
                            const isInstalled = this.isPluginInstalled(plugin.name);
                            const isInstalling = installing[plugin.name];

                            // Debug: Log dev_plugin flag for all plugins
                            console.log('[Marketplace] Rendering plugin:', plugin.name, 'dev_plugin:', plugin.dev_plugin);
                            if (plugin.name && plugin.name.includes('nintendo')) {
                                console.log('[Marketplace] Nintendo plugin FULL OBJECT:', JSON.stringify(plugin, null, 2));
                            }

                            return (
                                <Grid item xs={12} sm={6} md={4} key={plugin.name}>
                                    <Card
                                        elevation={2}
                                        style={{
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            position: 'relative'
                                        }}
                                    >
                                        {/* Dev Plugin Ribbon */}
                                        {plugin.dev_plugin && (
                                            <Box
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    right: 0,
                                                    backgroundColor: '#ff9800',
                                                    color: 'white',
                                                    padding: '4px 12px',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    zIndex: 1,
                                                    borderBottomLeftRadius: '4px',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                    letterSpacing: '0.5px'
                                                }}
                                            >
                                                DEV
                                            </Box>
                                        )}

                                        <CardContent style={{ flexGrow: 1, position: 'relative' }}>
                                            <Box display="flex" alignItems="center" mb={2}>
                                                <Avatar
                                                    style={{
                                                        marginRight: 12,
                                                        backgroundColor: isInstalled ? '#4caf50' : '#2196f3'
                                                    }}
                                                >
                                                    {isInstalled ? (
                                                        <CheckCircle />
                                                    ) : (
                                                        <Extension />
                                                    )}
                                                </Avatar>
                                                <Box flexGrow={1}>
                                                    <Typography variant="h6" noWrap>
                                                        {plugin.shortName || plugin.name}
                                                    </Typography>
                                                    {plugin.category && (
                                                        <Chip
                                                            size="small"
                                                            label={plugin.category}
                                                            color={this.getCategoryColor(plugin.category)}
                                                            style={{ marginTop: 4 }}
                                                        />
                                                    )}
                                                </Box>
                                                <Tooltip title="View plugin details">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => this.handleOpenPluginDetails(plugin)}
                                                        style={{ padding: 4 }}
                                                    >
                                                        <Info />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>

                                            <Typography variant="body2" color="textSecondary" paragraph>
                                                {plugin.description || 'No description available'}
                                            </Typography>

                                            <Box display="flex" flexDirection="column" gap={0.5} mt={1}>
                                                {((plugin.releases && plugin.releases.latest) || plugin.version) && (
                                                    <Typography variant="caption" color="textSecondary">
                                                        Version: {(plugin.releases && plugin.releases.latest) || plugin.version}
                                                    </Typography>
                                                )}

                                                {plugin.publisher && (
                                                    <Typography variant="caption" color="textSecondary">
                                                        Publisher: {plugin.publisher}
                                                    </Typography>
                                                )}

                                                {plugin.author && (
                                                    <Typography variant="caption" color="textSecondary">
                                                        Author: {plugin.author}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </CardContent>

                                        <CardActions>
                                            {isInstalled ? (
                                                <Button
                                                    fullWidth
                                                    variant="outlined"
                                                    color="primary"
                                                    startIcon={<CheckCircle />}
                                                    disabled
                                                >
                                                    Installed
                                                </Button>
                                            ) : (
                                                <Button
                                                    fullWidth
                                                    variant="contained"
                                                    color="primary"
                                                    startIcon={isInstalling ? <CircularProgress size={20} /> : <GetApp />}
                                                    onClick={() => this.handleInstall(plugin.name)}
                                                    disabled={isInstalling}
                                                >
                                                    {isInstalling ? 'Installing...' : 'Install'}
                                                </Button>
                                            )}
                                        </CardActions>
                                    </Card>
                                </Grid>
                            );
                        })
                    )}
                        </Grid>
                    </Box>
                </Paper>

                {/* Error Dialog */}
                <Dialog
                    open={errorDialogOpen}
                    onClose={this.handleErrorDialogClose}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>
                        <Box display="flex" alignItems="center" gap={1}>
                            <ErrorIcon color="error" />
                            <span>Connection Error</span>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" paragraph>
                            {errorDetails && errorDetails.errorMessage ? errorDetails.errorMessage : 'Unable to connect to the plugin registry. Please check your internet connection.'}
                        </Typography>
                        {errorDetails && errorDetails.errorType && (
                            <Typography variant="body2" color="textSecondary" paragraph>
                                Error Type: {errorDetails.errorType}
                            </Typography>
                        )}
                        <Typography variant="body2" color="textSecondary">
                            The marketplace will use cached data if available. You can try refreshing to reconnect.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={this.handleErrorDialogClose} color="primary">
                            Close
                        </Button>
                        <Button
                            onClick={() => {
                                this.handleErrorDialogClose();
                                this.handleRefresh();
                            }}
                            color="primary"
                            variant="contained"
                        >
                            Retry
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Plugin Detail Dialog */}
                <Dialog
                    open={detailDialogOpen}
                    onClose={this.handleClosePluginDetails}
                    maxWidth="md"
                    fullWidth
                    scroll="paper"
                >
                    <DialogTitle>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Box display="flex" alignItems="center" gap={1}>
                                <Extension color="primary" />
                                <span>{selectedPlugin && (selectedPlugin.shortName || selectedPlugin.name)}</span>
                            </Box>
                            <IconButton onClick={this.handleClosePluginDetails} size="small">
                                <Close />
                            </IconButton>
                        </Box>
                    </DialogTitle>
                    <DialogContent dividers>
                        {selectedPlugin && (
                            <Box mb={3}>
                                <Typography variant="body1" paragraph>
                                    {selectedPlugin.description || 'No description available'}
                                </Typography>
                                <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
                                    {selectedPlugin.category && (
                                        <Chip
                                            size="small"
                                            label={selectedPlugin.category}
                                            color={this.getCategoryColor(selectedPlugin.category)}
                                        />
                                    )}
                                    {((selectedPlugin.releases && selectedPlugin.releases.latest) || selectedPlugin.version) && (
                                        <Chip
                                            size="small"
                                            label={'Version: ' + ((selectedPlugin.releases && selectedPlugin.releases.latest) || selectedPlugin.version)}
                                        />
                                    )}
                                    {selectedPlugin.publisher && (
                                        <Chip
                                            size="small"
                                            label={'Publisher: ' + selectedPlugin.publisher}
                                        />
                                    )}
                                </Box>
                            </Box>
                        )}

                        {loadingReadme ? (
                            <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                                <CircularProgress />
                                <Typography variant="body2" color="textSecondary" style={{ marginLeft: 16 }}>
                                    Loading README...
                                </Typography>
                            </Box>
                        ) : pluginReadme ? (
                            <Box
                                className="markdown-content"
                                style={{
                                    backgroundColor: '#f5f5f5',
                                    padding: 16,
                                    borderRadius: 4,
                                    maxHeight: '60vh',
                                    overflow: 'auto'
                                }}
                                dangerouslySetInnerHTML={{
                                    __html: marked(pluginReadme, {
                                        gfm: true,
                                        breaks: true
                                    })
                                }}
                            />
                        ) : (
                            <Typography variant="body2" color="textSecondary">
                                No README available for this plugin.
                            </Typography>
                        )}
                    </DialogContent>
                    <DialogActions>
                        {selectedPlugin && selectedPlugin.repository && selectedPlugin.repository.url && (
                            <Button
                                onClick={() => {
                                    require('electron').shell.openExternal(selectedPlugin.repository.url);
                                }}
                                color="primary"
                            >
                                View on GitHub
                            </Button>
                        )}
                        <Button onClick={this.handleClosePluginDetails} color="primary">
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        );
    }
}
