import React, { Component } from 'react';
import PropTypes from 'prop-types';
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
    Paper
} from '@material-ui/core';
import {
    Search,
    GetApp,
    CheckCircle,
    Extension,
    Close
} from '@material-ui/icons';
import Dialogs from 'dialogs';

const dialogs = Dialogs({});

export default class Marketplace extends Component {
    static propTypes = {
        pluginLibrary: PropTypes.object,
        installedPlugins: PropTypes.object,
        onInstallPlugin: PropTypes.func.isRequired,
        showCloseButton: PropTypes.bool,
        onClose: PropTypes.func
    };

    state = {
        searchQuery: '',
        selectedCategory: 'all',
        installing: {}
    };

    handleSearchChange = (event) => {
        this.setState({
            searchQuery: event.target.value
        });
    };

    handleInstall = (pluginName) => {
        const { installedPlugins, onInstallPlugin } = this.props;

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
                dialogs.alert(`Failed to install ${pluginName}: ${error.toString()}`);
            } else {
                dialogs.alert(`${pluginName} installed successfully!`);
            }
        });
    };

    isPluginInstalled = (pluginName) => {
        const { installedPlugins } = this.props;
        return installedPlugins && installedPlugins[pluginName];
    };

    getFilteredPlugins = () => {
        const { pluginLibrary } = this.props;
        const { searchQuery, selectedCategory } = this.state;

        if (!pluginLibrary || Object.keys(pluginLibrary).length === 0) {
            return [];
        }

        return Object.entries(pluginLibrary).filter(([name, plugin]) => {
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
    };

    getCategories = () => {
        const { pluginLibrary } = this.props;
        if (!pluginLibrary) return ['all'];

        const categories = new Set(['all']);
        Object.values(pluginLibrary).forEach(plugin => {
            if (plugin.category) {
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
            'notification': 'primary'
        };
        return colors[category] || 'default';
    };

    render() {
        const { pluginLibrary, showCloseButton, onClose } = this.props;
        const { searchQuery, selectedCategory, installing } = this.state;
        const filteredPlugins = this.getFilteredPlugins();
        const categories = this.getCategories();

        if (!pluginLibrary) {
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
                    <CircularProgress />
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
                        overflow: 'auto',
                        position: 'relative',
                        borderRadius: '8px'
                    }}
                >
                    <Box p={3}>
                        {/* Header with close button */}
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Box>
                                <Typography variant="h4" gutterBottom>
                                    Plugin Marketplace
                                </Typography>
                                <Typography variant="body1" color="textSecondary">
                                    Discover and install plugins to extend Allow2 Automate functionality
                                </Typography>
                            </Box>
                            {showCloseButton && onClose && (
                                <IconButton
                                    onClick={onClose}
                                    style={{
                                        position: 'absolute',
                                        top: 16,
                                        right: 16
                                    }}
                                    aria-label="close marketplace"
                                >
                                    <Close />
                                </IconButton>
                            )}
                        </Box>

                {/* Search Bar */}
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="Search plugins..."
                            value={searchQuery}
                            onChange={this.handleSearchChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search />
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Grid>

                    {/* Category Filters */}
                    <Grid item xs={12}>
                        <Box display="flex" gap={1} flexWrap="wrap">
                            {categories.map(category => (
                                <Chip
                                    key={category}
                                    label={category.charAt(0).toUpperCase() + category.slice(1)}
                                    onClick={() => this.setState({ selectedCategory: category })}
                                    color={selectedCategory === category ? 'primary' : 'default'}
                                    variant={selectedCategory === category ? 'default' : 'outlined'}
                                />
                            ))}
                        </Box>
                    </Grid>

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

                            return (
                                <Grid item xs={12} sm={6} md={4} key={plugin.name}>
                                    <Card
                                        elevation={2}
                                        style={{
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                    >
                                        <CardContent style={{ flexGrow: 1 }}>
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
                                            </Box>

                                            <Typography variant="body2" color="textSecondary" paragraph>
                                                {plugin.description || 'No description available'}
                                            </Typography>

                                            {plugin.version && (
                                                <Typography variant="caption" color="textSecondary">
                                                    Version: {plugin.version}
                                                </Typography>
                                            )}

                                            {plugin.author && (
                                                <Typography variant="caption" color="textSecondary" display="block">
                                                    By: {plugin.author}
                                                </Typography>
                                            )}
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
            </Box>
        );
    }
}
