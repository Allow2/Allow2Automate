import https from 'https';

/**
 * AgentConnection - Manages connection to a specific agent with fallback strategies
 *
 * Connection strategies (in order):
 * 1. Last known IP from database
 * 2. mDNS discovery
 * 3. User-configured static IP
 */
export default class AgentConnection {
  constructor(agentId, discovery, database) {
    this.agentId = agentId;
    this.discovery = discovery;
    this.db = database;
    this.lastKnownIP = null;
    this.currentConnection = null;
    this.connectionTimeout = 5000; // 5 seconds
  }

  /**
   * Connect to the agent using fallback strategies
   */
  async connect() {
    console.log(`[AgentConnection] Connecting to agent ${this.agentId}`);

    // Strategy 1: Try last known IP from database
    if (this.lastKnownIP) {
      const url = `https://${this.lastKnownIP}:8443`;
      if (await this.tryConnect(url)) {
        console.log(`[AgentConnection] Connected via last known IP: ${this.lastKnownIP}`);
        return this.currentConnection;
      }
    }

    // Strategy 2: Try mDNS discovery
    if (this.discovery && this.discovery.isEnabled()) {
      const discovered = this.discovery.getAgentConnection(this.agentId);
      if (discovered && await this.tryConnect(discovered.url)) {
        console.log(`[AgentConnection] Connected via mDNS: ${discovered.url}`);
        await this.updateLastKnownIP(discovered.ip);
        return this.currentConnection;
      }
    }

    // Strategy 3: Try user-configured static IP
    const staticIP = await this.getStaticIPFromSettings();
    if (staticIP) {
      const url = `https://${staticIP}:8443`;
      if (await this.tryConnect(url)) {
        console.log(`[AgentConnection] Connected via static IP: ${staticIP}`);
        await this.updateLastKnownIP(staticIP);
        return this.currentConnection;
      }
    }

    throw new Error(`Unable to connect to agent ${this.agentId}`);
  }

  /**
   * Attempt to connect to a specific URL
   */
  async tryConnect(url, timeout = null) {
    return new Promise((resolve) => {
      const timeoutMs = timeout || this.connectionTimeout;
      let timeoutHandle;

      try {
        const req = https.get(
          `${url}/api/health`,
          {
            rejectUnauthorized: false, // Accept self-signed certs
            timeout: timeoutMs
          },
          (res) => {
            clearTimeout(timeoutHandle);

            if (res.statusCode === 200) {
              this.currentConnection = { url, lastConnected: Date.now() };
              resolve(true);
            } else {
              resolve(false);
            }
          }
        );

        req.on('error', () => {
          clearTimeout(timeoutHandle);
          resolve(false);
        });

        timeoutHandle = setTimeout(() => {
          req.destroy();
          resolve(false);
        }, timeoutMs);

      } catch (error) {
        resolve(false);
      }
    });
  }

  /**
   * Send a policy to the agent
   */
  async sendPolicy(policy) {
    await this.ensureConnected();
    return this.makeRequest('POST', '/api/policies', policy);
  }

  /**
   * Update a policy on the agent
   */
  async updatePolicy(policyId, updates) {
    await this.ensureConnected();
    return this.makeRequest('PATCH', `/api/policies/${policyId}`, updates);
  }

  /**
   * Delete a policy from the agent
   */
  async deletePolicy(policyId) {
    await this.ensureConnected();
    return this.makeRequest('DELETE', `/api/policies/${policyId}`);
  }

  /**
   * Make an HTTPS request to the agent
   */
  async makeRequest(method, path, body = null) {
    if (!this.currentConnection) {
      throw new Error('Not connected to agent');
    }

    return new Promise((resolve, reject) => {
      const url = new URL(path, this.currentConnection.url);
      const options = {
        method,
        rejectUnauthorized: false,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.connectionTimeout
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (error) {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Ensure we have an active connection
   */
  async ensureConnected() {
    if (!this.currentConnection) {
      await this.connect();
    }

    // Check if connection is stale (older than 5 minutes)
    const staleThreshold = 5 * 60 * 1000;
    if (Date.now() - this.currentConnection.lastConnected > staleThreshold) {
      await this.connect();
    }
  }

  /**
   * Update last known IP in database
   */
  async updateLastKnownIP(ip) {
    try {
      await this.db.query(
        'UPDATE agents SET last_known_ip = $1 WHERE id = $2',
        [ip, this.agentId]
      );
      this.lastKnownIP = ip;
    } catch (error) {
      console.error('[AgentConnection] Error updating last known IP:', error);
    }
  }

  /**
   * Get static IP from agent settings
   */
  async getStaticIPFromSettings() {
    try {
      const result = await this.db.queryOne(
        'SELECT static_ip FROM agent_settings WHERE agent_id = $1',
        [this.agentId]
      );
      return (result && result.static_ip) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Close the connection
   */
  async close() {
    this.currentConnection = null;
  }
}
