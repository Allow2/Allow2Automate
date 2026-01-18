/**
 * Child Picker Modal Entry Point
 *
 * This is a standalone modal window that allows selecting a child from the account.
 * It receives children data via IPC from the main process and returns the selection.
 *
 * API:
 *   Input (via 'childPicker:options' IPC):
 *     - children: Array of child objects [{id, name, pin, ...}]
 *     - currentSelection: string | null - currently selected child ID
 *     - title: string - modal title
 *     - allowClear: boolean - show clear button
 *     - context: object - any additional context passed back in result
 *
 *   Output (via 'childPicker:result' IPC):
 *     - { selected: true, childId: string, childName: string, context: object }
 *     - { cleared: true, context: object }
 *     - { cancelled: true, context: object }
 */

import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { ipcRenderer } from 'electron';
import { allow2AvatarURL } from './util';
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
    CircularProgress,
    ThemeProvider,
    createTheme
} from '@material-ui/core';
import { Check, Close, Clear } from '@material-ui/icons';

// Create Material-UI theme
const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
});

class ChildPickerModal extends Component {
    constructor(props) {
        super(props);

        this.state = {
            children: [],
            selectedChildId: null,
            currentSelection: null,
            title: 'Select a Child',
            allowClear: true,
            context: {},
            loading: true
        };
    }

    componentDidMount() {
        // Listen for options from main process
        ipcRenderer.on('childPicker:options', (event, options) => {
            console.log('[ChildPicker] Received options:', options);
            this.setState({
                children: options.children || [],
                selectedChildId: options.currentSelection || null,
                currentSelection: options.currentSelection || null,
                title: options.title || 'Select a Child',
                allowClear: options.allowClear !== false,
                context: options.context || {},
                loading: false
            });
        });

        // Request options (in case we missed the initial send)
        ipcRenderer.send('childPicker:ready');
    }

    componentWillUnmount() {
        ipcRenderer.removeAllListeners('childPicker:options');
    }

    handleSelect = (childId) => {
        this.setState({ selectedChildId: childId });
    };

    handleConfirm = () => {
        const { selectedChildId, children, context } = this.state;

        if (!selectedChildId) {
            return;
        }

        const selectedChild = children.find(c => c.id === selectedChildId);

        // Send result back to main process
        ipcRenderer.send('childPicker:result', {
            selected: true,
            childId: selectedChildId,
            childName: selectedChild ? selectedChild.name : null,
            context: context
        });
    };

    handleClear = () => {
        const { context } = this.state;

        // Send clear result back to main process
        ipcRenderer.send('childPicker:result', {
            cleared: true,
            context: context
        });
    };

    handleCancel = () => {
        const { context } = this.state;

        // Send cancel result back to main process
        ipcRenderer.send('childPicker:result', {
            cancelled: true,
            context: context
        });
    };

    render() {
        const {
            children,
            selectedChildId,
            currentSelection,
            title,
            allowClear,
            loading
        } = this.state;

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
                    </Toolbar>
                </AppBar>

                {/* Content */}
                <Box flex={1} overflow="auto" p={2} style={{ backgroundColor: '#f5f5f5' }}>
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
                                onClick={() => {
                                    require('electron').shell.openExternal('https://app.allow2.com/children');
                                }}
                                style={{ marginTop: 16 }}
                            >
                                Go to Allow2
                            </Button>
                        </Box>
                    ) : (
                        <Paper elevation={1}>
                            {/* Show warning if current selection doesn't exist */}
                            {currentSelection && !currentSelectionExists && (
                                <Box p={2} style={{ backgroundColor: '#fff3e0' }}>
                                    <Typography variant="body2" color="textSecondary">
                                        The previously assigned child is no longer available.
                                        Please select a new child or clear the assignment.
                                    </Typography>
                                </Box>
                            )}

                            <List disablePadding>
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
                                                    primaryTypographyProps={{ style: { fontWeight: isSelected ? 600 : 400 } }}
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
                <Box p={2} style={{ backgroundColor: '#fff', borderTop: '1px solid #e0e0e0' }}>
                    <Box display="flex" justifyContent="space-between">
                        <Box>
                            {allowClear && (
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    onClick={this.handleClear}
                                    startIcon={<Clear />}
                                >
                                    Clear
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

// Render the component
const rootElement = document.querySelector(document.currentScript.getAttribute('data-container'));

ReactDOM.render(
    <ThemeProvider theme={theme}>
        <ChildPickerModal />
    </ThemeProvider>,
    rootElement
);
