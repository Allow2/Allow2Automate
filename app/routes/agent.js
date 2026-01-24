import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = express.Router();

// JWT secret for agent authentication (should be from config)
const JWT_SECRET = process.env.AGENT_JWT_SECRET || 'change-me-in-production';

/**
 * Middleware to authenticate agent requests
 *
 * Supports two authentication modes:
 * 1. JWT token (for registered agents) - validates signed JWT
 * 2. Raw auth token (for first-time connection) - validates against pending_agent_tokens
 *    and auto-registers the agent, returning a JWT in X-Agent-Token header
 */
async function authenticateAgent(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  // First, try JWT verification (for registered agents)
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.agentId = decoded.agentId;
    return next();
  } catch (jwtError) {
    // JWT verification failed - this might be a raw auth token from a new agent
  }

  // JWT failed - check if this is a raw auth token from pending_agent_tokens
  const agentService = global.services && global.services.agent;
  if (!agentService) {
    return res.status(503).json({ error: 'Agent service not available' });
  }

  try {
    // Check pending_agent_tokens for this raw token
    const pendingToken = await agentService.validatePendingToken(token);

    if (!pendingToken) {
      // Also check if this is an existing agent's auth_token (direct token auth)
      const existingAgent = await agentService.db.queryOne(
        'SELECT id FROM agents WHERE auth_token = $1',
        [token]
      );

      if (existingAgent) {
        // Agent exists but using raw token - issue a JWT for future use
        const newJwt = jwt.sign(
          { agentId: existingAgent.id },
          JWT_SECRET,
          { expiresIn: '365d' }
        );
        req.agentId = existingAgent.id;
        res.setHeader('X-Agent-Token', newJwt);
        return next();
      }

      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Valid pending token found - auto-register the agent
    // Get machine info from request headers or body
    const machineId = req.headers['x-machine-id'] ||
                      (req.body && req.body.machineId) ||
                      `auto-${pendingToken.id}`;
    const hostname = req.headers['x-hostname'] ||
                     (req.body && req.body.hostname) ||
                     'unknown';
    const platform = req.headers['x-agent-platform'] || pendingToken.platform || 'unknown';
    const version = req.headers['x-agent-version'] || pendingToken.version || '1.0.0';

    const agentInfo = {
      machineId,
      hostname,
      platform,
      version,
      ip: req.ip || req.connection.remoteAddress
    };

    // Register the new agent (this will delete the pending token)
    const result = await agentService.registerAgent(null, agentInfo, token);

    // Generate JWT for this new agent
    const newJwt = jwt.sign(
      { agentId: result.agentId },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    // Set agent ID for the request and return JWT in header for agent to store
    req.agentId = result.agentId;
    res.setHeader('X-Agent-Token', newJwt);
    res.setHeader('X-Agent-Id', result.agentId);

    console.log(`[AgentAuth] Auto-registered new agent ${result.agentId} from pending token`);
    next();

  } catch (error) {
    console.error('[AgentAuth] Error during authentication:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Agent registration endpoint
 * POST /api/agent/register
 * Body: {
 *   registrationCode (optional) - Legacy registration code for backward compatibility
 *   authToken (optional) - Auth token from installer for pending token validation
 *   agentInfo: { machineId, hostname, platform, version, ip }
 * }
 *
 * Agents only appear in the parent's list when they first connect via this endpoint.
 * No pre-registration or "pending" placeholders - agents are created on first contact.
 */
router.post('/api/agent/register', async (req, res) => {
  try {
    const { registrationCode, authToken, agentInfo } = req.body;

    // agentInfo is required, registrationCode and authToken are optional
    if (!agentInfo) {
      return res.status(400).json({ error: 'Missing required field: agentInfo' });
    }

    // Validate agentInfo fields
    if (!agentInfo.machineId || !agentInfo.hostname || !agentInfo.platform) {
      return res.status(400).json({ error: 'agentInfo missing required fields (machineId, hostname, platform)' });
    }

    // Get agent service from global context
    const agentService = global.services && global.services.agent;
    if (!agentService) {
      return res.status(503).json({ error: 'Agent service not available' });
    }

    // Register agent (registrationCode and authToken are optional)
    // authToken is used to validate pending tokens from installers
    const result = await agentService.registerAgent(registrationCode || null, agentInfo, authToken || null);

    // Generate JWT token for the agent
    const token = jwt.sign(
      { agentId: result.agentId },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    // Get initial policies for the agent
    const policies = await agentService.getPolicies(result.agentId);

    res.json({
      success: true,
      agentId: result.agentId,
      token,
      childId: result.childId,
      policies
    });

  } catch (error) {
    console.error('[AgentRoutes] Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * List all agents (internal API for main application)
 * GET /api/agents
 */
router.get('/api/agents', async (req, res) => {
  try {
    const agentService = global.services && global.services.agent;
    if (!agentService) {
      return res.status(503).json({ error: 'Agent service not available' });
    }

    const agents = await agentService.listAgents();
    res.json({ success: true, agents });

  } catch (error) {
    console.error('[AgentRoutes] Error listing agents:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get policies for authenticated agent
 * GET /api/agent/policies
 */
router.get('/api/agent/policies', authenticateAgent, async (req, res) => {
  try {
    const agentService = global.services && global.services.agent;
    if (!agentService) {
      return res.status(503).json({ error: 'Agent service not available' });
    }

    const policies = await agentService.getPolicies(req.agentId);
    res.json({ success: true, policies });

  } catch (error) {
    console.error('[AgentRoutes] Error getting policies:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create new policy (internal API)
 * POST /api/agent/policies
 */
router.post('/api/agent/policies', async (req, res) => {
  try {
    const { agentId, policy } = req.body;

    if (!agentId || !policy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const agentService = global.services && global.services.agent;
    if (!agentService) {
      return res.status(503).json({ error: 'Agent service not available' });
    }

    const policyId = await agentService.createPolicy(agentId, policy);
    res.json({ success: true, policyId });

  } catch (error) {
    console.error('[AgentRoutes] Error creating policy:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update policy (internal API)
 * PATCH /api/agent/policies/:policyId
 */
router.patch('/api/agent/policies/:policyId', async (req, res) => {
  try {
    const { policyId } = req.params;
    const { agentId, updates } = req.body;

    if (!agentId || !updates) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const agentService = global.services && global.services.agent;
    if (!agentService) {
      return res.status(503).json({ error: 'Agent service not available' });
    }

    await agentService.updatePolicy(agentId, policyId, updates);
    res.json({ success: true });

  } catch (error) {
    console.error('[AgentRoutes] Error updating policy:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete policy (internal API)
 * DELETE /api/agent/policies/:policyId
 */
router.delete('/api/agent/policies/:policyId', async (req, res) => {
  try {
    const { policyId } = req.params;
    const { agentId } = req.query;

    if (!agentId) {
      return res.status(400).json({ error: 'Missing agentId' });
    }

    const agentService = global.services && global.services.agent;
    if (!agentService) {
      return res.status(503).json({ error: 'Agent service not available' });
    }

    await agentService.deletePolicy(agentId, policyId);
    res.json({ success: true });

  } catch (error) {
    console.error('[AgentRoutes] Error deleting policy:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Report violation from agent
 * POST /api/agent/violations
 */
router.post('/api/agent/violations', authenticateAgent, async (req, res) => {
  try {
    const violationData = req.body;

    const agentService = global.services && global.services.agent;
    if (!agentService) {
      return res.status(503).json({ error: 'Agent service not available' });
    }

    const violationId = await agentService.handleViolation(req.agentId, violationData);
    res.json({ success: true, violationId });

  } catch (error) {
    console.error('[AgentRoutes] Error handling violation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Agent heartbeat
 * POST /api/agent/heartbeat
 * Body: { metadata, userContext (optional) }
 *
 * Returns pending actions for the agent to execute
 */
router.post('/api/agent/heartbeat', authenticateAgent, async (req, res) => {
  try {
    const { metadata = {}, userContext } = req.body;

    const agentService = global.services && global.services.agent;
    if (!agentService) {
      return res.status(503).json({ error: 'Agent service not available' });
    }

    // Update heartbeat
    await agentService.updateHeartbeat(req.agentId, metadata);

    // Record user session if provided
    if (userContext && userContext.systemUser) {
      await agentService.recordUserSession(req.agentId, userContext.systemUser);
    }

    // Get agent info for response enrichment
    const agent = await agentService.getAgent(req.agentId);
    const defaultChild = agent && agent.default_child_id ? {
      childId: agent.default_child_id,
      name: agent.child_name || null
    } : null;

    // Get pending actions from plugin extension coordinator
    let pendingActions = [];
    const pluginCoordinator = global.services && global.services.pluginExtension;
    if (pluginCoordinator) {
      pendingActions = await pluginCoordinator.getPendingActions(req.agentId);

      // Mark actions as delivered if any
      if (pendingActions.length > 0) {
        const triggerIds = pendingActions.map(a => a.triggerId);
        await pluginCoordinator.markActionsDelivered(req.agentId, triggerIds);
      }
    }

    res.json({
      success: true,
      defaultChild,
      pendingActions
    });

  } catch (error) {
    console.error('[AgentRoutes] Error updating heartbeat:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Receive plugin data from agent
 * POST /api/agent/plugin-data
 * Body: { pluginData: { pluginId: { monitorId: [data, ...] } } }
 *
 * Agents send collected monitor data to be processed by parent-side plugins
 */
router.post('/api/agent/plugin-data', authenticateAgent, async (req, res) => {
  try {
    const { pluginData } = req.body;

    if (!pluginData || typeof pluginData !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid pluginData' });
    }

    const pluginCoordinator = global.services && global.services.pluginExtension;
    if (!pluginCoordinator) {
      return res.status(503).json({ error: 'Plugin extension coordinator not available' });
    }

    const result = await pluginCoordinator.processPluginData(req.agentId, pluginData);

    res.json({
      success: true,
      processed: result.processed,
      errors: result.errors.length > 0 ? result.errors : undefined
    });

  } catch (error) {
    console.error('[AgentRoutes] Error processing plugin data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Receive action responses from agent
 * POST /api/agent/plugin-action-responses
 * Body: { responses: [{ triggerId, status, returnCode, output, error, executedAt }, ...] }
 *
 * Agents send results of action executions back to parent
 */
router.post('/api/agent/plugin-action-responses', authenticateAgent, async (req, res) => {
  try {
    const { responses } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'Missing or invalid responses array' });
    }

    const pluginCoordinator = global.services && global.services.pluginExtension;
    if (!pluginCoordinator) {
      return res.status(503).json({ error: 'Plugin extension coordinator not available' });
    }

    const result = await pluginCoordinator.processActionResponses(req.agentId, responses);

    res.json({
      success: true,
      processed: result.processed,
      errors: result.errors.length > 0 ? result.errors : undefined
    });

  } catch (error) {
    console.error('[AgentRoutes] Error processing action responses:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Deploy monitor to agent (internal API for plugins)
 * POST /api/agent/:agentId/deploy-monitor
 * Body: { pluginId, monitorId, script, interval, platforms, metadata }
 */
router.post('/api/agent/:agentId/deploy-monitor', async (req, res) => {
  try {
    const { agentId } = req.params;
    const monitorConfig = req.body;

    const pluginCoordinator = global.services && global.services.pluginExtension;
    if (!pluginCoordinator) {
      return res.status(503).json({ error: 'Plugin extension coordinator not available' });
    }

    const result = await pluginCoordinator.deployMonitor(agentId, monitorConfig);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[AgentRoutes] Error deploying monitor:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Deploy action to agent (internal API for plugins)
 * POST /api/agent/:agentId/deploy-action
 * Body: { pluginId, actionId, script, platforms, metadata }
 */
router.post('/api/agent/:agentId/deploy-action', async (req, res) => {
  try {
    const { agentId } = req.params;
    const actionConfig = req.body;

    const pluginCoordinator = global.services && global.services.pluginExtension;
    if (!pluginCoordinator) {
      return res.status(503).json({ error: 'Plugin extension coordinator not available' });
    }

    const result = await pluginCoordinator.deployAction(agentId, actionConfig);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[AgentRoutes] Error deploying action:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Trigger action on agent (internal API for plugins)
 * POST /api/agent/:agentId/trigger-action
 * Body: { pluginId, actionId, arguments }
 */
router.post('/api/agent/:agentId/trigger-action', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { pluginId, actionId, arguments: args } = req.body;

    if (!pluginId || !actionId) {
      return res.status(400).json({ error: 'Missing pluginId or actionId' });
    }

    const pluginCoordinator = global.services && global.services.pluginExtension;
    if (!pluginCoordinator) {
      return res.status(503).json({ error: 'Plugin extension coordinator not available' });
    }

    const triggerId = await pluginCoordinator.triggerAction(agentId, pluginId, actionId, args || {});

    res.json({
      success: true,
      triggerId
    });

  } catch (error) {
    console.error('[AgentRoutes] Error triggering action:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get deployment status for an agent (internal API)
 * GET /api/agent/:agentId/deployments
 */
router.get('/api/agent/:agentId/deployments', async (req, res) => {
  try {
    const { agentId } = req.params;

    const pluginCoordinator = global.services && global.services.pluginExtension;
    if (!pluginCoordinator) {
      return res.status(503).json({ error: 'Plugin extension coordinator not available' });
    }

    const status = await pluginCoordinator.getDeploymentStatus(agentId);

    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    console.error('[AgentRoutes] Error getting deployments:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get recent plugin data for an agent (internal API)
 * GET /api/agent/:agentId/plugin-data
 * Query: pluginId (optional), limit (optional)
 */
router.get('/api/agent/:agentId/plugin-data', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { pluginId, limit } = req.query;

    const pluginCoordinator = global.services && global.services.pluginExtension;
    if (!pluginCoordinator) {
      return res.status(503).json({ error: 'Plugin extension coordinator not available' });
    }

    const data = await pluginCoordinator.getRecentPluginData(
      agentId,
      pluginId || null,
      parseInt(limit) || 100
    );

    res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('[AgentRoutes] Error getting plugin data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Serve agent installer
 * GET /api/agent/installer/:version/:platform
 */
router.get('/api/agent/installer/:version/:platform', async (req, res) => {
  try {
    const { version, platform } = req.params;

    const updateService = global.services && global.services.agentUpdate;
    if (!updateService) {
      return res.status(503).json({ error: 'Update service not available' });
    }

    await updateService.serveInstaller(null, version, platform, res);

  } catch (error) {
    console.error('[AgentRoutes] Error serving installer:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Agent handshake - verify parent authenticity
 * GET /api/agent/handshake
 *
 * Returns a cryptographic challenge signed by the parent's private key.
 * Agents verify this signature using the public key from their config
 * to ensure they're connecting to the legitimate parent application.
 */
router.get('/api/agent/handshake', async (req, res) => {
  try {
    const keypairManager = global.services && global.services.keypair;
    if (!keypairManager) {
      return res.status(503).json({ error: 'Keypair manager not available' });
    }

    // Generate challenge
    const nonce = crypto.randomBytes(32).toString('base64');
    const timestamp = Date.now();
    const challengeData = `${nonce}:${timestamp}`;

    // Sign challenge with private key
    const signature = keypairManager.signChallenge(challengeData);

    res.json({
      nonce,
      timestamp,
      signature,
      version: '1.0.0'
    });

  } catch (error) {
    console.error('[AgentRoutes] Handshake error:', error);
    res.status(500).json({ error: 'Handshake failed' });
  }
});

/**
 * Generate registration code (internal API)
 * POST /api/agent/registration-code
 */
router.post('/api/agent/registration-code', async (req, res) => {
  try {
    const { childId } = req.body;

    if (!childId) {
      return res.status(400).json({ error: 'Missing childId' });
    }

    const agentService = global.services && global.services.agent;
    if (!agentService) {
      return res.status(503).json({ error: 'Agent service not available' });
    }

    const code = await agentService.generateRegistrationCode(childId);
    res.json({ success: true, code });

  } catch (error) {
    console.error('[AgentRoutes] Error generating registration code:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current user for an agent
 * GET /api/agents/:agentId/current-user
 */
router.get('/api/agents/:agentId/current-user', async (req, res) => {
  try {
    const { agentId } = req.params;

    const agentService = global.services && global.services.agent;
    if (!agentService) {
      return res.status(503).json({ error: 'Agent service not available' });
    }

    const currentUser = await agentService.getCurrentUser(agentId);
    const lastUser = currentUser || await agentService.getLastUser(agentId);

    res.json({
      success: true,
      currentUser,
      lastUser
    });

  } catch (error) {
    console.error('[AgentRoutes] Error getting current user:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user session history for an agent
 * GET /api/agents/:agentId/user-sessions
 */
router.get('/api/agents/:agentId/user-sessions', async (req, res) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const agentService = global.services && global.services.agent;
    if (!agentService) {
      return res.status(503).json({ error: 'Agent service not available' });
    }

    const currentUser = await agentService.getCurrentUser(agentId);
    const sessionHistory = await agentService.getUserSessionHistory(agentId, limit);

    res.json({
      success: true,
      currentUser,
      sessionHistory
    });

  } catch (error) {
    console.error('[AgentRoutes] Error getting user sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
