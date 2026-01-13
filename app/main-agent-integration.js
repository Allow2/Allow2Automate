/**
 * Agent Service Integration for main.js
 *
 * This file contains all the code needed to integrate the agent services
 * into the main Electron process. Import this in main.js after the app is ready.
 */

import AgentService from './services/AgentService.js';
import AgentDiscovery from './services/AgentDiscovery.js';
import AgentUpdateService from './services/AgentUpdateService.js';
import DatabaseModule from './database/DatabaseModule.js';
import agentRoutes from './routes/agent.js';
import express from 'express';
import { ipcMain, app as electronApp, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Find an available port for the server
 */
async function findAvailablePort(expressApp, startPort, maxAttempts) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt;

    try {
      const server = await new Promise((resolve, reject) => {
        const srv = expressApp.listen(port, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(srv);
          }
        });

        srv.once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`[AgentIntegration] Port ${port} in use, trying ${port + 1}...`);
            reject(err);
          } else {
            reject(err);
          }
        });
      });

      return server;
    } catch (err) {
      if (err.code !== 'EADDRINUSE' || attempt === maxAttempts - 1) {
        console.error(`[AgentIntegration] Error binding to port ${port}:`, err.message);
        if (attempt === maxAttempts - 1) {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Get the preferred network IP address for agent connections
 * Filters out link-local, loopback, and virtual interfaces
 */
function getPreferredIPAddress() {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  const candidates = [];

  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      // Skip non-IPv4 and internal addresses
      if (iface.family !== 'IPv4' || iface.internal) continue;

      // Skip link-local addresses (169.254.0.0/16)
      if (iface.address.startsWith('169.254.')) continue;

      // Skip common virtual interfaces
      if (interfaceName.startsWith('docker') ||
          interfaceName.startsWith('veth') ||
          interfaceName.startsWith('virbr') ||
          interfaceName.startsWith('br-')) continue;

      // Calculate priority based on interface name
      let priority = 0;
      if (interfaceName.startsWith('eth') ||
          interfaceName.startsWith('en')) {
        priority = 3; // Ethernet interfaces (highest priority)
      } else if (interfaceName.startsWith('wlan') ||
                 interfaceName.startsWith('wl') ||
                 interfaceName.startsWith('wi-fi')) {
        priority = 2; // WiFi interfaces
      } else {
        priority = 1; // Other interfaces
      }

      candidates.push({
        address: iface.address,
        priority,
        name: interfaceName
      });
    }
  }

  // Sort by priority (highest first)
  candidates.sort((a, b) => b.priority - a.priority);

  // Return highest priority address, or localhost as fallback
  return candidates.length > 0 ? candidates[0].address : 'localhost';
}

/**
 * Initialize agent services
 */
export async function initializeAgentServices(app, store, actions) {
  console.log('[AgentIntegration] Initializing agent services...');

  try {
    // Initialize database
    const database = new DatabaseModule();
    await database.initialize();

    // Initialize discovery service
    const agentDiscovery = new AgentDiscovery();
    await agentDiscovery.start();

    // Initialize agent service
    const agentService = new AgentService(database, agentDiscovery);
    await agentService.initialize();

    // Initialize update service
    const agentUpdateService = new AgentUpdateService(agentService, electronApp);
    await agentUpdateService.start();

    // Setup Express server for agent API
    const expressApp = express();
    expressApp.use(express.json());

    // Mount agent routes
    expressApp.use(agentRoutes);

    // Start Express server with dynamic port allocation
    const startPort = process.env.AGENT_API_PORT || 8080;
    const server = await findAvailablePort(expressApp, startPort, 100);

    if (!server) {
      throw new Error('Could not find available port for agent API server');
    }

    const actualPort = server.address().port;
    console.log(`[AgentIntegration] Agent API server listening on port ${actualPort}`);

    // Expose services globally for routes and plugins
    global.services = {
      ...global.services,
      agent: agentService,
      agentDiscovery: agentDiscovery,
      agentUpdate: agentUpdateService,
      database: database,
      serverPort: actualPort
    };

    // Setup IPC handlers
    setupIPCHandlers(agentService, agentUpdateService, actions);

    // Setup event listeners
    setupEventListeners(agentService, actions);

    console.log('[AgentIntegration] Agent services initialized successfully');

    // Cleanup on app quit
    electronApp.on('will-quit', async () => {
      console.log('[AgentIntegration] Shutting down agent services...');
      await agentService.shutdown();
      agentDiscovery.stop();
      agentUpdateService.stop();
      server.close();
    });

    return {
      agentService,
      agentDiscovery,
      agentUpdateService,
      database
    };

  } catch (error) {
    console.error('[AgentIntegration] Failed to initialize agent services:', error);
    throw error;
  }
}

/**
 * Setup IPC handlers for renderer communication
 */
function setupIPCHandlers(agentService, agentUpdateService, actions) {
  // List agents
  ipcMain.handle('agents:list', async (event) => {
    try {
      const agents = await agentService.listAgents();
      return { success: true, agents };
    } catch (error) {
      console.error('[IPC] Error listing agents:', error);
      return { success: false, error: error.message };
    }
  });

  // Get single agent
  ipcMain.handle('agents:get', async (event, { agentId }) => {
    try {
      const agent = await agentService.getAgent(agentId);
      return { success: true, agent };
    } catch (error) {
      console.error('[IPC] Error getting agent:', error);
      return { success: false, error: error.message };
    }
  });

  // Generate registration code
  ipcMain.handle('agents:generate-code', async (event, { childId }) => {
    try {
      const code = await agentService.generateRegistrationCode(childId);
      return { success: true, code };
    } catch (error) {
      console.error('[IPC] Error generating registration code:', error);
      return { success: false, error: error.message };
    }
  });

  // Delete agent
  ipcMain.handle('agents:delete', async (event, { agentId }) => {
    try {
      // Delete agent from database
      await agentService.db.query('DELETE FROM agents WHERE id = $1', [agentId]);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error deleting agent:', error);
      return { success: false, error: error.message };
    }
  });

  // Set/update agent's assigned child
  ipcMain.handle('agents:set-child', async (event, { agentId, childId }) => {
    try {
      await agentService.setAgentChild(agentId, childId, true);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error setting agent child:', error);
      return { success: false, error: error.message };
    }
  });

  // Create policy
  ipcMain.handle('agents:create-policy', async (event, { agentId, policyConfig }) => {
    try {
      const policyId = await agentService.createPolicy(agentId, policyConfig);
      return { success: true, policyId };
    } catch (error) {
      console.error('[IPC] Error creating policy:', error);
      return { success: false, error: error.message };
    }
  });

  // Update policy
  ipcMain.handle('agents:update-policy', async (event, { agentId, policyId, updates }) => {
    try {
      await agentService.updatePolicy(agentId, policyId, updates);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error updating policy:', error);
      return { success: false, error: error.message };
    }
  });

  // Delete policy
  ipcMain.handle('agents:delete-policy', async (event, { agentId, policyId }) => {
    try {
      await agentService.deletePolicy(agentId, policyId);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error deleting policy:', error);
      return { success: false, error: error.message };
    }
  });

  // Get policies for an agent
  ipcMain.handle('agents:get-policies', async (event, { agentId }) => {
    try {
      const policies = await agentService.getPolicies(agentId);
      return { success: true, policies };
    } catch (error) {
      console.error('[IPC] Error getting policies:', error);
      return { success: false, error: error.message };
    }
  });

  // Get current user for an agent
  ipcMain.handle('agents:get-current-user', async (event, { agentId }) => {
    try {
      const currentUser = await agentService.getCurrentUser(agentId);
      const lastUser = currentUser || await agentService.getLastUser(agentId);
      return { success: true, currentUser, lastUser };
    } catch (error) {
      console.error('[IPC] Error getting current user:', error);
      return { success: false, error: error.message };
    }
  });

  // Get user session history for an agent
  ipcMain.handle('agents:get-user-sessions', async (event, { agentId, limit = 50 }) => {
    try {
      const currentUser = await agentService.getCurrentUser(agentId);
      const sessionHistory = await agentService.getUserSessionHistory(agentId, limit);
      return { success: true, currentUser, sessionHistory };
    } catch (error) {
      console.error('[IPC] Error getting user sessions:', error);
      return { success: false, error: error.message };
    }
  });

  // Download installer bundle with save dialog
  ipcMain.handle('agents:download-installer', async (event, { platform, childId, advancedMode, customIp, customPort }) => {
    try {
      // Determine server URL
      let serverUrl;
      if (advancedMode && customIp && customPort) {
        // Power user mode: use custom IP/port
        serverUrl = `http://${customIp}:${customPort}`;
      } else {
        // Auto-detect mode: use preferred network interface
        const serverIp = getPreferredIPAddress();
        const serverPort = (global.services && global.services.serverPort) || 8080;
        serverUrl = `http://${serverIp}:${serverPort}`;
      }

      // Get latest version for this platform
      const latestVersions = agentUpdateService.getLatestVersions();
      const platformInfo = latestVersions[platform];

      if (!platformInfo) {
        throw new Error(`No installer available for platform: ${platform}`);
      }

      // Create installer bundle (ZIP with installer + config)
      console.log('[AgentIntegration] Creating installer bundle...');
      const bundle = await agentUpdateService.exportInstallerBundle(
        platformInfo.version,
        platform,
        serverUrl,
        childId,  // Pass childId for optional pre-assignment
        advancedMode
      );

      // Show save dialog
      const saveResult = await dialog.showSaveDialog({
        title: 'Save Agent Installer',
        defaultPath: path.join(electronApp.getPath('downloads'), bundle.zipFileName),
        filters: [
          { name: 'ZIP Archive', extensions: ['zip'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      });

      // Check if user cancelled
      if (saveResult.canceled || !saveResult.filePath) {
        console.log('[AgentIntegration] User cancelled save dialog');
        fs.unlinkSync(bundle.zipPath); // Clean up temp file
        return { success: false, cancelled: true };
      }

      // Move bundle from temp location to chosen location
      const finalPath = saveResult.filePath;
      fs.copyFileSync(bundle.zipPath, finalPath);
      fs.unlinkSync(bundle.zipPath); // Clean up temp file

      console.log(`[AgentIntegration] Installer bundle saved to: ${finalPath}`);

      // Calculate file size for display
      const stats = fs.statSync(finalPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      // Show success dialog with simplified instructions
      const messageResult = await dialog.showMessageBox({
        type: 'info',
        title: 'Agent Installer Ready',
        message: `Installer saved successfully`,
        detail:
          `✅ Saved to: ${finalPath}\n\n` +
          `📦 Contents:\n` +
          `  • Agent installer (${bundle.version})\n` +
          `  • Configuration file\n\n` +
          `📊 Size: ${fileSizeMB} MB\n` +
          `🌐 Server: ${serverUrl}\n\n` +
          `📋 Installation:\n` +
          `  1. Save installer\n` +
          `  2. Transfer to target machine\n` +
          `  3. Run installer\n\n` +
          (advancedMode ?
            `⚙️ Advanced: Fixed IP (mDNS disabled)\n` :
            `🔍 Standard: Auto-discovery via mDNS\n`) +
          `\n` +
          `The installer will automatically detect and validate\n` +
          `the configuration when you extract and run it.`,
        buttons: ['OK', 'Show in Folder', 'Copy Path'],
        defaultId: 0
      });

      // Handle button clicks
      if (messageResult.response === 1) {
        require('electron').shell.showItemInFolder(finalPath);
      } else if (messageResult.response === 2) {
        const { clipboard } = require('electron');
        clipboard.writeText(finalPath);
      }

      return {
        success: true,
        bundlePath: finalPath,
        serverUrl: serverUrl,
        version: bundle.version,
        platform: platform,
        advancedMode: advancedMode,
        childId: childId // Return for tracking
      };

    } catch (error) {
      console.error('[IPC] Error creating installer bundle:', error);

      await dialog.showMessageBox({
        type: 'error',
        title: 'Download Failed',
        message: 'Failed to create installer',
        detail: error.message,
        buttons: ['OK']
      });

      return { success: false, error: error.message };
    }
  });

  // Get available installer versions
  ipcMain.handle('agents:installer-versions', async (event) => {
    try {
      const versions = agentUpdateService.getAvailableVersions();
      return { success: true, versions };
    } catch (error) {
      console.error('[IPC] Error getting installer versions:', error);
      return { success: false, error: error.message };
    }
  });

  // Check for latest versions from GitHub
  ipcMain.handle('agents:check-latest-versions', async (event) => {
    try {
      const latestVersions = await agentUpdateService.checkLatestVersions();
      return { success: true, versions: latestVersions };
    } catch (error) {
      console.error('[IPC] Error checking for latest versions:', error);
      return { success: false, error: error.message };
    }
  });

  // Download uninstall script for a platform
  ipcMain.handle('agents:download-uninstall-script', async (event, { platform }) => {
    try {
      const downloadsPath = electronApp.getPath('downloads');
      const result = await agentUpdateService.downloadUninstallScript(platform, downloadsPath);
      return {
        success: true,
        scriptPath: result.scriptPath,
        version: result.version
      };
    } catch (error) {
      console.error('[IPC] Error downloading uninstall script:', error);
      return { success: false, error: error.message };
    }
  });

  // Get server URL for agent configuration
  ipcMain.handle('agents:get-server-url', async (event) => {
    try {
      const os = require('os');
      const networkInterfaces = os.networkInterfaces();
      const serverPort = (global.services && global.services.serverPort) || 8080;
      let serverUrl = `http://localhost:${serverPort}`;

      // Find first non-internal IPv4 address
      for (const interfaceName in networkInterfaces) {
        for (const iface of networkInterfaces[interfaceName]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            serverUrl = `http://${iface.address}:${serverPort}`;
            break;
          }
        }
      }

      return { success: true, serverUrl };
    } catch (error) {
      console.error('[IPC] Error getting server URL:', error);
      return { success: false, error: error.message };
    }
  });

  // Steam plugin integration - bridge to agent service
  // These handlers provide a direct bridge between the Steam plugin and the agent service
  // The Steam plugin expects error-first callback style: [error, result]

  // Get agents for Steam plugin
  ipcMain.handle('steam:getAgents', async (event) => {
    try {
      const agents = await agentService.listAgents();
      return [null, { success: true, agents }];
    } catch (error) {
      console.error('[IPC] Error getting agents for Steam plugin:', error);
      return [error, null];
    }
  });

  // Get violations for Steam plugin
  ipcMain.handle('steam:getViolations', async (event, { limit = 50 }) => {
    try {
      // Query violations from database
      const violations = await agentService.db.query(
        'SELECT v.*, a.hostname FROM violations v LEFT JOIN agents a ON v.agent_id = a.id ORDER BY v.timestamp DESC LIMIT $1',
        [limit]
      );
      return [null, { success: true, violations }];
    } catch (error) {
      console.error('[IPC] Error getting violations for Steam plugin:', error);
      return [error, null];
    }
  });

  // Get settings for Steam plugin (stored in app config)
  ipcMain.handle('steam:getSettings', async (event) => {
    try {
      // Settings would typically be stored in plugin configuration
      // For now, return defaults
      const settings = {
        checkInterval: 30000,
        killOnViolation: true,
        notifyParent: true
      };
      return [null, { success: true, settings }];
    } catch (error) {
      console.error('[IPC] Error getting settings for Steam plugin:', error);
      return [error, null];
    }
  });

  // Get status for Steam plugin
  ipcMain.handle('steam:getStatus', async (event) => {
    try {
      const agents = await agentService.listAgents();
      const activeAgents = agents.filter(a => a.online).length;

      // Get recent violations
      const violations = await agentService.db.query(
        'SELECT * FROM violations ORDER BY timestamp DESC LIMIT 10'
      );

      return [null, {
        success: true,
        agentCount: agents.length,
        activeAgents: activeAgents,
        monitoredChildren: 0, // Would need to query from plugin state
        recentViolations: violations,
        lastSync: Date.now()
      }];
    } catch (error) {
      console.error('[IPC] Error getting status for Steam plugin:', error);
      return [error, null];
    }
  });

  // Link agent to child for Steam plugin
  ipcMain.handle('steam:linkAgent', async (event, { agentId, childId }) => {
    try {
      // Update agent's child_id in database
      await agentService.db.query(
        'UPDATE agents SET child_id = $1 WHERE id = $2',
        [childId, agentId]
      );
      return [null, { success: true }];
    } catch (error) {
      console.error('[IPC] Error linking agent for Steam plugin:', error);
      return [error, null];
    }
  });

  // Unlink agent from child for Steam plugin
  ipcMain.handle('steam:unlinkAgent', async (event, { agentId }) => {
    try {
      // Remove agent's child_id from database
      await agentService.db.query(
        'UPDATE agents SET child_id = NULL WHERE id = $1',
        [agentId]
      );
      return [null, { success: true }];
    } catch (error) {
      console.error('[IPC] Error unlinking agent for Steam plugin:', error);
      return [error, null];
    }
  });

  // Update settings for Steam plugin
  ipcMain.handle('steam:updateSettings', async (event, { settings }) => {
    try {
      // Settings would typically be stored in plugin configuration
      // For now, just acknowledge success
      console.log('[IPC] Steam settings updated:', settings);
      return [null, { success: true }];
    } catch (error) {
      console.error('[IPC] Error updating settings for Steam plugin:', error);
      return [error, null];
    }
  });

  // Clear violations for Steam plugin
  ipcMain.handle('steam:clearViolations', async (event) => {
    try {
      // Delete all violations (or only Steam-related ones)
      await agentService.db.query('DELETE FROM violations');
      return [null, { success: true }];
    } catch (error) {
      console.error('[IPC] Error clearing violations for Steam plugin:', error);
      return [error, null];
    }
  });
}

/**
 * Setup event listeners for agent service events
 */
function setupEventListeners(agentService, actions) {
  // Agent registered
  agentService.on('agentRegistered', (agentInfo) => {
    console.log('[AgentIntegration] Agent registered:', agentInfo.agentId);
    actions.agentRegister(agentInfo);
  });

  // Agent online
  agentService.on('agentOnline', (agentInfo) => {
    console.log('[AgentIntegration] Agent online:', agentInfo.id);
    actions.agentUpdate({
      agentId: agentInfo.id,
      updates: { online: true }
    });
  });

  // Agent offline
  agentService.on('agentOffline', (agentId) => {
    console.log('[AgentIntegration] Agent offline:', agentId);
    actions.agentUpdate({
      agentId,
      updates: { online: false }
    });
  });

  // Policy created
  agentService.on('policyCreated', ({ agentId, policyId, policyConfig }) => {
    console.log('[AgentIntegration] Policy created:', policyId);
    actions.agentPolicyCreate({ agentId, policyConfig });
  });

  // Policy updated
  agentService.on('policyUpdated', ({ agentId, policyId, updates }) => {
    console.log('[AgentIntegration] Policy updated:', policyId);
    actions.agentPolicyUpdate({ policyId, updates });
  });

  // Policy deleted
  agentService.on('policyDeleted', ({ agentId, policyId }) => {
    console.log('[AgentIntegration] Policy deleted:', policyId);
    actions.agentPolicyDelete({ policyId });
  });

  // Violation detected
  agentService.on('violation', (violationData) => {
    console.log('[AgentIntegration] Violation detected:', violationData.violationId);
    actions.agentViolationReceived(violationData);

    // Show notification to parent
    // This could be enhanced with a notification system
  });
}
