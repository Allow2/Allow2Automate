/**
 * ChildLinkManager - Manages linking Allow2 children to Xbox gamertags
 *
 * Features:
 * - Gamertag validation
 * - XUID lookup from gamertag
 * - Child-to-Xbox mapping storage
 * - Privacy compliance (XUID never exposed in UI)
 * - Unlinking functionality
 */

import { EventEmitter } from 'events';

export default class ChildLinkManager extends EventEmitter {
  constructor(xboxAPI) {
    super();
    this.xboxAPI = xboxAPI;
    this.childMappings = {}; // { childId: { gamertag, xuid, linkedAt } }
  }

  /**
   * Validate Xbox gamertag format
   * @param {string} gamertag - Gamertag to validate
   * @returns {boolean} True if valid
   * @throws {Error} If invalid
   */
  validateGamertag(gamertag) {
    if (!gamertag || typeof gamertag !== 'string') {
      throw new Error('Gamertag is required');
    }

    const trimmed = gamertag.trim();

    // Xbox gamertag rules:
    // - 1-15 characters
    // - Letters, numbers, spaces
    // - Cannot start or end with space
    // - No special characters except space
    if (trimmed.length < 1 || trimmed.length > 15) {
      throw new Error('Gamertag must be 1-15 characters');
    }

    if (trimmed !== gamertag) {
      throw new Error('Gamertag cannot start or end with spaces');
    }

    const regex = /^[a-zA-Z0-9][\sa-zA-Z0-9]{0,13}[a-zA-Z0-9]$/;
    if (!regex.test(gamertag) && gamertag.length > 1) {
      throw new Error('Gamertag contains invalid characters');
    }

    // Single character gamertag (just alphanumeric)
    if (gamertag.length === 1 && !/^[a-zA-Z0-9]$/.test(gamertag)) {
      throw new Error('Single character gamertag must be alphanumeric');
    }

    return true;
  }

  /**
   * Get XUID from gamertag using Xbox Profile API
   * @param {string} gamertag - Xbox gamertag
   * @returns {Promise<string>} XUID
   */
  async getXUIDFromGamertag(gamertag) {
    try {
      // Validate gamertag first
      this.validateGamertag(gamertag);

      console.log(`[ChildLinkManager] Looking up XUID for gamertag: ${gamertag}`);

      // Query Xbox Profile API
      const profile = await this.xboxAPI.getProfileByGamertag(gamertag);

      if (!profile || !profile.xuid) {
        throw new Error(`Gamertag "${gamertag}" not found`);
      }

      console.log(`[ChildLinkManager] Found XUID for ${gamertag}`);
      return profile.xuid;

    } catch (error) {
      console.error('[ChildLinkManager] XUID lookup error:', error);
      throw error;
    }
  }

  /**
   * Link Allow2 child to Xbox gamertag
   * @param {string} childId - Allow2 child ID
   * @param {string} childName - Allow2 child name
   * @param {string} gamertag - Xbox gamertag
   * @returns {Promise<Object>} Linking result (without XUID)
   */
  async linkChild(childId, childName, gamertag) {
    try {
      // Validate inputs
      if (!childId) {
        throw new Error('Child ID is required');
      }

      if (!childName) {
        throw new Error('Child name is required');
      }

      // Validate and lookup gamertag
      this.validateGamertag(gamertag);
      const xuid = await this.getXUIDFromGamertag(gamertag);

      // Check if this XUID is already linked to another child
      const existingLink = this.findChildByXUID(xuid);
      if (existingLink && existingLink.childId !== childId) {
        throw new Error(`This Xbox account is already linked to ${existingLink.childName}`);
      }

      // Store mapping
      this.childMappings[childId] = {
        childId,
        childName,
        gamertag,
        xuid, // PRIVATE - never expose in UI
        linkedAt: Date.now()
      };

      console.log(`[ChildLinkManager] Linked child ${childId} (${childName}) to ${gamertag}`);

      // Emit event (without XUID for privacy)
      this.emit('childLinked', {
        childId,
        childName,
        gamertag,
        linkedAt: this.childMappings[childId].linkedAt
      });

      // Return result without XUID (privacy compliance)
      return {
        childId,
        childName,
        gamertag,
        linkedAt: this.childMappings[childId].linkedAt,
        success: true
      };

    } catch (error) {
      console.error('[ChildLinkManager] Link error:', error);
      this.emit('linkError', { childId, error: error.message });
      throw error;
    }
  }

  /**
   * Unlink child from Xbox account
   * @param {string} childId - Allow2 child ID
   * @returns {Object} Unlink result
   */
  unlinkChild(childId) {
    const mapping = this.childMappings[childId];
    if (!mapping) {
      throw new Error(`Child ${childId} is not linked to an Xbox account`);
    }

    const gamertag = mapping.gamertag;
    delete this.childMappings[childId];

    console.log(`[ChildLinkManager] Unlinked child ${childId} from ${gamertag}`);

    this.emit('childUnlinked', { childId, gamertag });

    return {
      childId,
      gamertag,
      success: true
    };
  }

  /**
   * Find child by XUID (internal use only)
   * @param {string} xuid - Xbox User ID
   * @returns {Object|null} Child mapping or null
   */
  findChildByXUID(xuid) {
    for (const childId in this.childMappings) {
      if (this.childMappings[childId].xuid === xuid) {
        return this.childMappings[childId];
      }
    }
    return null;
  }

  /**
   * Check if child is linked
   * @param {string} childId - Allow2 child ID
   * @returns {boolean} True if linked
   */
  isChildLinked(childId) {
    return !!this.childMappings[childId];
  }

  /**
   * Get child mapping (without XUID)
   * @param {string} childId - Allow2 child ID
   * @returns {Object|null} Child mapping (privacy-safe)
   */
  getChildMapping(childId) {
    const mapping = this.childMappings[childId];
    if (!mapping) {
      return null;
    }

    // Return copy without XUID (privacy compliance)
    return {
      childId: mapping.childId,
      childName: mapping.childName,
      gamertag: mapping.gamertag,
      linkedAt: mapping.linkedAt
    };
  }

  /**
   * Get XUID for child (internal use only - for API calls)
   * @param {string} childId - Allow2 child ID
   * @returns {string|null} XUID or null
   */
  getXUIDForChild(childId) {
    const mapping = this.childMappings[childId];
    return mapping ? mapping.xuid : null;
  }

  /**
   * Get all child mappings (without XUIDs)
   * @returns {Array} Array of child mappings
   */
  getAllMappings() {
    return Object.values(this.childMappings).map(mapping => ({
      childId: mapping.childId,
      childName: mapping.childName,
      gamertag: mapping.gamertag,
      linkedAt: mapping.linkedAt
    }));
  }

  /**
   * Get all XUIDs (internal use only - for batch queries)
   * @returns {Array<string>} Array of XUIDs
   */
  getAllXUIDs() {
    return Object.values(this.childMappings).map(m => m.xuid);
  }

  /**
   * Update gamertag for child (e.g., if user changed gamertag)
   * @param {string} childId - Allow2 child ID
   * @param {string} newGamertag - New gamertag
   * @returns {Promise<Object>} Update result
   */
  async updateGamertag(childId, newGamertag) {
    const mapping = this.childMappings[childId];
    if (!mapping) {
      throw new Error(`Child ${childId} is not linked`);
    }

    // Validate and lookup new gamertag
    this.validateGamertag(newGamertag);
    const xuid = await this.getXUIDFromGamertag(newGamertag);

    // Verify XUID matches (same Xbox account, different gamertag)
    if (xuid !== mapping.xuid) {
      throw new Error('New gamertag belongs to a different Xbox account');
    }

    const oldGamertag = mapping.gamertag;
    mapping.gamertag = newGamertag;

    console.log(`[ChildLinkManager] Updated gamertag for ${childId}: ${oldGamertag} → ${newGamertag}`);

    this.emit('gamertagUpdated', {
      childId,
      oldGamertag,
      newGamertag
    });

    return {
      childId,
      oldGamertag,
      newGamertag,
      success: true
    };
  }

  /**
   * Refresh gamertag from Xbox API (check if changed)
   * @param {string} childId - Allow2 child ID
   * @returns {Promise<boolean>} True if gamertag changed
   */
  async refreshGamertag(childId) {
    const mapping = this.childMappings[childId];
    if (!mapping) {
      throw new Error(`Child ${childId} is not linked`);
    }

    try {
      // Get current profile from Xbox
      const profile = await this.xboxAPI.getProfile(mapping.xuid);

      // Check if gamertag changed
      if (profile.gamertag !== mapping.gamertag) {
        const oldGamertag = mapping.gamertag;
        mapping.gamertag = profile.gamertag;

        console.log(`[ChildLinkManager] Gamertag changed for ${childId}: ${oldGamertag} → ${profile.gamertag}`);

        this.emit('gamertagUpdated', {
          childId,
          oldGamertag,
          newGamertag: profile.gamertag
        });

        return true;
      }

      return false;

    } catch (error) {
      console.error(`[ChildLinkManager] Gamertag refresh error for ${childId}:`, error);
      throw error;
    }
  }

  /**
   * Load mappings from storage
   * @param {Object} savedMappings - Previously saved mappings
   */
  loadMappings(savedMappings) {
    if (savedMappings && typeof savedMappings === 'object') {
      this.childMappings = savedMappings;
      console.log(`[ChildLinkManager] Loaded ${Object.keys(savedMappings).length} child mappings`);
    }
  }

  /**
   * Get mappings for storage
   * @returns {Object} Current mappings
   */
  getMappings() {
    return this.childMappings;
  }
}
