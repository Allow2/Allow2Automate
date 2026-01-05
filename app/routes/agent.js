import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// JWT secret for agent authentication (should be from config)
const JWT_SECRET = process.env.AGENT_JWT_SECRET || 'change-me-in-production';

/**
 * Middleware to authenticate agent requests
 */
function authenticateAgent(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.agentId = decoded.agentId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Agent registration endpoint
 * POST /api/agent/register
 * Body: { registrationCode (optional), agentInfo: { machineId, hostname, platform, version, ip } }
 */
router.post('/api/agent/register', async (req, res) => {
  try {
    const { registrationCode, agentInfo } = req.body;

    // agentInfo is required, registrationCode is optional
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

    // Register agent (registrationCode is optional)
    const result = await agentService.registerAgent(registrationCode || null, agentInfo);

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
 */
router.post('/api/agent/heartbeat', authenticateAgent, async (req, res) => {
  try {
    const metadata = req.body || {};

    const agentService = global.services && global.services.agent;
    if (!agentService) {
      return res.status(503).json({ error: 'Agent service not available' });
    }

    await agentService.updateHeartbeat(req.agentId, metadata);
    res.json({ success: true });

  } catch (error) {
    console.error('[AgentRoutes] Error updating heartbeat:', error);
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

export default router;
