import express from 'express';
import os from 'os';

const router = express.Router();

/**
 * Download agent configuration file
 * GET /api/agent/config/download
 *
 * Generates a config file for the agent installer with:
 * - host: Parent's IP address (from request or system default)
 * - port: Parent's API port
 * - host_uuid: Parent's unique UUID for mDNS discovery
 * - public_key: Parent's RSA public key for cryptographic verification
 * - enableMDNS: true (default)
 */
router.get('/api/agent/config/download', async (req, res) => {
  try {
    // Get parent UUID from global services
    const uuidManager = global.services && global.services.uuid;
    if (!uuidManager) {
      return res.status(503).json({ error: 'UUID service not available' });
    }

    const parentUuid = uuidManager.getUUID();

    // Get keypair manager for public key
    const keypairManager = global.services && global.services.keypair;
    if (!keypairManager) {
      return res.status(503).json({ error: 'Keypair service not available' });
    }

    const publicKey = await keypairManager.getPublicKey();

    // Determine parent's IP address
    // Priority: query param > header > system network interface
    let host = req.query.host;

    if (!host) {
      // Try to get from X-Forwarded-For or remote address
      host = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      // If localhost, try to get actual network IP
      if (host === '::1' || host === '127.0.0.1' || host === '::ffff:127.0.0.1') {
        host = getLocalNetworkIP();
      }
    }

    // Get parent's API port from environment or default
    const port = parseInt(process.env.API_PORT || req.query.port || '8080');

    // Generate agent config
    const config = {
      host,
      port,
      host_uuid: parentUuid,
      public_key: publicKey,
      enableMDNS: true,
      checkInterval: 30000,
      logLevel: 'info',
      autoUpdate: true
    };

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="allow2automate-agent-config.json"');

    res.json(config);

  } catch (error) {
    console.error('[AgentConfigRoutes] Error generating config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get local network IP address
 */
function getLocalNetworkIP() {
  const interfaces = os.networkInterfaces();

  // Try to find a non-internal IPv4 address
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and IPv6 addresses
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }

  // Fallback to localhost
  return '127.0.0.1';
}

export default router;
