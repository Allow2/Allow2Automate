import React, { useState, useEffect, Fragment } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Box,
  Divider
} from '@material-ui/core';
import {
  Computer as ComputerIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Add as AddIcon
} from '@material-ui/icons';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  root: {
    margin: theme.spacing(2),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  agentItem: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(1),
  },
  onlineChip: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
  },
  offlineChip: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
  },
  installerSection: {
    marginTop: theme.spacing(3),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
  registrationCode: {
    fontFamily: 'monospace',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    padding: theme.spacing(1),
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    textAlign: 'center',
    margin: theme.spacing(2, 0),
  },
}));

export default function AgentManagement({ ipcRenderer }) {
  const classes = useStyles();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [installerDownloading, setInstallerDownloading] = useState(false);
  const [registrationDialog, setRegistrationDialog] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const [registrationCode, setRegistrationCode] = useState(null);

  useEffect(() => {
    loadAgents();
    const interval = setInterval(loadAgents, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadAgents = async () => {
    try {
      const result = await ipcRenderer.invoke('agents:list');
      if (result.success) {
        setAgents(result.agents);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadInstaller = async (platform) => {
    setInstallerDownloading(true);
    try {
      const result = await ipcRenderer.invoke('agents:download-installer', { platform });
      if (result.success) {
        alert(`Installer downloaded to: ${result.path}`);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error downloading installer:', error);
      alert('Failed to download installer');
    } finally {
      setInstallerDownloading(false);
    }
  };

  const generateRegistrationCode = async (childId) => {
    try {
      const result = await ipcRenderer.invoke('agents:generate-code', { childId });
      if (result.success) {
        setRegistrationCode(result.code);
        setRegistrationDialog(true);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error generating registration code:', error);
      alert('Failed to generate registration code');
    }
  };

  const deleteAgent = async (agentId) => {
    if (!confirm('Are you sure you want to remove this agent?')) {
      return;
    }

    try {
      const result = await ipcRenderer.invoke('agents:delete', { agentId });
      if (result.success) {
        loadAgents(); // Refresh the list
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      alert('Failed to delete agent');
    }
  };

  const formatLastSeen = (lastHeartbeat) => {
    if (!lastHeartbeat) return 'Never';

    const now = Date.now();
    const lastSeen = new Date(lastHeartbeat).getTime();
    const diffSeconds = Math.floor((now - lastSeen) / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} minutes ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hours ago`;
    return `${Math.floor(diffSeconds / 86400)} days ago`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div className={classes.root}>
      <Card>
        <CardContent>
          <div className={classes.header}>
            <Typography variant="h5" component="h2">
              Network Device Monitoring
            </Typography>
            <IconButton onClick={loadAgents} color="primary">
              <RefreshIcon />
            </IconButton>
          </div>

          <Typography variant="body2" color="textSecondary" paragraph>
            Monitor and control applications on computers in your home network.
            Install the Allow2Automate Agent on each device you want to monitor.
          </Typography>

          <Divider />

          {/* Agent List */}
          <Box mt={2}>
            <Typography variant="h6" gutterBottom>
              Registered Agents ({agents.length})
            </Typography>

            {agents.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                No agents registered yet. Download and install an agent below.
              </Typography>
            ) : (
              <List>
                {agents.map((agent) => (
                  <ListItem key={agent.id} className={classes.agentItem}>
                    <ComputerIcon style={{ marginRight: 16 }} />
                    <ListItemText
                      primary={agent.hostname || 'Unknown Device'}
                      secondary={
                        <Fragment>
                          <Typography component="span" variant="body2">
                            Platform: {agent.platform || 'Unknown'} | Version: {agent.version || 'Unknown'}
                          </Typography>
                          <br />
                          <Typography component="span" variant="body2">
                            Last seen: {formatLastSeen(agent.last_heartbeat)}
                            {agent.child_name && ` | Child: ${agent.child_name}`}
                          </Typography>
                        </Fragment>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={agent.online ? 'Online' : 'Offline'}
                        size="small"
                        className={agent.online ? classes.onlineChip : classes.offlineChip}
                        style={{ marginRight: 8 }}
                      />
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => deleteAgent(agent.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          {/* Install Agent Section */}
          <Box className={classes.installerSection}>
            <Typography variant="h6" gutterBottom>
              Install Agent on a New Device
            </Typography>

            <Typography variant="body2" paragraph>
              Download the installer for your platform and run it on the device you want to monitor.
            </Typography>

            <Box display="flex" gap={2} flexWrap="wrap">
              <Button
                variant="contained"
                color="primary"
                startIcon={installerDownloading ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={() => downloadInstaller('win32')}
                disabled={installerDownloading}
              >
                Windows Installer
              </Button>

              <Button
                variant="contained"
                color="primary"
                startIcon={installerDownloading ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={() => downloadInstaller('darwin')}
                disabled={installerDownloading}
              >
                macOS Installer
              </Button>

              <Button
                variant="contained"
                color="primary"
                startIcon={installerDownloading ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={() => downloadInstaller('linux')}
                disabled={installerDownloading}
              >
                Linux Installer
              </Button>
            </Box>

            <Box mt={2}>
              <Typography variant="body2" color="textSecondary">
                After installing, you'll need a registration code to link the agent to a child.
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => {
                  // This would open a child selector dialog
                  // For now, using a placeholder childId
                  generateRegistrationCode('placeholder-child-id');
                }}
                style={{ marginTop: 8 }}
              >
                Generate Registration Code
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Registration Code Dialog */}
      <Dialog
        open={registrationDialog}
        onClose={() => setRegistrationDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Agent Registration Code</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            Use this code during agent installation to link it to a child's profile.
            This code will expire in 24 hours.
          </Typography>

          <div className={classes.registrationCode}>
            {registrationCode}
          </div>

          <Typography variant="caption" color="textSecondary">
            Enter this code when prompted during agent installation.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegistrationDialog(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
