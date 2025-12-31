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

    // Start Express server on port 8080
    const server = expressApp.listen(8080, () => {
      console.log('[AgentIntegration] Agent API server listening on port 8080');
    });

    // Expose services globally for routes and plugins
    global.services = {
      ...global.services,
      agent: agentService,
      agentDiscovery: agentDiscovery,
      agentUpdate: agentUpdateService,
      database: database
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

  // Download installer
  ipcMain.handle('agents:download-installer', async (event, { platform, childId }) => {
    try {
      // Get Downloads folder
      const downloadsPath = electronApp.getPath('downloads');

      // Generate registration code if childId provided
      let registrationCode = null;
      if (childId) {
        registrationCode = await agentService.generateRegistrationCode(childId);
      }

      // Get server URL (use local network address)
      const os = require('os');
      const networkInterfaces = os.networkInterfaces();
      let serverUrl = 'http://localhost:8080';

      // Find first non-internal IPv4 address
      for (const interfaceName in networkInterfaces) {
        for (const iface of networkInterfaces[interfaceName]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            serverUrl = `http://${iface.address}:8080`;
            break;
          }
        }
      }

      // Try to get from cache first
      const versions = agentUpdateService.getAvailableVersions();
      let result;

      if (versions.length > 0) {
        const latestVersion = versions[0].version;
        result = await agentUpdateService.exportInstaller(
          latestVersion,
          platform,
          downloadsPath,
          serverUrl,
          registrationCode
        );
      } else {
        // Download directly from GitHub if not cached
        result = await agentUpdateService.downloadFromGitHub(
          platform,
          downloadsPath,
          serverUrl,
          registrationCode
        );
      }

      return {
        success: true,
        installerPath: result.installerPath,
        configPath: result.configPath,
        serverUrl: serverUrl,
        registrationCode: registrationCode,
        version: result.version || (versions[0] && versions[0].version)
      };
    } catch (error) {
      console.error('[IPC] Error downloading installer:', error);
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

  // Check for installer updates from GitHub
  ipcMain.handle('agents:check-updates', async (event) => {
    try {
      await agentUpdateService.checkForUpdates();
      const versions = agentUpdateService.getAvailableVersions();
      return { success: true, versions };
    } catch (error) {
      console.error('[IPC] Error checking for updates:', error);
      return { success: false, error: error.message };
    }
  });

  // Get server URL for agent configuration
  ipcMain.handle('agents:get-server-url', async (event) => {
    try {
      const os = require('os');
      const networkInterfaces = os.networkInterfaces();
      let serverUrl = 'http://localhost:8080';

      // Find first non-internal IPv4 address
      for (const interfaceName in networkInterfaces) {
        for (const iface of networkInterfaces[interfaceName]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            serverUrl = `http://${iface.address}:8080`;
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
