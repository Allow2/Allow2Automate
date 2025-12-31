import EventEmitter from 'events';

/**
 * AgentDiscovery - mDNS/Bonjour service discovery for network agents
 *
 * Discovers allow2automate agents on the local network using mDNS.
 * Falls back gracefully if bonjour is not available.
 */
export default class AgentDiscovery extends EventEmitter {
  constructor() {
    super();
    this.bonjour = null;
    this.browser = null;
    this.discoveredAgents = new Map(); // agentId -> { ip, port, hostname, lastSeen }
    this.cleanupInterval = null;
    this.enabled = false;
  }

  /**
   * Start mDNS discovery
   */
  async start() {
    try {
      // Try to load bonjour-service
      const Bonjour = await this.loadBonjour();
      if (!Bonjour) {
        console.warn('[AgentDiscovery] mDNS discovery not available, using fallback mode');
        this.enabled = false;
        return;
      }

      this.bonjour = new Bonjour();
      this.enabled = true;

      // Browse for allow2 agents (matches the type in DiscoveryAdvertiser)
      this.browser = this.bonjour.find({ type: 'allow2' }, (service) => {
        this.handleServiceDiscovered(service);
      });

      // Clean up stale discoveries every 60 seconds
      this.cleanupInterval = setInterval(() => {
        this.cleanupStaleAgents();
      }, 60000);

      console.log('[AgentDiscovery] mDNS discovery started');
    } catch (error) {
      console.error('[AgentDiscovery] Failed to start mDNS:', error);
      this.enabled = false;
    }
  }

  /**
   * Try to load bonjour-service module
   */
  async loadBonjour() {
    try {
      // bonjour-service is optional - may not be installed
      const module = await import('bonjour-service');
      return module.default || module;
    } catch (error) {
      console.log('[AgentDiscovery] bonjour-service not available:', error.message);
      return null;
    }
  }

  /**
   * Handle discovered service
   */
  handleServiceDiscovered(service) {
    try {
      // Extract agent info from mDNS service
      const agentId = (service.txt && service.txt.agentId) || service.name;
      const hostname = service.host || service.hostname;
      const ip = (service.addresses && service.addresses[0]) || (service.referer && service.referer.address);
      const port = service.port || 8443;

      if (!agentId || !ip) {
        console.warn('[AgentDiscovery] Invalid service discovered:', service);
        return;
      }

      const agentInfo = {
        id: agentId,
        ip,
        port,
        hostname,
        url: `https://${ip}:${port}`,
        lastSeen: Date.now(),
        platform: service.txt && service.txt.platform,
        version: service.txt && service.txt.version
      };

      const existing = this.discoveredAgents.get(agentId);
      if (!existing) {
        console.log(`[AgentDiscovery] New agent discovered: ${agentId} at ${ip}`);
        this.emit('agentDiscovered', agentInfo);
      } else {
        // Update last seen time
        existing.lastSeen = Date.now();
        if (existing.ip !== ip) {
          console.log(`[AgentDiscovery] Agent ${agentId} IP changed: ${existing.ip} -> ${ip}`);
          existing.ip = ip;
          existing.url = `https://${ip}:${port}`;
          this.emit('agentIPChanged', agentInfo);
        }
      }

      this.discoveredAgents.set(agentId, agentInfo);
    } catch (error) {
      console.error('[AgentDiscovery] Error handling discovered service:', error);
    }
  }

  /**
   * Clean up agents that haven't been seen recently
   */
  cleanupStaleAgents() {
    const staleThreshold = Date.now() - (5 * 60 * 1000); // 5 minutes

    for (const [agentId, info] of this.discoveredAgents.entries()) {
      if (info.lastSeen < staleThreshold) {
        console.log(`[AgentDiscovery] Agent ${agentId} is stale, removing from discovery`);
        this.discoveredAgents.delete(agentId);
        this.emit('agentLost', agentId);
      }
    }
  }

  /**
   * Get connection info for an agent
   */
  getAgentConnection(agentId) {
    return this.discoveredAgents.get(agentId);
  }

  /**
   * Check if an agent is online (discovered via mDNS)
   */
  isAgentOnline(agentId) {
    return this.discoveredAgents.has(agentId);
  }

  /**
   * Get all discovered agents
   */
  getAllAgents() {
    return Array.from(this.discoveredAgents.values());
  }

  /**
   * Stop discovery
   */
  stop() {
    console.log('[AgentDiscovery] Stopping mDNS discovery');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.browser) {
      this.browser.stop();
      this.browser = null;
    }

    if (this.bonjour) {
      this.bonjour.destroy();
      this.bonjour = null;
    }

    this.discoveredAgents.clear();
    this.enabled = false;
  }

  /**
   * Check if discovery is enabled
   */
  isEnabled() {
    return this.enabled;
  }
}
