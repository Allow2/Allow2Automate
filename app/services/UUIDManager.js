import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * UUIDManager - Generates and persists a unique UUID for this Allow2Automate instance
 *
 * The UUID is used for mDNS discovery by agents.
 * Generated once on first run and persisted to disk.
 */
export default class UUIDManager {
  constructor(app) {
    this.app = app;
    this.uuidPath = path.join(app.getPath('userData'), 'instance-uuid.json');
    this.uuid = null;
  }

  /**
   * Get or generate the instance UUID
   */
  getUUID() {
    if (this.uuid) {
      return this.uuid;
    }

    // Try to load from disk
    this.uuid = this.loadUUID();

    // If not found, generate new one
    if (!this.uuid) {
      this.uuid = this.generateUUID();
      this.saveUUID(this.uuid);
    }

    console.log('[UUIDManager] Instance UUID:', this.uuid);
    return this.uuid;
  }

  /**
   * Load UUID from disk
   */
  loadUUID() {
    try {
      if (fs.existsSync(this.uuidPath)) {
        const data = fs.readFileSync(this.uuidPath, 'utf8');
        const parsed = JSON.parse(data);

        if (parsed.uuid) {
          console.log('[UUIDManager] Loaded existing UUID from disk');
          return parsed.uuid;
        }
      }
    } catch (error) {
      console.error('[UUIDManager] Error loading UUID:', error);
    }

    return null;
  }

  /**
   * Generate a new UUID
   */
  generateUUID() {
    const uuid = crypto.randomUUID();
    console.log('[UUIDManager] Generated new UUID:', uuid);
    return uuid;
  }

  /**
   * Save UUID to disk
   */
  saveUUID(uuid) {
    try {
      const data = {
        uuid,
        createdAt: new Date().toISOString(),
        version: '1.0.0'
      };

      fs.writeFileSync(this.uuidPath, JSON.stringify(data, null, 2), 'utf8');
      console.log('[UUIDManager] UUID saved to disk');
    } catch (error) {
      console.error('[UUIDManager] Error saving UUID:', error);
    }
  }

  /**
   * Regenerate UUID (use with caution - will break existing agent configs)
   */
  regenerateUUID() {
    console.warn('[UUIDManager] Regenerating UUID - existing agents will need new config files!');
    this.uuid = this.generateUUID();
    this.saveUUID(this.uuid);
    return this.uuid;
  }
}
