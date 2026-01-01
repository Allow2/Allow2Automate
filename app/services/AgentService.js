import EventEmitter from 'events';
import AgentConnection from './AgentConnection.js';
import crypto from 'crypto';

/**
 * AgentService - Core service for managing network device monitoring agents
 *
 * Responsibilities:
 * - Agent registration and authentication
 * - Policy management and distribution
 * - Violation tracking and notifications
 * - Heartbeat monitoring
 * - Child-to-agent mapping
 */
export default class AgentService extends EventEmitter {
  constructor(database, discovery) {
    super();
    this.db = database;
    this.discovery = discovery;
    this.agents = new Map(); // agentId -> AgentConnection
    this.heartbeatInterval = null;
  }

  /**
   * Initialize the agent service
   * Loads agents from database and starts monitoring
   */
  async initialize() {
    console.log('[AgentService] Initializing...');

    try {
      // Ensure database tables exist
      await this.initializeDatabase();

      // Load existing agents from database
      await this.loadAgents();

      // Setup discovery event listeners
      this.setupDiscoveryListeners();

      // Start heartbeat monitoring
      this.startHeartbeatMonitoring();

      console.log('[AgentService] Initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('[AgentService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize database tables if they don't exist
   */
  async initializeDatabase() {
    // This would typically run migrations
    // For now, we'll assume migrations are run separately
    console.log('[AgentService] Database tables ready');
  }

  /**
   * Load agents from database
   */
  async loadAgents() {
    try {
      const agentRecords = await this.db.query('SELECT * FROM agents');

      for (const record of agentRecords) {
        const connection = new AgentConnection(record.id, this.discovery, this.db);
        connection.lastKnownIP = record.last_known_ip;
        this.agents.set(record.id, connection);
      }

      console.log(`[AgentService] Loaded ${this.agents.size} agents from database`);
    } catch (error) {
      console.error('[AgentService] Error loading agents:', error);
    }
  }

  /**
   * Setup event listeners for agent discovery
   */
  setupDiscoveryListeners() {
    if (!this.discovery) return;

    this.discovery.on('agentDiscovered', (agentInfo) => {
      console.log('[AgentService] Agent discovered via mDNS:', agentInfo.id);
      this.emit('agentOnline', agentInfo);
    });

    this.discovery.on('agentLost', (agentId) => {
      console.log('[AgentService] Agent lost connection:', agentId);
      this.emit('agentOffline', agentId);
    });
  }

  /**
   * Start monitoring agent heartbeats
   */
  startHeartbeatMonitoring() {
    // Check for stale agents every 2 minutes
    this.heartbeatInterval = setInterval(async () => {
      try {
        const staleThreshold = Date.now() - (5 * 60 * 1000); // 5 minutes
        const staleThresholdISO = new Date(staleThreshold).toISOString();
        const staleAgents = await this.db.query(
          'SELECT id FROM agents WHERE last_heartbeat < $1',
          [staleThresholdISO]
        );

        for (const agent of staleAgents) {
          this.emit('agentStale', agent.id);
        }
      } catch (error) {
        console.error('[AgentService] Error checking heartbeats:', error);
      }
    }, 2 * 60 * 1000);
  }

  /**
   * List all registered agents with online status
   */
  async listAgents() {
    try {
      const agents = await this.db.query(`
        SELECT a.*, c.name as child_name
        FROM agents a
        LEFT JOIN children c ON a.child_id = c.id
        ORDER BY a.hostname
      `);

      // Enhance with online status from discovery
      return agents.map(agent => ({
        ...agent,
        online: this.discovery ? this.discovery.isAgentOnline(agent.id) : false,
        lastHeartbeatAge: agent.last_heartbeat ?
          Date.now() - new Date(agent.last_heartbeat).getTime() : null
      }));
    } catch (error) {
      console.error('[AgentService] Error listing agents:', error);
      return [];
    }
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(agentId) {
    try {
      const agent = await this.db.queryOne(
        'SELECT * FROM agents WHERE id = $1',
        [agentId]
      );

      if (!agent) return null;

      return {
        ...agent,
        online: this.discovery ? this.discovery.isAgentOnline(agentId) : false
      };
    } catch (error) {
      console.error('[AgentService] Error getting agent:', error);
      return null;
    }
  }

  /**
   * Register a new agent
   */
  async registerAgent(registrationCode, agentInfo) {
    try {
      // Verify registration code
      const codeRecord = await this.db.queryOne(
        'SELECT * FROM registration_codes WHERE code = $1 AND used = false AND expires_at > NOW()',
        [registrationCode]
      );

      if (!codeRecord) {
        throw new Error('Invalid or expired registration code');
      }

      // Generate agent ID and auth token
      const agentId = crypto.randomUUID();
      const authToken = crypto.randomBytes(32).toString('hex');

      // Create agent record
      await this.db.query(`
        INSERT INTO agents (id, machine_id, child_id, hostname, platform, version, auth_token, last_known_ip, last_heartbeat)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        agentId,
        agentInfo.machineId,
        codeRecord.child_id,
        agentInfo.hostname,
        agentInfo.platform,
        agentInfo.version,
        authToken,
        agentInfo.ip
      ]);

      // Mark registration code as used
      await this.db.query(
        'UPDATE registration_codes SET used = true, agent_id = $1 WHERE code = $2',
        [agentId, registrationCode]
      );

      // Create agent connection
      const connection = new AgentConnection(agentId, this.discovery, this.db);
      connection.lastKnownIP = agentInfo.ip;
      this.agents.set(agentId, connection);

      console.log(`[AgentService] Registered new agent: ${agentId} (${agentInfo.hostname})`);
      this.emit('agentRegistered', { agentId, ...agentInfo });

      return {
        agentId,
        authToken,
        childId: codeRecord.child_id
      };
    } catch (error) {
      console.error('[AgentService] Error registering agent:', error);
      throw error;
    }
  }

  /**
   * Generate a registration code for a child
   */
  async generateRegistrationCode(childId, expiresInHours = 24) {
    try {
      // Generate 6-character alphanumeric code
      const code = crypto.randomBytes(3).toString('hex').toUpperCase();
      const expiresAt = new Date(Date.now() + (expiresInHours * 60 * 60 * 1000)).toISOString();

      await this.db.query(`
        INSERT INTO registration_codes (code, child_id, expires_at)
        VALUES ($1, $2, $3)
      `, [code, childId, expiresAt]);

      console.log(`[AgentService] Generated registration code: ${code} for child ${childId}`);
      return code;
    } catch (error) {
      console.error('[AgentService] Error generating registration code:', error);
      throw error;
    }
  }

  /**
   * Create or update a policy for an agent
   */
  async createPolicy(agentId, policyConfig) {
    try {
      const policyId = crypto.randomUUID();

      await this.db.query(`
        INSERT INTO policies (id, agent_id, process_name, process_alternatives, allowed, check_interval, plugin_name, category)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        policyId,
        agentId,
        policyConfig.processName,
        JSON.stringify(policyConfig.alternatives || []),
        policyConfig.allowed || false,
        policyConfig.checkInterval || 30000,
        policyConfig.pluginName || null,
        policyConfig.category || 'general'
      ]);

      // Send policy to agent
      const connection = this.agents.get(agentId);
      if (connection) {
        await connection.sendPolicy({ id: policyId, ...policyConfig });
      }

      console.log(`[AgentService] Created policy ${policyId} for agent ${agentId}`);
      this.emit('policyCreated', { agentId, policyId, policyConfig });

      return policyId;
    } catch (error) {
      console.error('[AgentService] Error creating policy:', error);
      throw error;
    }
  }

  /**
   * Update an existing policy
   */
  async updatePolicy(agentId, policyId, updates) {
    try {
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.processName !== undefined) {
        updateFields.push(`process_name = $${paramIndex++}`);
        values.push(updates.processName);
      }
      if (updates.allowed !== undefined) {
        updateFields.push(`allowed = $${paramIndex++}`);
        values.push(updates.allowed);
      }
      if (updates.checkInterval !== undefined) {
        updateFields.push(`check_interval = $${paramIndex++}`);
        values.push(updates.checkInterval);
      }

      if (updateFields.length === 0) {
        throw new Error('No update fields provided');
      }

      values.push(policyId);
      await this.db.query(
        `UPDATE policies SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );

      // Send updated policy to agent
      const connection = this.agents.get(agentId);
      if (connection) {
        await connection.updatePolicy(policyId, updates);
      }

      console.log(`[AgentService] Updated policy ${policyId}`);
      this.emit('policyUpdated', { agentId, policyId, updates });
    } catch (error) {
      console.error('[AgentService] Error updating policy:', error);
      throw error;
    }
  }

  /**
   * Delete a policy
   */
  async deletePolicy(agentId, policyId) {
    try {
      await this.db.query('DELETE FROM policies WHERE id = $1 AND agent_id = $2', [policyId, agentId]);

      // Notify agent to remove policy
      const connection = this.agents.get(agentId);
      if (connection) {
        await connection.deletePolicy(policyId);
      }

      console.log(`[AgentService] Deleted policy ${policyId}`);
      this.emit('policyDeleted', { agentId, policyId });
    } catch (error) {
      console.error('[AgentService] Error deleting policy:', error);
      throw error;
    }
  }

  /**
   * Handle a violation reported by an agent
   */
  async handleViolation(agentId, violationData) {
    try {
      const violationId = crypto.randomUUID();

      await this.db.query(`
        INSERT INTO violations (id, agent_id, policy_id, child_id, process_name)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        violationId,
        agentId,
        violationData.policyId,
        violationData.childId,
        violationData.processName
      ]);

      console.log(`[AgentService] Violation recorded: ${violationId}`);
      this.emit('violation', {
        violationId,
        agentId,
        ...violationData
      });

      return violationId;
    } catch (error) {
      console.error('[AgentService] Error handling violation:', error);
      throw error;
    }
  }

  /**
   * Update agent heartbeat
   */
  async updateHeartbeat(agentId, metadata = {}) {
    try {
      await this.db.query(
        'UPDATE agents SET last_heartbeat = NOW() WHERE id = $1',
        [agentId]
      );

      // Update last known IP if provided
      if (metadata.ip) {
        await this.db.query(
          'UPDATE agents SET last_known_ip = $1 WHERE id = $2',
          [metadata.ip, agentId]
        );

        const connection = this.agents.get(agentId);
        if (connection) {
          connection.lastKnownIP = metadata.ip;
        }
      }
    } catch (error) {
      console.error('[AgentService] Error updating heartbeat:', error);
    }
  }

  /**
   * Get policies for an agent
   */
  async getPolicies(agentId) {
    try {
      const policies = await this.db.query(
        'SELECT * FROM policies WHERE agent_id = $1',
        [agentId]
      );

      return policies.map(p => ({
        ...p,
        processAlternatives: JSON.parse(p.process_alternatives || '[]')
      }));
    } catch (error) {
      console.error('[AgentService] Error getting policies:', error);
      return [];
    }
  }

  /**
   * Shutdown the agent service
   */
  async shutdown() {
    console.log('[AgentService] Shutting down...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all agent connections
    for (const connection of this.agents.values()) {
      await connection.close();
    }

    this.agents.clear();
    this.emit('shutdown');
  }
}
