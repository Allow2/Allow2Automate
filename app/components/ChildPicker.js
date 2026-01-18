import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ipcRenderer } from 'electron';
import { allow2AvatarURL } from '../util';
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    ListItemSecondaryAction,
    Paper,
    Box,
    Divider,
    CircularProgress
} from '@material-ui/core';
import { Check, Close, Clear } from '@material-ui/icons';

export default class ChildPicker extends Component {
    static propTypes = {
        children: PropTypes.array.isRequired,
        currentSelection: PropTypes.string,
        title: PropTypes.string,
        allowClear: PropTypes.bool
    };

    static defaultProps = {
        title: 'Select a Child',
        allowClear: true,
        currentSelection: null
    };

    constructor(props) {
        super(props);

        this.state = {
            selectedChildId: props.currentSelection,
            loading: false,
            options: null  // Will be populated via IPC
        };
    }

    componentDidMount() {
        // Listen for options from main process
        ipcRenderer.on('childPicker:options', (event, options) => {
            console.log('[ChildPicker] Received options:', options);
            this.setState({
                selectedChildId: options.currentSelection || null,
                options: options
            });
        });
    }

    componentWillUnmount() {
        ipcRenderer.removeAllListeners('childPicker:options');
    }

    handleSelect = (childId) => {
        this.setState({ selectedChildId: childId });
    };

    handleConfirm = () => {
        const { selectedChildId } = this.state;
        const { children } = this.props;

        if (!selectedChildId) {
            return;
        }

        const selectedChild = children.find(c => c.id === selectedChildId);

        // Send result back to main process
        ipcRenderer.send('childPicker:result', {
            selected: true,
            childId: selectedChildId,
            childName: selectedChild ? selectedChild.name : null
        });
    };

    handleClear = () => {
        // Send clear result back to main process
        ipcRenderer.send('childPicker:result', {
            cleared: true
        });
    };

    handleCancel = () => {
        // Send cancel result back to main process
        ipcRenderer.send('childPicker:result', {
            cancelled: true
        });
    };

    render() {
        const { children } = this.props;
        const { selectedChildId, options, loading } = this.state;

        const title = (options && options.title) || this.props.title;
        const allowClear = (options && options.allowClear !== undefined) ? options.allowClear : this.props.allowClear;
        const currentSelection = (options && options.currentSelection) || this.props.currentSelection;

        // Check if current selection exists in children list
        const currentSelectionExists = currentSelection && children.some(c => c.id === currentSelection);

        return (
            <Box display="flex" flexDirection="column" height="100vh">
                {/* Header */}
                <AppBar position="static" color="primary">
                    <Toolbar>
                        <Typography variant="h6" style={{ flexGrow: 1 }}>
                            {title}
                        </Typography>
                        <Button
                            color="inherit"
                            onClick={this.handleCancel}
                            startIcon={<Close />}
                        >
                            Cancel
                        </Button>
                    </Toolbar>
                </AppBar>

                {/* Content */}
                <Box flex={1} overflow="auto" p={2}>
                    {loading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                            <CircularProgress />
                        </Box>
                    ) : children.length === 0 ? (
                        <Box textAlign="center" py={4}>
                            <Typography variant="h6" color="textSecondary">
                                No Children Found
                            </Typography>
                            <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
                                Please add children to your Allow2 account first.
                            </Typography>
                            <Button
                                variant="outlined"
                                color="primary"
                                href="https://app.allow2.com/children"
                                target="_blank"
                                style={{ marginTop: 16 }}
                            >
                                Go to Allow2
                            </Button>
                        </Box>
                    ) : (
                        <Paper elevation={1}>
                            {/* Show warning if current selection doesn't exist */}
                            {currentSelection && !currentSelectionExists && (
                                <Box p={2} bgcolor="warning.light">
                                    <Typography variant="body2" color="textSecondary">
                                        The previously assigned child is no longer available.
                                        Please select a new child or clear the assignment.
                                    </Typography>
                                </Box>
                            )}

                            <List>
                                {children.map((child, index) => {
                                    const isSelected = selectedChildId === child.id;
                                    const avatarUrl = allow2AvatarURL(null, child);

                                    return (
                                        <React.Fragment key={child.id}>
                                            {index > 0 && <Divider />}
                                            <ListItem
                                                button
                                                selected={isSelected}
                                                onClick={() => this.handleSelect(child.id)}
                                                style={{
                                                    backgroundColor: isSelected ? 'rgba(25, 118, 210, 0.12)' : undefined
                                                }}
                                            >
                                                <ListItemAvatar>
                                                    <Avatar src={avatarUrl} alt={child.name}>
                                                        {child.name ? child.name[0].toUpperCase() : '?'}
                                                    </Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={child.name}
                                                    secondary={child.pin ? `PIN: ${child.pin}` : null}
                                                />
                                                {isSelected && (
                                                    <ListItemSecondaryAction>
                                                        <Check color="primary" />
                                                    </ListItemSecondaryAction>
                                                )}
                                            </ListItem>
                                        </React.Fragment>
                                    );
                                })}
                            </List>
                        </Paper>
                    )}
                </Box>

                {/* Footer Actions */}
                <Box p={2} bgcolor="background.paper" borderTop={1} borderColor="divider">
                    <Box display="flex" justifyContent="space-between">
                        <Box>
                            {allowClear && (
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    onClick={this.handleClear}
                                    startIcon={<Clear />}
                                >
                                    Clear Assignment
                                </Button>
                            )}
                        </Box>
                        <Box>
                            <Button
                                variant="outlined"
                                onClick={this.handleCancel}
                                style={{ marginRight: 8 }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={this.handleConfirm}
                                disabled={!selectedChildId}
                                startIcon={<Check />}
                            >
                                Select
                            </Button>
                        </Box>
                    </Box>
                </Box>
            </Box>
        );
    }
}
