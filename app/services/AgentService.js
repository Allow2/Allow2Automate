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
      console.log(`[AgentService] ${(agentCount && agentCount.count) || 0} agents registered`);

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

        // Also cleanup expired pending tokens
        await this.cleanupExpiredTokens();
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
   * Validate a pending agent token
   * @param {string} authToken - The auth token to validate
   * @returns {object|null} The pending token record if valid, null otherwise
   */
  async validatePendingToken(authToken) {
    if (!authToken) return null;

    try {
      const pendingToken = await this.db.queryOne(
        'SELECT * FROM pending_agent_tokens WHERE auth_token = $1 AND expires_at > datetime("now")',
        [authToken]
      );

      return pendingToken;
    } catch (error) {
      console.error('[AgentService] Error validating pending token:', error);
      return null;
    }
  }

  /**
   * Delete a pending agent token
   * @param {string} tokenId - The token ID to delete
   */
  async deletePendingToken(tokenId) {
    try {
      await this.db.query('DELETE FROM pending_agent_tokens WHERE id = $1', [tokenId]);
      console.log(`[AgentService] Deleted pending token: ${tokenId}`);
    } catch (error) {
      console.error('[AgentService] Error deleting pending token:', error);
    }
  }

  /**
   * Cleanup expired pending tokens
   * Called periodically to remove stale tokens
   */
  async cleanupExpiredTokens() {
    try {
      const result = await this.db.query(
        'DELETE FROM pending_agent_tokens WHERE expires_at < datetime("now")'
      );
      if (result.rowCount > 0) {
        console.log(`[AgentService] Cleaned up ${result.rowCount} expired pending tokens`);
      }
    } catch (error) {
      console.error('[AgentService] Error cleaning up expired tokens:', error);
    }
  }

  /**
   * Register a new agent
   * @param {string} registrationCode - Optional registration code (for backward compatibility)
   * @param {object} agentInfo - Agent information (machineId, hostname, platform, version, ip)
   * @param {string} authToken - Optional auth token from installer (for pending token validation)
   */
  async registerAgent(registrationCode, agentInfo, authToken = null) {
    try {
      let childId = null;
      let pendingTokenUsed = false;

      // First, check if authToken provided and validate against pending_agent_tokens
      // This is the new flow for installers (Linux, Mac, Windows)
      if (authToken) {
        const pendingToken = await this.validatePendingToken(authToken);
        if (pendingToken) {
          childId = pendingToken.child_id;
          pendingTokenUsed = true;
          console.log(`[AgentService] Valid pending token found for registration`);
        } else {
          console.warn(`[AgentService] Invalid or expired auth token provided`);
          // Don't fail - continue with normal registration
        }
      }

      // Check if registration code provided (backward compatibility)
      if (!childId && registrationCode) {
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

        // If pending token was used and agent was re-registering, delete the pending token
        if (pendingTokenUsed && authToken) {
          const pendingToken = await this.db.queryOne(
            'SELECT id FROM pending_agent_tokens WHERE auth_token = $1',
            [authToken]
          );
          if (pendingToken) {
            await this.deletePendingToken(pendingToken.id);
          }
        }

        console.log(`[AgentService] Agent re-registered: ${agentId} (${agentInfo.hostname})`);

        return {
          agentId,
          authToken: existingAgent.auth_token,
          childId: existingAgent.child_id || childId
        };
      }

      // New agent registration
      const agentId = crypto.randomUUID();
      const newAuthToken = crypto.randomBytes(32).toString('hex');

      // Create agent record (child_id is null initially, can be set later via UI)
      await this.db.query(`
        INSERT INTO agents (id, machine_id, child_id, hostname, platform, version, auth_token, last_known_ip, last_heartbeat)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, datetime('now'))
      `, [
        agentId,
        agentInfo.machineId,
        childId,  // null unless registration code or pending token provided
        agentInfo.hostname,
        agentInfo.platform,
        agentInfo.version,
        newAuthToken,
        agentInfo.ip
      ]);

      // Delete the pending token after successful registration
      if (pendingTokenUsed && authToken) {
        const pendingToken = await this.db.queryOne(
          'SELECT id FROM pending_agent_tokens WHERE auth_token = $1',
          [authToken]
        );
        if (pendingToken) {
          await this.deletePendingToken(pendingToken.id);
        }
      }

      // Mark registration code as used (if provided)
      if (registrationCode && childId && !pendingTokenUsed) {
        await this.db.query(
          'UPDATE registration_codes SET used = 1, agent_id = $1 WHERE code = $2',
          [agentId, registrationCode]
        );
      }

      console.log(`[AgentService] Registered new agent: ${agentId} (${agentInfo.hostname})${childId ? ` with child ${childId}` : ' (no child assigned)'}`);
      this.emit('agentRegistered', { agentId, ...agentInfo, childId });

      return {
        agentId,
        authToken: newAuthToken,
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
   * Generate a Linux install script with embedded configuration
   * This creates a universal installer that auto-detects the distro
   * and downloads the correct package from GitHub releases.
   *
   * @param {object} options - Generation options
   * @param {string} options.agentId - Agent ID (generated if not provided)
   * @param {string} options.authToken - Auth token (generated if not provided)
   * @param {string} options.childId - Optional child ID to pre-assign
   * @param {string} options.version - Agent version to install (required)
   * @param {string} options.parentApiUrl - Parent app API URL (auto-detected if not provided)
   * @returns {object} { script: string, agentId: string, authToken: string }
   */
  async generateLinuxInstallScript(options = {}) {
    try {
      const {
        agentId = crypto.randomUUID(),
        authToken = crypto.randomBytes(32).toString('hex'),
        childId = null,
        version,
        parentApiUrl
      } = options;

      if (!version) {
        throw new Error('Version is required to generate install script');
      }

      // Token expires after 7 days if not used
      const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
      const expiresAtISO = expiresAt.toISOString();

      // Build the config object that will be embedded in the script
      const agentConfig = {
        agentId,
        authToken,
        childId,
        parentApiUrl: parentApiUrl || 'http://localhost:3000', // Will be replaced by actual URL
        apiPort: 8443,
        checkInterval: 30000,
        enableMDNS: true,
        autoUpdate: true,
        tokenExpiresAt: expiresAtISO  // Installer validates this before running
      };

      // The install script template
      // This is embedded here so it works without needing the template file
      const scriptTemplate = this.getLinuxInstallScriptTemplate();

      // Replace placeholders
      const script = scriptTemplate
        .replace('__AGENT_CONFIG_PLACEHOLDER__', JSON.stringify(agentConfig, null, 2))
        .replace('__VERSION_PLACEHOLDER__', version);

      console.log(`[AgentService] Generated Linux install script for agent ${agentId} (version ${version})`);

      // Store pending token - agent will only appear in list when it first connects

      // Check if token already exists (e.g., regenerating script)
      const existingToken = await this.db.queryOne(
        'SELECT * FROM pending_agent_tokens WHERE id = $1',
        [agentId]
      );

      if (existingToken) {
        // Update existing pending token
        await this.db.query(`
          UPDATE pending_agent_tokens
          SET auth_token = $1, child_id = $2, platform = $3, version = $4, parent_api_url = $5, expires_at = $6
          WHERE id = $7
        `, [authToken, childId, 'linux', version, parentApiUrl, expiresAtISO, agentId]);
        console.log(`[AgentService] Updated pending token ${agentId} for Linux install`);
      } else {
        // Create new pending token
        await this.db.query(`
          INSERT INTO pending_agent_tokens (id, auth_token, child_id, platform, version, parent_api_url, expires_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [agentId, authToken, childId, 'linux', version, parentApiUrl, expiresAtISO]);
        console.log(`[AgentService] Created pending token ${agentId} for Linux install (expires: ${expiresAtISO})`);
      }

      return {
        script,
        agentId,
        authToken,
        filename: `install-allow2automate-agent-v${version}.sh`
      };
    } catch (error) {
      console.error('[AgentService] Error generating Linux install script:', error);
      throw error;
    }
  }

  /**
   * Get the Linux install script template
   * This is the universal installer that works across all Linux distros
   */
  getLinuxInstallScriptTemplate() {
    return `#!/bin/sh
# Allow2Automate Agent Universal Installer
# Generated by Allow2Automate parent app
#
# This script will:
# 1. Detect your Linux distribution
# 2. Download the correct package (.deb or .rpm) from GitHub
# 3. Install it using your native package manager
# 4. Write the embedded configuration
# 5. Start the agent service
#
# Usage: sudo sh install-allow2automate-agent-vX.X.X.sh

set -e

#=============================================================================
# EMBEDDED CONFIGURATION (generated by Allow2Automate parent app)
#=============================================================================
AGENT_CONFIG='__AGENT_CONFIG_PLACEHOLDER__'
VERSION="__VERSION_PLACEHOLDER__"
#=============================================================================

REPO="Allow2/allow2automate-agent"
GITHUB_RELEASES="https://github.com/\${REPO}/releases/download"

# Terminal colors
if [ -t 1 ]; then
    RED='\\033[0;31m'; GREEN='\\033[0;32m'; YELLOW='\\033[1;33m'; BLUE='\\033[0;34m'; NC='\\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

log()   { printf "\${GREEN}[Allow2]\${NC} %s\\n" "$1"; }
warn()  { printf "\${YELLOW}[Allow2]\${NC} %s\\n" "$1"; }
error() { printf "\${RED}[Allow2]\${NC} ERROR: %s\\n" "$1"; exit 1; }
info()  { printf "\${BLUE}[Allow2]\${NC} %s\\n" "$1"; }

# Check root
[ "$(id -u)" -eq 0 ] || error "This script must be run as root. Please use: sudo sh $0"

# Check systemd
command -v systemctl >/dev/null 2>&1 || error "systemd is required but not found."

# Check download tool
if command -v curl >/dev/null 2>&1; then
    DOWNLOAD_CMD="curl -fsSL -o"
elif command -v wget >/dev/null 2>&1; then
    DOWNLOAD_CMD="wget -q -O"
else
    error "Neither curl nor wget found. Please install one."
fi

# Detect distro
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO="$ID"
        DISTRO_LIKE="$ID_LIKE"
    elif command -v lsb_release >/dev/null 2>&1; then
        DISTRO=$(lsb_release -si | tr '[:upper:]' '[:lower:]')
    elif [ -f /etc/debian_version ]; then
        DISTRO="debian"
    elif [ -f /etc/redhat-release ]; then
        DISTRO="rhel"
    else
        DISTRO="unknown"
    fi
    log "Detected distribution: $DISTRO"
}

# Detect package manager
detect_package_manager() {
    case "$DISTRO" in
        ubuntu|debian|linuxmint|pop|elementary|zorin|kali|raspbian)
            PKG_FORMAT="deb"; INSTALL_CMD="dpkg -i"; FIX_CMD="apt-get install -f -y" ;;
        fedora)
            PKG_FORMAT="rpm"; INSTALL_CMD="dnf install -y" ;;
        rhel|centos|rocky|almalinux|ol)
            PKG_FORMAT="rpm"
            if command -v dnf >/dev/null 2>&1; then
                INSTALL_CMD="dnf install -y"
            else
                INSTALL_CMD="yum install -y"
            fi ;;
        opensuse*|sles)
            PKG_FORMAT="rpm"; INSTALL_CMD="zypper install -y --allow-unsigned-rpm" ;;
        *)
            case "$DISTRO_LIKE" in
                *debian*|*ubuntu*) PKG_FORMAT="deb"; INSTALL_CMD="dpkg -i"; FIX_CMD="apt-get install -f -y" ;;
                *rhel*|*fedora*) PKG_FORMAT="rpm"; INSTALL_CMD="dnf install -y" ;;
                *) error "Unsupported distribution: $DISTRO" ;;
            esac ;;
    esac
    log "Package format: $PKG_FORMAT"
}

# Detect architecture
detect_arch() {
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64|amd64) DEB_ARCH="amd64"; RPM_ARCH="x86_64" ;;
        aarch64|arm64) DEB_ARCH="arm64"; RPM_ARCH="aarch64" ;;
        *) error "Unsupported architecture: $ARCH" ;;
    esac
}

# Download and install
install_package() {
    if [ "$PKG_FORMAT" = "deb" ]; then
        PKG_NAME="allow2automate-agent-linux-\${DEB_ARCH}-v\${VERSION}.deb"
    else
        PKG_NAME="allow2automate-agent-linux-\${RPM_ARCH}-v\${VERSION}.rpm"
    fi

    URL="\${GITHUB_RELEASES}/v\${VERSION}/\${PKG_NAME}"
    log "Downloading: $PKG_NAME"

    $DOWNLOAD_CMD "/tmp/\${PKG_NAME}" "$URL" || {
        # Try alternative naming
        if [ "$PKG_FORMAT" = "deb" ]; then
            ALT_NAME="allow2automate-agent_\${VERSION}_\${DEB_ARCH}.deb"
        else
            ALT_NAME="allow2automate-agent-\${VERSION}.\${RPM_ARCH}.rpm"
        fi
        warn "Trying alternative: $ALT_NAME"
        $DOWNLOAD_CMD "/tmp/\${PKG_NAME}" "\${GITHUB_RELEASES}/v\${VERSION}/\${ALT_NAME}" || error "Download failed"
    }

    log "Installing package..."
    $INSTALL_CMD "/tmp/\${PKG_NAME}" || true
    [ -n "$FIX_CMD" ] && $FIX_CMD
    rm -f "/tmp/\${PKG_NAME}"
}

# Write config
write_config() {
    CONFIG_DIR="/etc/allow2/agent"
    mkdir -p "$CONFIG_DIR"
    [ -f "\${CONFIG_DIR}/config.json" ] && cp "\${CONFIG_DIR}/config.json" "\${CONFIG_DIR}/config.json.backup"
    echo "$AGENT_CONFIG" > "\${CONFIG_DIR}/config.json"
    chmod 600 "\${CONFIG_DIR}/config.json"
    log "Configuration written to \${CONFIG_DIR}/config.json"
}

# Start service
start_service() {
    systemctl daemon-reload
    systemctl enable allow2automate-agent 2>/dev/null || true
    systemctl restart allow2automate-agent
    sleep 2
    if systemctl is-active --quiet allow2automate-agent; then
        log "Service is running"
    else
        warn "Service may not have started. Check: systemctl status allow2automate-agent"
    fi
}

# Check if installer has expired
check_expiry() {
    # Extract expiry date from config
    EXPIRY_DATE=$(echo "$AGENT_CONFIG" | grep -o '"tokenExpiresAt"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\\([^"]*\\)"$/\\1/')

    if [ -z "$EXPIRY_DATE" ]; then
        warn "No expiry date found in config, proceeding..."
        return 0
    fi

    # Convert ISO date to epoch (portable)
    if command -v date >/dev/null 2>&1; then
        # Try GNU date first
        EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null)
        if [ -z "$EXPIRY_EPOCH" ]; then
            # Try BSD date format
            EXPIRY_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%S" "$EXPIRY_DATE" +%s 2>/dev/null)
        fi

        if [ -n "$EXPIRY_EPOCH" ]; then
            CURRENT_EPOCH=$(date +%s)
            if [ "$CURRENT_EPOCH" -gt "$EXPIRY_EPOCH" ]; then
                error "This installer has EXPIRED on $(echo "$EXPIRY_DATE" | cut -d'T' -f1). Please download a new installer from Allow2Automate."
            fi
        fi
    fi

    log "Installer token is valid"
}

# Main
main() {
    log "============================================"
    log "  Allow2Automate Agent Installer v\${VERSION}"
    log "============================================"

    # Validate token hasn't expired before proceeding
    check_expiry

    detect_distro
    detect_package_manager
    detect_arch
    install_package
    write_config
    start_service

    log ""
    log "Installation complete!"
    log "Commands:"
    info "  Status:  systemctl status allow2automate-agent"
    info "  Logs:    journalctl -u allow2automate-agent -f"
    log ""
}

main "$@"
`;
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
