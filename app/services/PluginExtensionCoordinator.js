import EventEmitter from 'events';
import crypto from 'crypto';

/**
 * PluginExtensionCoordinator - Coordinates plugin extensions with remote agents
 *
 * Responsibilities:
 * - Deploy monitor/action scripts to agents
 * - Queue and deliver pending actions to agents via heartbeat
 * - Receive and route plugin data from agents to appropriate plugins
 * - Track action execution responses
 * - Manage plugin deployment state per agent
 */
export default class PluginExtensionCoordinator extends EventEmitter {
  constructor(database, agentService, pluginManager) {
    super();
    this.db = database;
    this.agentService = agentService;
    this.pluginManager = pluginManager;
    this.deployedExtensions = new Map(); // agentId -> { monitors: Map, actions: Map }
  }

  /**
   * Initialize the coordinator
   */
  async initialize() {
    console.log('[PluginExtensionCoordinator] Initializing...');

    try {
      // Ensure database tables exist
      await this.initializeDatabase();

      // Load deployment state from database
      await this.loadDeploymentState();

      console.log('[PluginExtensionCoordinator] Initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('[PluginExtensionCoordinator] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize database tables for plugin extensions
   */
  async initializeDatabase() {
    // Plugin deployments tracking
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS plugin_deployments (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        plugin_id TEXT NOT NULL,
        extension_type TEXT NOT NULL,
        extension_id TEXT NOT NULL,
        script_checksum TEXT NOT NULL,
        deployed_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        UNIQUE(agent_id, plugin_id, extension_type, extension_id)
      )
    `);

    // Action queue for pending actions
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS plugin_action_queue (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        plugin_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        arguments TEXT,
        triggered_at TEXT DEFAULT (datetime('now')),
        delivered_at TEXT,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    // Action responses from agents
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS plugin_action_responses (
        id TEXT PRIMARY KEY,
        trigger_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        plugin_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        status TEXT NOT NULL,
        return_code INTEGER,
        output TEXT,
        error TEXT,
        executed_at TEXT,
        received_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (trigger_id) REFERENCES plugin_action_queue(id) ON DELETE CASCADE
      )
    `);

    // Plugin data received from agents
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS plugin_data_log (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        plugin_id TEXT NOT NULL,
        monitor_id TEXT NOT NULL,
        data TEXT NOT NULL,
        collected_at TEXT NOT NULL,
        received_at TEXT DEFAULT (datetime('now')),
        processed INTEGER DEFAULT 0,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    console.log('[PluginExtensionCoordinator] Database tables ready');
  }

  /**
   * Load deployment state from database
   */
  async loadDeploymentState() {
    try {
      const deployments = await this.db.query('SELECT * FROM plugin_deployments');

      for (const deployment of deployments) {
        if (!this.deployedExtensions.has(deployment.agent_id)) {
          this.deployedExtensions.set(deployment.agent_id, {
            monitors: new Map(),
            actions: new Map()
          });
        }

        const agentExtensions = this.deployedExtensions.get(deployment.agent_id);
        const key = `${deployment.plugin_id}:${deployment.extension_id}`;

        if (deployment.extension_type === 'monitor') {
          agentExtensions.monitors.set(key, deployment);
        } else if (deployment.extension_type === 'action') {
          agentExtensions.actions.set(key, deployment);
        }
      }

      console.log(`[PluginExtensionCoordinator] Loaded deployment state for ${this.deployedExtensions.size} agents`);
    } catch (error) {
      console.error('[PluginExtensionCoordinator] Error loading deployment state:', error);
    }
  }

  /**
   * Deploy a monitor script to an agent
   * @param {string} agentId - Target agent ID
   * @param {object} monitorConfig - Monitor configuration
   * @returns {object} Deployment result
   */
  async deployMonitor(agentId, monitorConfig) {
    const { pluginId, monitorId, script, interval, platforms, metadata = {} } = monitorConfig;

    // Validate agent exists
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Check platform compatibility
    if (platforms && !platforms.includes(agent.platform)) {
      throw new Error(`Monitor not compatible with agent platform: ${agent.platform}`);
    }

    // Calculate script checksum
    const scriptContent = typeof script === 'function' ? script.toString() : script;
    const checksum = crypto.createHash('sha256').update(scriptContent).digest('hex');

    // Check if already deployed with same checksum
    const existingKey = `${pluginId}:${monitorId}`;
    const agentExtensions = this.deployedExtensions.get(agentId);
    const existing = agentExtensions && agentExtensions.monitors ? agentExtensions.monitors.get(existingKey) : null;

    if (existing && existing.script_checksum === checksum) {
      console.log(`[PluginExtensionCoordinator] Monitor ${monitorId} already deployed to agent ${agentId}`);
      return { status: 'already_deployed', deploymentId: existing.id };
    }

    // Create deployment record
    const deploymentId = crypto.randomUUID();
    const scriptBase64 = Buffer.from(scriptContent).toString('base64');

    // Store in database
    if (existing) {
      // Update existing deployment
      await this.db.query(`
        UPDATE plugin_deployments
        SET script_checksum = $1, updated_at = datetime('now')
        WHERE id = $2
      `, [checksum, existing.id]);
    } else {
      // Insert new deployment
      await this.db.query(`
        INSERT INTO plugin_deployments (id, agent_id, plugin_id, extension_type, extension_id, script_checksum)
        VALUES ($1, $2, $3, 'monitor', $4, $5)
      `, [deploymentId, agentId, pluginId, monitorId, checksum]);
    }

    // Update in-memory state
    if (!this.deployedExtensions.has(agentId)) {
      this.deployedExtensions.set(agentId, { monitors: new Map(), actions: new Map() });
    }
    this.deployedExtensions.get(agentId).monitors.set(existingKey, {
      id: (existing && existing.id) || deploymentId,
      agent_id: agentId,
      plugin_id: pluginId,
      extension_id: monitorId,
      script_checksum: checksum
    });

    // Create deployment payload for agent
    const deploymentPayload = {
      type: 'deploy_monitor',
      pluginId,
      monitorId,
      script: scriptBase64,
      interval: interval || 30000,
      platforms: platforms || ['win32', 'darwin', 'linux'],
      checksum,
      metadata
    };

    console.log(`[PluginExtensionCoordinator] Deployed monitor ${monitorId} to agent ${agentId}`);
    this.emit('monitorDeployed', { agentId, pluginId, monitorId, deploymentId: (existing && existing.id) || deploymentId });

    return {
      status: existing ? 'updated' : 'deployed',
      deploymentId: (existing && existing.id) || deploymentId,
      payload: deploymentPayload
    };
  }

  /**
   * Deploy an action script to an agent
   * @param {string} agentId - Target agent ID
   * @param {object} actionConfig - Action configuration
   * @returns {object} Deployment result
   */
  async deployAction(agentId, actionConfig) {
    const { pluginId, actionId, script, platforms, metadata = {} } = actionConfig;

    // Validate agent exists
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Check platform compatibility
    if (platforms && !platforms.includes(agent.platform)) {
      throw new Error(`Action not compatible with agent platform: ${agent.platform}`);
    }

    // Calculate script checksum
    const scriptContent = typeof script === 'function' ? script.toString() : script;
    const checksum = crypto.createHash('sha256').update(scriptContent).digest('hex');

    // Check if already deployed with same checksum
    const existingKey = `${pluginId}:${actionId}`;
    const agentExtensions = this.deployedExtensions.get(agentId);
    const existing = agentExtensions && agentExtensions.actions ? agentExtensions.actions.get(existingKey) : null;

    if (existing && existing.script_checksum === checksum) {
      console.log(`[PluginExtensionCoordinator] Action ${actionId} already deployed to agent ${agentId}`);
      return { status: 'already_deployed', deploymentId: existing.id };
    }

    // Create deployment record
    const deploymentId = crypto.randomUUID();
    const scriptBase64 = Buffer.from(scriptContent).toString('base64');

    // Store in database
    if (existing) {
      await this.db.query(`
        UPDATE plugin_deployments
        SET script_checksum = $1, updated_at = datetime('now')
        WHERE id = $2
      `, [checksum, existing.id]);
    } else {
      await this.db.query(`
        INSERT INTO plugin_deployments (id, agent_id, plugin_id, extension_type, extension_id, script_checksum)
        VALUES ($1, $2, $3, 'action', $4, $5)
      `, [deploymentId, agentId, pluginId, actionId, checksum]);
    }

    // Update in-memory state
    if (!this.deployedExtensions.has(agentId)) {
      this.deployedExtensions.set(agentId, { monitors: new Map(), actions: new Map() });
    }
    this.deployedExtensions.get(agentId).actions.set(existingKey, {
      id: (existing && existing.id) || deploymentId,
      agent_id: agentId,
      plugin_id: pluginId,
      extension_id: actionId,
      script_checksum: checksum
    });

    // Create deployment payload for agent
    const deploymentPayload = {
      type: 'deploy_action',
      pluginId,
      actionId,
      script: scriptBase64,
      platforms: platforms || ['win32', 'darwin', 'linux'],
      checksum,
      metadata
    };

    console.log(`[PluginExtensionCoordinator] Deployed action ${actionId} to agent ${agentId}`);
    this.emit('actionDeployed', { agentId, pluginId, actionId, deploymentId: (existing && existing.id) || deploymentId });

    return {
      status: existing ? 'updated' : 'deployed',
      deploymentId: (existing && existing.id) || deploymentId,
      payload: deploymentPayload
    };
  }

  /**
   * Update a deployed monitor's configuration (e.g., interval)
   * @param {string} agentId - Target agent ID
   * @param {object} updateConfig - Update configuration
   * @returns {object} Update result with payload for agent
   */
  async updateMonitor(agentId, updateConfig) {
    const { pluginId, monitorId, interval, metadata = {} } = updateConfig;

    // Validate agent exists
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Check if monitor is deployed
    const monitorKey = `${pluginId}:${monitorId}`;
    const agentExtensions = this.deployedExtensions.get(agentId);
    const existing = agentExtensions && agentExtensions.monitors ? agentExtensions.monitors.get(monitorKey) : null;

    if (!existing) {
      console.log(`[PluginExtensionCoordinator] Monitor ${monitorId} not deployed to agent ${agentId}, skipping update`);
      return { status: 'not_deployed' };
    }

    // Create update payload for agent
    const updatePayload = {
      type: 'update_monitor',
      pluginId,
      monitorId,
      interval: interval || 30000,
      metadata
    };

    console.log(`[PluginExtensionCoordinator] Updated monitor ${monitorId} on agent ${agentId} (interval: ${interval}ms)`);
    this.emit('monitorUpdated', { agentId, pluginId, monitorId, interval });

    return {
      status: 'updated',
      deploymentId: existing.id,
      payload: updatePayload
    };
  }

  /**
   * Remove a deployed monitor from an agent
   * @param {string} agentId - Target agent ID
   * @param {object} removeConfig - Remove configuration
   * @returns {object} Removal result
   */
  async removeMonitor(agentId, removeConfig) {
    const { pluginId, monitorId } = removeConfig;

    // Validate agent exists (but don't fail if not - agent may have been removed)
    const agent = await this.agentService.getAgent(agentId);

    // Check if monitor is deployed
    const monitorKey = `${pluginId}:${monitorId}`;
    const agentExtensions = this.deployedExtensions.get(agentId);
    const existing = agentExtensions && agentExtensions.monitors ? agentExtensions.monitors.get(monitorKey) : null;

    if (!existing) {
      console.log(`[PluginExtensionCoordinator] Monitor ${monitorId} not deployed to agent ${agentId}, nothing to remove`);
      return { status: 'not_deployed' };
    }

    // Remove from database
    await this.db.query(`
      DELETE FROM plugin_deployments
      WHERE agent_id = $1 AND plugin_id = $2 AND extension_type = 'monitor' AND extension_id = $3
    `, [agentId, pluginId, monitorId]);

    // Remove from in-memory state
    if (agentExtensions && agentExtensions.monitors) {
      agentExtensions.monitors.delete(monitorKey);
    }

    // Create removal payload for agent
    const removalPayload = {
      type: 'remove_monitor',
      pluginId,
      monitorId
    };

    console.log(`[PluginExtensionCoordinator] Removed monitor ${monitorId} from agent ${agentId}`);
    this.emit('monitorRemoved', { agentId, pluginId, monitorId });

    return {
      status: 'removed',
      deploymentId: existing.id,
      payload: removalPayload
    };
  }

  /**
   * Queue an action trigger for an agent
   * @param {string} agentId - Target agent ID
   * @param {string} pluginId - Plugin ID
   * @param {string} actionId - Action ID
   * @param {object} args - Action arguments
   * @returns {string} Trigger ID
   */
  async triggerAction(agentId, pluginId, actionId, args = {}) {
    const triggerId = crypto.randomUUID();

    // Validate action is deployed
    const agentExtensions = this.deployedExtensions.get(agentId);
    const actionKey = `${pluginId}:${actionId}`;

    if (!agentExtensions || !agentExtensions.actions || !agentExtensions.actions.has(actionKey)) {
      throw new Error(`Action ${actionId} not deployed to agent ${agentId}`);
    }

    // Queue the action
    await this.db.query(`
      INSERT INTO plugin_action_queue (id, agent_id, plugin_id, action_id, arguments, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
    `, [triggerId, agentId, pluginId, actionId, JSON.stringify(args)]);

    console.log(`[PluginExtensionCoordinator] Queued action ${actionId} for agent ${agentId} (trigger: ${triggerId})`);
    this.emit('actionQueued', { triggerId, agentId, pluginId, actionId, args });

    return triggerId;
  }

  /**
   * Get pending actions for an agent (called during heartbeat)
   * @param {string} agentId - Agent ID
   * @returns {array} Pending action triggers
   */
  async getPendingActions(agentId) {
    try {
      const pending = await this.db.query(`
        SELECT id, plugin_id, action_id, arguments, triggered_at
        FROM plugin_action_queue
        WHERE agent_id = $1 AND status = 'pending'
        ORDER BY triggered_at ASC
      `, [agentId]);

      return pending.map(action => ({
        triggerId: action.id,
        pluginId: action.plugin_id,
        actionId: action.action_id,
        arguments: JSON.parse(action.arguments || '{}'),
        triggeredAt: action.triggered_at
      }));
    } catch (error) {
      console.error('[PluginExtensionCoordinator] Error getting pending actions:', error);
      return [];
    }
  }

  /**
   * Mark actions as delivered to agent
   * @param {string} agentId - Agent ID
   * @param {array} triggerIds - Trigger IDs that were delivered
   */
  async markActionsDelivered(agentId, triggerIds) {
    if (!triggerIds || triggerIds.length === 0) return;

    try {
      const placeholders = triggerIds.map((_, i) => `$${i + 2}`).join(', ');
      await this.db.query(`
        UPDATE plugin_action_queue
        SET status = 'delivered', delivered_at = datetime('now')
        WHERE agent_id = $1 AND id IN (${placeholders})
      `, [agentId, ...triggerIds]);

      console.log(`[PluginExtensionCoordinator] Marked ${triggerIds.length} actions as delivered to agent ${agentId}`);
    } catch (error) {
      console.error('[PluginExtensionCoordinator] Error marking actions delivered:', error);
    }
  }

  /**
   * Process plugin data received from an agent
   * @param {string} agentId - Agent ID
   * @param {object} pluginData - Plugin data keyed by pluginId -> monitorId -> data[]
   */
  async processPluginData(agentId, pluginData) {
    const results = { processed: 0, errors: [] };

    for (const [pluginId, monitors] of Object.entries(pluginData)) {
      for (const [monitorId, dataEntries] of Object.entries(monitors)) {
        for (const data of dataEntries) {
          try {
            // Log the data
            const logId = crypto.randomUUID();
            await this.db.query(`
              INSERT INTO plugin_data_log (id, agent_id, plugin_id, monitor_id, data, collected_at)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [
              logId,
              agentId,
              pluginId,
              monitorId,
              JSON.stringify(data),
              data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString()
            ]);

            // Route data to the appropriate plugin
            await this.routeDataToPlugin(agentId, pluginId, monitorId, data);

            results.processed++;
          } catch (error) {
            console.error(`[PluginExtensionCoordinator] Error processing data for ${pluginId}:${monitorId}:`, error);
            results.errors.push({ pluginId, monitorId, error: error.message });
          }
        }
      }
    }

    console.log(`[PluginExtensionCoordinator] Processed ${results.processed} data entries from agent ${agentId}`);
    this.emit('pluginDataProcessed', { agentId, processed: results.processed, errors: results.errors });

    return results;
  }

  /**
   * Route plugin data to the appropriate plugin handler
   * @param {string} agentId - Agent ID
   * @param {string} pluginId - Plugin ID
   * @param {string} monitorId - Monitor ID
   * @param {object} data - Monitor data
   */
  async routeDataToPlugin(agentId, pluginId, monitorId, data) {
    // Get the plugin from plugin manager
    const plugin = this.pluginManager && typeof this.pluginManager.getPlugin === 'function'
      ? this.pluginManager.getPlugin(pluginId)
      : null;

    if (!plugin) {
      console.warn(`[PluginExtensionCoordinator] Plugin not found: ${pluginId}`);
      return;
    }

    // Check if plugin has a data handler
    if (typeof plugin.handleAgentData === 'function') {
      try {
        await plugin.handleAgentData(agentId, monitorId, data);
      } catch (error) {
        console.error(`[PluginExtensionCoordinator] Plugin ${pluginId} data handler error:`, error);
        throw error;
      }
    }

    // Emit event for any listeners
    this.emit('pluginData', { agentId, pluginId, monitorId, data });
  }

  /**
   * Process action responses from an agent
   * @param {string} agentId - Agent ID
   * @param {array} responses - Action execution responses
   */
  async processActionResponses(agentId, responses) {
    const results = { processed: 0, errors: [] };

    for (const response of responses) {
      try {
        const { triggerId, status, returnCode, output, error, executedAt } = response;

        // Store the response
        const responseId = crypto.randomUUID();
        await this.db.query(`
          INSERT INTO plugin_action_responses (id, trigger_id, agent_id, plugin_id, action_id, status, return_code, output, error, executed_at)
          SELECT $1, $2, agent_id, plugin_id, action_id, $3, $4, $5, $6, $7
          FROM plugin_action_queue WHERE id = $2
        `, [responseId, triggerId, status, returnCode, output, error, executedAt]);

        // Update queue status
        await this.db.query(`
          UPDATE plugin_action_queue
          SET status = $1
          WHERE id = $2
        `, [status === 'success' ? 'completed' : 'failed', triggerId]);

        // Get action details for routing
        const actionDetails = await this.db.queryOne(
          'SELECT plugin_id, action_id FROM plugin_action_queue WHERE id = $1',
          [triggerId]
        );

        if (actionDetails) {
          // Route response to plugin
          await this.routeActionResponseToPlugin(agentId, actionDetails.plugin_id, actionDetails.action_id, response);
        }

        results.processed++;
      } catch (error) {
        console.error('[PluginExtensionCoordinator] Error processing action response:', error);
        results.errors.push({ triggerId: response.triggerId, error: error.message });
      }
    }

    console.log(`[PluginExtensionCoordinator] Processed ${results.processed} action responses from agent ${agentId}`);
    this.emit('actionResponsesProcessed', { agentId, processed: results.processed, errors: results.errors });

    return results;
  }

  /**
   * Route action response to the appropriate plugin handler
   * @param {string} agentId - Agent ID
   * @param {string} pluginId - Plugin ID
   * @param {string} actionId - Action ID
   * @param {object} response - Action response
   */
  async routeActionResponseToPlugin(agentId, pluginId, actionId, response) {
    const plugin = this.pluginManager && typeof this.pluginManager.getPlugin === 'function'
      ? this.pluginManager.getPlugin(pluginId)
      : null;

    if (!plugin) {
      console.warn(`[PluginExtensionCoordinator] Plugin not found for response routing: ${pluginId}`);
      return;
    }

    if (typeof plugin.handleActionResponse === 'function') {
      try {
        await plugin.handleActionResponse(agentId, actionId, response);
      } catch (error) {
        console.error(`[PluginExtensionCoordinator] Plugin ${pluginId} action response handler error:`, error);
        throw error;
      }
    }

    this.emit('actionResponse', { agentId, pluginId, actionId, response });
  }

  /**
   * Get pending deployments for an agent (monitors + actions that need to be sent)
   * @param {string} agentId - Agent ID
   * @returns {object} Pending deployments
   */
  async getPendingDeployments(agentId) {
    // This would be used when an agent comes online to sync deployments
    // For now, return empty - plugins will trigger deployments as needed
    return { monitors: [], actions: [] };
  }

  /**
   * Get deployment status for an agent
   * @param {string} agentId - Agent ID
   * @returns {object} Deployment status
   */
  async getDeploymentStatus(agentId) {
    const agentExtensions = this.deployedExtensions.get(agentId);

    if (!agentExtensions) {
      return { monitors: [], actions: [] };
    }

    return {
      monitors: Array.from(agentExtensions.monitors.values()),
      actions: Array.from(agentExtensions.actions.values())
    };
  }

  /**
   * Remove all deployments for an agent
   * @param {string} agentId - Agent ID
   */
  async removeAgentDeployments(agentId) {
    await this.db.query('DELETE FROM plugin_deployments WHERE agent_id = $1', [agentId]);
    await this.db.query('DELETE FROM plugin_action_queue WHERE agent_id = $1', [agentId]);
    await this.db.query('DELETE FROM plugin_action_responses WHERE agent_id = $1', [agentId]);
    await this.db.query('DELETE FROM plugin_data_log WHERE agent_id = $1', [agentId]);

    this.deployedExtensions.delete(agentId);

    console.log(`[PluginExtensionCoordinator] Removed all deployments for agent ${agentId}`);
    this.emit('agentDeploymentsRemoved', { agentId });
  }

  /**
   * Get recent plugin data for an agent
   * @param {string} agentId - Agent ID
   * @param {string} pluginId - Optional plugin filter
   * @param {number} limit - Max entries to return
   */
  async getRecentPluginData(agentId, pluginId = null, limit = 100) {
    let query = `
      SELECT * FROM plugin_data_log
      WHERE agent_id = $1
    `;
    const params = [agentId];

    if (pluginId) {
      query += ' AND plugin_id = $2';
      params.push(pluginId);
    }

    query += ` ORDER BY received_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const entries = await this.db.query(query, params);
    return entries.map(e => ({
      ...e,
      data: JSON.parse(e.data || '{}')
    }));
  }

  /**
   * Shutdown the coordinator
   */
  async shutdown() {
    console.log('[PluginExtensionCoordinator] Shutting down...');
    this.emit('shutdown');
  }
}
