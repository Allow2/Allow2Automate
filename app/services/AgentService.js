import EventEmitter from 'events';
import crypto from 'crypto';

/**
 * AgentService - Core service for managing network device monitoring agents
 *
 * Responsibilities:
 * - Agent registration and authentication
 * - Policy management (agents PULL policies via API)
 * - Violation tracking and notifications
 * - Heartbeat monitoring
 * - Child-to-agent mapping
 *
 * ARCHITECTURE NOTE (Pull-Based Communication):
 * - Agents initiate ALL communication with parent (this app)
 * - Parent does NOT push policies to agents
 * - Agents poll /api/agent/policies to get latest policies
 * - This simplifies firewall/NAT traversal and improves reliability
 */
export default class AgentService extends EventEmitter {
  constructor(database) {
    super();
    this.db = database;
    this.heartbeatInterval = null;
  }

  /**
   * Initialize the agent service
   * Starts monitoring agent heartbeats
   */
  async initialize() {
    console.log('[AgentService] Initializing...');

    try {
      // Ensure database tables exist
      await this.initializeDatabase();

      // Start heartbeat monitoring
      this.startHeartbeatMonitoring();

      // Count registered agents
      const agentCount = await this.db.queryOne('SELECT COUNT(*) as count FROM agents');
      console.log(`[AgentService] ${agentCount?.count || 0} agents registered`);

      console.log('[AgentService] Initialized successfully (pull-based mode)');
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
      return agents.map(agent => {
        const lastHeartbeat = agent.last_heartbeat ? new Date(agent.last_heartbeat).getTime() : 0;
        const ageMs = lastHeartbeat ? Date.now() - lastHeartbeat : null;
        const online = ageMs !== null && ageMs < (5 * 60 * 1000); // Online if heartbeat within 5 minutes

        return {
          ...agent,
          online,
          lastHeartbeatAge: ageMs
        };
      });
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

      const lastHeartbeat = agent.last_heartbeat ? new Date(agent.last_heartbeat).getTime() : 0;
      const ageMs = lastHeartbeat ? Date.now() - lastHeartbeat : null;
      const online = ageMs !== null && ageMs < (5 * 60 * 1000);

      return {
        ...agent,
        online
      };
    } catch (error) {
      console.error('[AgentService] Error getting agent:', error);
      return null;
    }
  }

  /**
   * Register a new agent
   * @param {string} registrationCode - Optional registration code (for backward compatibility)
   * @param {object} agentInfo - Agent information (machineId, hostname, platform, version, ip)
   */
  async registerAgent(registrationCode, agentInfo) {
    try {
      let childId = null;

      // Check if registration code provided (backward compatibility)
      if (registrationCode) {
        const codeRecord = await this.db.queryOne(
          'SELECT * FROM registration_codes WHERE code = $1 AND used = false AND expires_at > datetime("now")',
          [registrationCode]
        );

        if (codeRecord) {
          childId = codeRecord.child_id;

          // Mark registration code as used after successful registration
          // (will be done at the end)
        } else {
          console.warn(`[AgentService] Invalid or expired registration code: ${registrationCode}`);
          // Continue registration without child assignment
        }
      }

      // Check if agent already exists with this machine_id
      const existingAgent = await this.db.queryOne(
        'SELECT * FROM agents WHERE machine_id = $1',
        [agentInfo.machineId]
      );

      if (existingAgent) {
        // Agent re-registering - update existing record
        const agentId = existingAgent.id;

        await this.db.query(`
          UPDATE agents
          SET hostname = $1, platform = $2, version = $3, last_known_ip = $4, last_heartbeat = datetime('now'), updated_at = datetime('now')
          WHERE id = $5
        `, [
          agentInfo.hostname,
          agentInfo.platform,
          agentInfo.version,
          agentInfo.ip,
          agentId
        ]);

        console.log(`[AgentService] Agent re-registered: ${agentId} (${agentInfo.hostname})`);

        return {
          agentId,
          authToken: existingAgent.auth_token,
          childId: existingAgent.child_id || childId
        };
      }

      // New agent registration
      const agentId = crypto.randomUUID();
      const authToken = crypto.randomBytes(32).toString('hex');

      // Create agent record (child_id is null initially, can be set later via UI)
      await this.db.query(`
        INSERT INTO agents (id, machine_id, child_id, hostname, platform, version, auth_token, last_known_ip, last_heartbeat)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, datetime('now'))
      `, [
        agentId,
        agentInfo.machineId,
        childId,  // null unless registration code provided
        agentInfo.hostname,
        agentInfo.platform,
        agentInfo.version,
        authToken,
        agentInfo.ip
      ]);

      // Mark registration code as used (if provided)
      if (registrationCode && childId) {
        await this.db.query(
          'UPDATE registration_codes SET used = 1, agent_id = $1 WHERE code = $2',
          [agentId, registrationCode]
        );
      }

      console.log(`[AgentService] Registered new agent: ${agentId} (${agentInfo.hostname})${childId ? ` with child ${childId}` : ' (no child assigned)'}`);
      this.emit('agentRegistered', { agentId, ...agentInfo, childId });

      return {
        agentId,
        authToken,
        childId
      };
    } catch (error) {
      console.error('[AgentService] Error registering agent:', error);
      throw error;
    }
  }

  /**
   * Generate a registration code for a child (DEPRECATED - for backward compatibility only)
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
   * Assign or update child for an agent
   * @param {string} agentId - Agent ID
   * @param {string} childId - Child ID to assign (or null to unassign)
   * @param {boolean} setAsDefault - Also set as default_child_id
   */
  async setAgentChild(agentId, childId, setAsDefault = true) {
    try {
      // Update agent's child assignment
      if (setAsDefault) {
        await this.db.query(`
          UPDATE agents
          SET child_id = $1, default_child_id = $1, updated_at = datetime('now')
          WHERE id = $2
        `, [childId, agentId]);
      } else {
        await this.db.query(`
          UPDATE agents
          SET child_id = $1, updated_at = datetime('now')
          WHERE id = $2
        `, [childId, agentId]);
      }

      console.log(`[AgentService] Set child ${childId} for agent ${agentId}${setAsDefault ? ' (as default)' : ''}`);
      this.emit('agentChildAssigned', { agentId, childId });

      return true;
    } catch (error) {
      console.error('[AgentService] Error setting agent child:', error);
      throw error;
    }
  }

  /**
   * Record or update a user session
   * @param {string} agentId - Agent ID
   * @param {object} userContext - User session data from agent
   */
  async recordUserSession(agentId, userContext) {
    try {
      if (!userContext || !userContext.username) {
        return; // No user data to record
      }

      const {
        username,
        userId,
        accountName,
        isActive,
        sessionStartTime,
        lastActivityTime
      } = userContext;

      // Check if session exists for this agent+username
      const existing = await this.db.queryOne(
        'SELECT * FROM agent_user_sessions WHERE agent_id = $1 AND username = $2',
        [agentId, username]
      );

      if (existing) {
        // Update existing session
        await this.db.query(`
          UPDATE agent_user_sessions
          SET user_id = $1,
              account_name = $2,
              last_seen = $3,
              is_active = $4,
              updated_at = datetime('now')
          WHERE id = $5
        `, [
          userId,
          accountName,
          lastActivityTime || new Date().toISOString(),
          isActive ? 1 : 0,
          existing.id
        ]);
      } else {
        // Create new session
        const sessionId = crypto.randomUUID();
        await this.db.query(`
          INSERT INTO agent_user_sessions (id, agent_id, username, user_id, account_name, session_start, last_seen, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          sessionId,
          agentId,
          username,
          userId,
          accountName,
          sessionStartTime || new Date().toISOString(),
          lastActivityTime || new Date().toISOString(),
          isActive ? 1 : 0
        ]);
      }

      // Mark other sessions for this agent as inactive if current user is active
      if (isActive) {
        await this.db.query(`
          UPDATE agent_user_sessions
          SET is_active = 0, updated_at = datetime('now')
          WHERE agent_id = $1 AND username != $2
        `, [agentId, username]);
      }

      console.log(`[AgentService] Recorded user session for ${username} on agent ${agentId}`);

    } catch (error) {
      console.error('[AgentService] Error recording user session:', error);
      // Don't throw - user session tracking shouldn't break the heartbeat
    }
  }

  /**
   * Get current active user for an agent
   * @param {string} agentId - Agent ID
   * @returns {object|null} Current user info or null
   */
  async getCurrentUser(agentId) {
    try {
      const session = await this.db.queryOne(`
        SELECT * FROM agent_user_sessions
        WHERE agent_id = $1 AND is_active = 1
        ORDER BY last_seen DESC
        LIMIT 1
      `, [agentId]);

      return session;
    } catch (error) {
      console.error('[AgentService] Error getting current user:', error);
      return null;
    }
  }

  /**
   * Get last seen user for an agent (when no active user)
   * @param {string} agentId - Agent ID
   * @returns {object|null} Last user info or null
   */
  async getLastUser(agentId) {
    try {
      const session = await this.db.queryOne(`
        SELECT * FROM agent_user_sessions
        WHERE agent_id = $1
        ORDER BY last_seen DESC
        LIMIT 1
      `, [agentId]);

      return session;
    } catch (error) {
      console.error('[AgentService] Error getting last user:', error);
      return null;
    }
  }

  /**
   * Get user session history for an agent
   * @param {string} agentId - Agent ID
   * @param {number} limit - Max number of sessions to return
   * @returns {array} Array of session records
   */
  async getUserSessionHistory(agentId, limit = 50) {
    try {
      const sessions = await this.db.query(`
        SELECT * FROM agent_user_sessions
        WHERE agent_id = $1
        ORDER BY last_seen DESC
        LIMIT $2
      `, [agentId, limit]);

      return sessions;
    } catch (error) {
      console.error('[AgentService] Error getting user session history:', error);
      return [];
    }
  }

  /**
   * Create or update a policy for an agent
   * NOTE: Agent will receive this policy on next sync (pull-based model)
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

      // NOTE: Agent will receive this policy on next sync (pull-based model)
      // No push notification needed - agent polls /api/agent/policies

      console.log(`[AgentService] Created policy ${policyId} for agent ${agentId} (agent will sync on next poll)`);
      this.emit('policyCreated', { agentId, policyId, policyConfig });

      return policyId;
    } catch (error) {
      console.error('[AgentService] Error creating policy:', error);
      throw error;
    }
  }

  /**
   * Update an existing policy
   * NOTE: Agent will receive updated policy on next sync (pull-based model)
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

      // NOTE: Agent will receive updated policy on next sync (pull-based model)
      // No push notification needed - agent polls /api/agent/policies

      console.log(`[AgentService] Updated policy ${policyId} (agent will sync on next poll)`);
      this.emit('policyUpdated', { agentId, policyId, updates });
    } catch (error) {
      console.error('[AgentService] Error updating policy:', error);
      throw error;
    }
  }

  /**
   * Delete a policy
   * NOTE: Agent will stop enforcing this policy on next sync (pull-based model)
   */
  async deletePolicy(agentId, policyId) {
    try {
      await this.db.query('DELETE FROM policies WHERE id = $1 AND agent_id = $2', [policyId, agentId]);

      // NOTE: Agent will stop enforcing this policy on next sync (pull-based model)
      // No push notification needed - agent polls /api/agent/policies

      console.log(`[AgentService] Deleted policy ${policyId} (agent will sync on next poll)`);
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
   * Called when agent syncs (pull-based) to track agent online status
   */
  async updateHeartbeat(agentId, metadata = {}) {
    try {
      await this.db.query(
        'UPDATE agents SET last_heartbeat = datetime("now") WHERE id = $1',
        [agentId]
      );

      // Update last known IP if provided
      if (metadata.ip) {
        await this.db.query(
          'UPDATE agents SET last_known_ip = $1 WHERE id = $2',
          [metadata.ip, agentId]
        );
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

    this.emit('shutdown');
  }
}
