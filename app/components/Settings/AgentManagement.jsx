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
  Divider
} from '@material-ui/core';
import {
  Computer as ComputerIcon,
  CloudDownload as DownloadIcon,
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
  const [downloadingPlatform, setDownloadingPlatform] = useState(null);
  const [registrationDialog, setRegistrationDialog] = useState(false);
  const [downloadResultDialog, setDownloadResultDialog] = useState(false);
  const [downloadResult, setDownloadResult] = useState(null);
  const [selectedChild, setSelectedChild] = useState(null);
  const [registrationCode, setRegistrationCode] = useState(null);
  const [serverUrl, setServerUrl] = useState(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  useEffect(() => {
    loadAgents();
    loadServerUrl();
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

  const loadServerUrl = async () => {
    try {
      const result = await ipcRenderer.invoke('agents:get-server-url');
      if (result.success) {
        setServerUrl(result.serverUrl);
      }
    } catch (error) {
      console.error('Error loading server URL:', error);
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const result = await ipcRenderer.invoke('agents:check-updates');
      if (result.success) {
        alert(`Updates checked. ${result.versions.length} version(s) available.`);
      } else {
        alert(`Error checking updates: ${result.error}`);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      alert('Failed to check for updates');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const downloadInstaller = async (platform) => {
    setInstallerDownloading(true);
    setDownloadingPlatform(platform);
    try {
      // Download with auto-generated registration code
      const result = await ipcRenderer.invoke('agents:download-installer', {
        platform,
        childId: 'default-child' // This should be selected from a child list in production
      });

      if (result.success) {
        setDownloadResult({
          platform,
          installerPath: result.installerPath,
          configPath: result.configPath,
          serverUrl: result.serverUrl,
          registrationCode: result.registrationCode,
          version: result.version
        });
        setDownloadResultDialog(true);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error downloading installer:', error);
      alert('Failed to download installer. Ensure you have an internet connection and GitHub is accessible.');
    } finally {
      setInstallerDownloading(false);
      setDownloadingPlatform(null);
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </div>
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
          <div style={{ marginTop: 16 }}>
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
          </div>

          {/* Install Agent Section */}
          <div className={classes.installerSection}>
            <div className={classes.header}>
              <Typography variant="h6">
                Install Agent on a New Device
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={checkForUpdates}
                disabled={checkingUpdates}
              >
                {checkingUpdates ? <CircularProgress size={16} style={{ marginRight: 8 }} /> : <RefreshIcon style={{ marginRight: 8, fontSize: 18 }} />}
                Check for Updates
              </Button>
            </div>

            <Typography variant="body2" paragraph>
              Download the installer for your platform. Each download includes:
            </Typography>
            <ul style={{ marginTop: 0, paddingLeft: 20 }}>
              <li>
                <Typography variant="body2">
                  Platform-specific installer (MSI, PKG, or DEB)
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Pre-configured agent configuration file
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Registration code for easy setup
                </Typography>
              </li>
            </ul>

            {serverUrl && (
              <Typography variant="caption" color="textSecondary" paragraph>
                Server URL: {serverUrl}
              </Typography>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 16, gap: '8px' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => downloadInstaller('win32')}
                disabled={installerDownloading}
              >
                {downloadingPlatform === 'win32' ? (
                  <CircularProgress size={20} style={{ marginRight: 8 }} />
                ) : (
                  <DownloadIcon style={{ marginRight: 8 }} />
                )}
                Windows (MSI)
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={() => downloadInstaller('darwin')}
                disabled={installerDownloading}
              >
                {downloadingPlatform === 'darwin' ? (
                  <CircularProgress size={20} style={{ marginRight: 8 }} />
                ) : (
                  <DownloadIcon style={{ marginRight: 8 }} />
                )}
                macOS (PKG)
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={() => downloadInstaller('linux')}
                disabled={installerDownloading}
              >
                {downloadingPlatform === 'linux' ? (
                  <CircularProgress size={20} style={{ marginRight: 8 }} />
                ) : (
                  <DownloadIcon style={{ marginRight: 8 }} />
                )}
                Linux (DEB)
              </Button>
            </div>

            <div style={{ marginTop: 16 }}>
              <Typography variant="body2" color="textSecondary">
                Downloads are saved to your Downloads folder. The configuration file contains
                pre-configured settings for connecting to this server.
              </Typography>
            </div>
          </div>
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

      {/* Download Result Dialog */}
      <Dialog
        open={downloadResultDialog}
        onClose={() => setDownloadResultDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Agent Installer Downloaded</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom style={{ fontWeight: 'bold' }}>
            Download Complete!
          </Typography>

          {downloadResult && (
            <Fragment>
              <div style={{ marginTop: 16, marginBottom: 16 }}>
                <Typography variant="body2" paragraph>
                  The following files have been downloaded to your Downloads folder:
                </Typography>

                <div
                  style={{
                    padding: 16,
                    marginBottom: 16,
                    backgroundColor: '#f5f5f5',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    fontSize: '0.85rem'
                  }}
                >
                  <Typography variant="body2" gutterBottom>
                    <strong>Installer:</strong>
                  </Typography>
                  <Typography variant="body2" paragraph style={{ wordBreak: 'break-all' }}>
                    {downloadResult.installerPath}
                  </Typography>

                  {downloadResult.configPath && (
                    <Fragment>
                      <Typography variant="body2" gutterBottom>
                        <strong>Configuration:</strong>
                      </Typography>
                      <Typography variant="body2" style={{ wordBreak: 'break-all' }}>
                        {downloadResult.configPath}
                      </Typography>
                    </Fragment>
                  )}
                </div>

                <Divider />

                <div style={{ marginTop: 16, marginBottom: 16 }}>
                  <Typography variant="h6" gutterBottom>
                    Installation Instructions
                  </Typography>

                  <Typography variant="body2" paragraph>
                    <strong>Step 1:</strong> Transfer both files to the target device
                  </Typography>

                  <Typography variant="body2" paragraph>
                    <strong>Step 2:</strong> Run the installer
                    {downloadResult.platform === 'win32' && ' (double-click the MSI file)'}
                    {downloadResult.platform === 'darwin' && ' (double-click the PKG file)'}
                    {downloadResult.platform === 'linux' &&
                      ' (run: sudo dpkg -i <installer-file>)'}
                  </Typography>

                  <Typography variant="body2" paragraph>
                    <strong>Step 3:</strong> When prompted, use this registration code:
                  </Typography>

                  <div className={classes.registrationCode}>
                    {downloadResult.registrationCode || 'No code generated'}
                  </div>

                  <Typography variant="body2" paragraph>
                    <strong>Step 4:</strong> The agent will automatically connect to:
                  </Typography>

                  <div
                    style={{
                      padding: 8,
                      marginBottom: 16,
                      backgroundColor: '#f5f5f5',
                      borderRadius: 4,
                      fontFamily: 'monospace'
                    }}
                  >
                    <Typography variant="body2">{downloadResult.serverUrl}</Typography>
                  </div>

                  <Typography variant="caption" color="textSecondary">
                    The configuration file contains all necessary settings for the agent to
                    connect to this Allow2Automate server. Version: {downloadResult.version}
                  </Typography>
                </div>
              </div>
            </Fragment>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (downloadResult && downloadResult.registrationCode) {
                navigator.clipboard.writeText(downloadResult.registrationCode);
                alert('Registration code copied to clipboard!');
              }
            }}
            color="primary"
          >
            Copy Code
          </Button>
          <Button onClick={() => setDownloadResultDialog(false)} color="primary" variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
