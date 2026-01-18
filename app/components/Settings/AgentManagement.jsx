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
  Divider,
  Snackbar,
  Link
} from '@material-ui/core';
import {
  Computer as ComputerIcon,
  CloudDownload as DownloadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  GetApp as GetAppIcon
} from '@material-ui/icons';
import { Alert } from '@material-ui/lab';
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
  platformButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: theme.spacing(2),
    minWidth: 200,
  },
  versionInfo: {
    marginTop: theme.spacing(1),
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  checksumText: {
    fontSize: '0.65rem',
    color: theme.palette.text.disabled,
    fontFamily: 'monospace',
    marginTop: theme.spacing(0.5),
    wordBreak: 'break-all',
    maxWidth: 180,
  },
  uninstallLink: {
    fontSize: '0.7rem',
    marginTop: theme.spacing(0.5),
    cursor: 'pointer',
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
  const [checkingVersions, setCheckingVersions] = useState(false);
  const [versionInfo, setVersionInfo] = useState({});
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    loadAgents();
    loadServerUrl();
    checkLatestVersions();
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

  const showToast = (message, severity = 'info') => {
    setToast({ open: true, message, severity });
  };

  const checkLatestVersions = async () => {
    setCheckingVersions(true);
    try {
      const result = await ipcRenderer.invoke('agents:check-latest-versions');
      if (result.success) {
        setVersionInfo(result.versions);
      } else {
        showToast(`Error checking versions: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error checking for latest versions:', error);
      showToast('Failed to check for latest versions', 'error');
    } finally {
      setCheckingVersions(false);
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
          version: result.version,
          checksum: result.checksum
        });
        setDownloadResultDialog(true);
        showToast('Installer downloaded successfully', 'success');
      } else if (result.cancelled) {
        // User cancelled the save dialog - do nothing silently
      } else {
        showToast(`Error: ${result.error || 'Download failed'}`, 'error');
      }
    } catch (error) {
      console.error('Error downloading installer:', error);
      showToast('Failed to download installer. Ensure you have an internet connection and GitHub is accessible.', 'error');
    } finally {
      setInstallerDownloading(false);
      setDownloadingPlatform(null);
    }
  };

  const downloadUninstallScript = async (platform) => {
    try {
      const result = await ipcRenderer.invoke('agents:download-uninstall-script', { platform });
      if (result.success) {
        showToast(`Uninstall script downloaded: ${result.scriptPath}`, 'success');
      } else {
        showToast(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error downloading uninstall script:', error);
      showToast('Failed to download uninstall script', 'error');
    }
  };

  const generateRegistrationCode = async (childId) => {
    try {
      const result = await ipcRenderer.invoke('agents:generate-code', { childId });
      if (result.success) {
        setRegistrationCode(result.code);
        setRegistrationDialog(true);
      } else {
        showToast(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error generating registration code:', error);
      showToast('Failed to generate registration code', 'error');
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
        showToast('Agent removed successfully', 'success');
      } else {
        showToast(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      showToast('Failed to delete agent', 'error');
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
                onClick={checkLatestVersions}
                disabled={checkingVersions}
              >
                {checkingVersions ? <CircularProgress size={16} style={{ marginRight: 8 }} /> : <RefreshIcon style={{ marginRight: 8, fontSize: 18 }} />}
                Refresh Versions
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

            <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 16, gap: '16px', justifyContent: 'center' }}>
              {/* Windows Platform */}
              <div className={classes.platformButton}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => downloadInstaller('win32')}
                  disabled={installerDownloading || checkingVersions}
                  fullWidth
                >
                  {downloadingPlatform === 'win32' ? (
                    <CircularProgress size={20} style={{ marginRight: 8 }} />
                  ) : (
                    <DownloadIcon style={{ marginRight: 8 }} />
                  )}
                  Windows
                </Button>
                {versionInfo.win32 && (
                  <Fragment>
                    <Typography className={classes.versionInfo}>
                      v{versionInfo.win32.version}
                    </Typography>
                    {versionInfo.win32.checksum && (
                      <Typography className={classes.checksumText} title={versionInfo.win32.checksum}>
                        SHA256: {versionInfo.win32.checksum.substring(0, 16)}...
                      </Typography>
                    )}
                    <Link
                      component="button"
                      variant="body2"
                      className={classes.uninstallLink}
                      onClick={() => downloadUninstallScript('win32')}
                    >
                      Uninstall Script
                    </Link>
                  </Fragment>
                )}
              </div>

              {/* macOS Platform */}
              <div className={classes.platformButton}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => downloadInstaller('darwin')}
                  disabled={installerDownloading || checkingVersions}
                  fullWidth
                >
                  {downloadingPlatform === 'darwin' ? (
                    <CircularProgress size={20} style={{ marginRight: 8 }} />
                  ) : (
                    <DownloadIcon style={{ marginRight: 8 }} />
                  )}
                  macOS
                </Button>
                {versionInfo.darwin && (
                  <Fragment>
                    <Typography className={classes.versionInfo}>
                      v{versionInfo.darwin.version}
                    </Typography>
                    {versionInfo.darwin.checksum && (
                      <Typography className={classes.checksumText} title={versionInfo.darwin.checksum}>
                        SHA256: {versionInfo.darwin.checksum.substring(0, 16)}...
                      </Typography>
                    )}
                    <Link
                      component="button"
                      variant="body2"
                      className={classes.uninstallLink}
                      onClick={() => downloadUninstallScript('darwin')}
                    >
                      Uninstall Script
                    </Link>
                  </Fragment>
                )}
              </div>

              {/* Linux Platform */}
              <div className={classes.platformButton}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => downloadInstaller('linux')}
                  disabled={installerDownloading || checkingVersions}
                  fullWidth
                >
                  {downloadingPlatform === 'linux' ? (
                    <CircularProgress size={20} style={{ marginRight: 8 }} />
                  ) : (
                    <DownloadIcon style={{ marginRight: 8 }} />
                  )}
                  Linux
                </Button>
                {versionInfo.linux && (
                  <Fragment>
                    <Typography className={classes.versionInfo}>
                      v{versionInfo.linux.version}
                    </Typography>
                    {versionInfo.linux.checksum && (
                      <Typography className={classes.checksumText} title={versionInfo.linux.checksum}>
                        SHA256: {versionInfo.linux.checksum.substring(0, 16)}...
                      </Typography>
                    )}
                    <Link
                      component="button"
                      variant="body2"
                      className={classes.uninstallLink}
                      onClick={() => downloadUninstallScript('linux')}
                    >
                      Uninstall Script
                    </Link>
                  </Fragment>
                )}
              </div>
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
        <DialogTitle>Download Complete</DialogTitle>
        <DialogContent>
          {downloadResult && (
            <Fragment>
              <div style={{ marginTop: 16, marginBottom: 16 }}>
                <Typography variant="h6" gutterBottom>
                  Installation Instructions
                </Typography>

                <Typography variant="body2" paragraph>
                  <strong>Step 1:</strong> Transfer the installer zip file to the target device
                </Typography>

                <Typography variant="body2" paragraph>
                  <strong>Step 2:</strong> Unzip the files
                </Typography>

                <Typography variant="body2" paragraph>
                  <strong>Step 3:</strong> Run the installer
                  {downloadResult.platform === 'win32' && ' (double-click the MSI file)'}
                  {downloadResult.platform === 'darwin' && ' (double-click the PKG file)'}
                  {downloadResult.platform === 'linux' && ' (double-click the DEB file)'}
                </Typography>

                <Divider style={{ margin: '16px 0' }} />

                <Typography variant="body2" paragraph>
                  The agent will automatically connect to this Allow2Automate app and extend your reach to control that device.
                </Typography>

                <Typography variant="body2" paragraph>
                  This agent allows various plugins to monitor usage and enforce limits on those devices, so make sure you also install and configure the plugins you want to use (like allow2automate-os or allow2automate-steam, etc).
                </Typography>
              </div>
            </Fragment>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDownloadResultDialog(false)} color="primary" variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notifications */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          variant="filled"
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
