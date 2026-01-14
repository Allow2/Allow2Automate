import EventEmitter from 'events';
import os from 'os';

/**
 * ParentAdvertiser - Advertises Allow2Automate parent instance via mDNS
 *
 * Advertises the parent as "_allow2automate._tcp" so agents can discover it.
 * Instance name format: "<uuid>._allow2automate._tcp.local"
 * TXT records include the parent's UUID for agent identification.
 */
export default class ParentAdvertiser extends EventEmitter {
  constructor(parentUuid, apiPort) {
    super();
    this.parentUuid = parentUuid;
    this.apiPort = apiPort;
    this.bonjour = null;
    this.service = null;
    this.enabled = false;
  }

  /**
   * Start advertising the parent service
   */
  async start() {
    try {
      // Try to load bonjour-service
      const Bonjour = await this.loadBonjour();
      if (!Bonjour) {
        console.warn('[ParentAdvertiser] mDNS advertising not available');
        this.enabled = false;
        return;
      }

      this.bonjour = new Bonjour();
      this.enabled = true;

      // Service name: _allow2automate._tcp
      // Instance name: <uuid>._allow2automate._tcp.local
      this.service = this.bonjour.publish({
        name: this.parentUuid, // Instance name (the UUID)
        type: 'allow2automate', // Service type (_allow2automate._tcp)
        port: this.apiPort,
        txt: {
          uuid: this.parentUuid, // Parent UUID for agent matching
          UUID: this.parentUuid, // Uppercase variant for compatibility
          hostname: os.hostname(),
          version: '1.0.0',
          platform: process.platform
        }
      });

      console.log('[ParentAdvertiser] mDNS advertising started', {
        uuid: this.parentUuid,
        port: this.apiPort,
        serviceName: `${this.parentUuid}._allow2automate._tcp.local`
      });

      // Handle service errors
      this.service.on('error', (error) => {
        console.error('[ParentAdvertiser] mDNS service error:', error);
      });

    } catch (error) {
      console.error('[ParentAdvertiser] Failed to start mDNS advertising:', error);
      this.enabled = false;
    }
  }

  /**
   * Try to load bonjour-service module
   */
  async loadBonjour() {
    try {
      const bonjourModule = require('bonjour-service');
      return bonjourModule.Bonjour || bonjourModule.default || bonjourModule;
    } catch (error) {
      console.log('[ParentAdvertiser] bonjour-service not available:', error.message);
      return null;
    }
  }

  /**
   * Stop advertising
   */
  async stop() {
    console.log('[ParentAdvertiser] Stopping mDNS advertising');

    if (this.service) {
      return new Promise((resolve) => {
        this.service.stop(() => {
          if (this.bonjour) {
            this.bonjour.destroy();
            this.bonjour = null;
          }
          this.service = null;
          this.enabled = false;
          resolve();
        });
      });
    }
  }

  /**
   * Update advertising information (if parent UUID or port changes)
   */
  async update(newUuid, newPort) {
    if (newUuid) this.parentUuid = newUuid;
    if (newPort) this.apiPort = newPort;

    // Restart advertising with new info
    await this.stop();
    await this.start();
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      uuid: this.parentUuid,
      port: this.apiPort,
      serviceName: `${this.parentUuid}._allow2automate._tcp.local`
    };
  }
}
