/**
 * XboxMonitorCoordinator - Coordinates Xbox Live presence polling and game activity detection
 *
 * Features:
 * - 15-second polling interval for real-time presence
 * - Batch presence queries for multiple children
 * - Game activity detection (start/stop events)
 * - Game state caching to prevent duplicate events
 * - Event emission for UI updates
 */

import { EventEmitter } from 'events';

export default class XboxMonitorCoordinator extends EventEmitter {
  constructor(xboxAPI, cacheManager) {
    super();
    this.xboxAPI = xboxAPI;
    this.cacheManager = cacheManager;
    this.pollInterval = null;
    this.childMappings = {}; // { childId: { gamertag, xuid } }
    this.lastGameState = {}; // { childId: { titleId, titleName, timestamp } }
    this.pollingActive = false;
    this.checkInterval = 15000; // 15 seconds
  }

  /**
   * Start presence polling
   * @param {number} interval - Polling interval in milliseconds (default: 15000)
   */
  start(interval = 15000) {
    if (this.pollingActive) {
      console.log('[XboxMonitor] Polling already active');
      return;
    }

    this.checkInterval = interval;
    this.pollingActive = true;

    console.log(`[XboxMonitor] Starting presence polling (${interval}ms interval)`);

    // Initial check
    this.checkPresence().catch(error => {
      console.error('[XboxMonitor] Initial presence check failed:', error);
    });

    // Start polling interval
    this.pollInterval = setInterval(() => {
      this.checkPresence().catch(error => {
        console.error('[XboxMonitor] Presence check failed:', error);
        this.emit('error', error);
      });
    }, interval);

    this.emit('started', { interval });
  }

  /**
   * Stop presence polling
   */
  stop() {
    if (!this.pollingActive) {
      return;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.pollingActive = false;
    console.log('[XboxMonitor] Stopped presence polling');
    this.emit('stopped');
  }

  /**
   * Add child to monitoring
   * @param {string} childId - Allow2 child ID
   * @param {string} gamertag - Xbox gamertag
   * @param {string} xuid - Xbox User ID (XUID)
   */
  addChild(childId, gamertag, xuid) {
    this.childMappings[childId] = { gamertag, xuid };
    console.log(`[XboxMonitor] Added child ${childId} (${gamertag})`);

    // Start polling if not already active
    if (!this.pollingActive && Object.keys(this.childMappings).length > 0) {
      this.start();
    }
  }

  /**
   * Remove child from monitoring
   * @param {string} childId - Allow2 child ID
   */
  removeChild(childId) {
    delete this.childMappings[childId];
    delete this.lastGameState[childId];
    console.log(`[XboxMonitor] Removed child ${childId}`);

    // Stop polling if no children left
    if (Object.keys(this.childMappings).length === 0) {
      this.stop();
    }
  }

  /**
   * Update child mapping (e.g., if gamertag changes)
   * @param {string} childId - Allow2 child ID
   * @param {string} gamertag - New gamertag
   * @param {string} xuid - Xbox User ID
   */
  updateChild(childId, gamertag, xuid) {
    if (this.childMappings[childId]) {
      this.childMappings[childId] = { gamertag, xuid };
      console.log(`[XboxMonitor] Updated child ${childId} (${gamertag})`);
    }
  }

  /**
   * Check presence for all linked children
   * @returns {Promise<Object>} Presence data for all children
   */
  async checkPresence() {
    const xuids = Object.values(this.childMappings).map(c => c.xuid);
    if (xuids.length === 0) {
      return {};
    }

    try {
      // Batch query presence for all XUIDs
      const presenceData = await this.xboxAPI.batchPresence(xuids);

      const results = {};

      // Process each child's presence
      for (const childId in this.childMappings) {
        const { xuid, gamertag } = this.childMappings[childId];
        const presence = presenceData.find(p => p.xuid === xuid);

        if (presence) {
          results[childId] = await this.processPresence(childId, gamertag, presence);
        }
      }

      this.emit('presenceChecked', results);
      return results;

    } catch (error) {
      console.error('[XboxMonitor] Presence check error:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Process presence data for a child
   * @param {string} childId - Allow2 child ID
   * @param {string} gamertag - Xbox gamertag
   * @param {Object} presence - Presence data from API
   * @returns {Promise<Object>} Processed presence data
   */
  async processPresence(childId, gamertag, presence) {
    const result = {
      childId,
      gamertag,
      state: presence.state,
      timestamp: Date.now()
    };

    // Check if user is online and playing a game
    if (presence.state === 'Online' && presence.lastSeen?.titleId) {
      const titleId = presence.lastSeen.titleId;
      const deviceType = presence.lastSeen.deviceType || 'Unknown';

      // Get title name (check cache first)
      let titleName = this.cacheManager.get(`title:${titleId}`);
      if (!titleName) {
        try {
          const titleDetails = await this.xboxAPI.getTitleDetails(titleId);
          titleName = titleDetails?.name || 'Unknown Game';

          // Cache title name for 24 hours
          this.cacheManager.set(`title:${titleId}`, titleName, 86400);
        } catch (error) {
          console.error(`[XboxMonitor] Error fetching title ${titleId}:`, error);
          titleName = 'Unknown Game';
        }
      }

      result.activity = {
        titleId,
        titleName,
        deviceType,
        richPresence: presence.lastSeen.richPresence || null
      };

      // Check for game activity changes
      await this.handleGameActivity(childId, titleId, titleName, deviceType);
    } else {
      // User is offline or not playing
      await this.handleGameStop(childId);
    }

    return result;
  }

  /**
   * Handle game activity detection
   * @param {string} childId - Allow2 child ID
   * @param {string} titleId - Game Title ID
   * @param {string} titleName - Game name
   * @param {string} deviceType - Device type (Xbox, PC, etc.)
   */
  async handleGameActivity(childId, titleId, titleName, deviceType) {
    const lastState = this.lastGameState[childId];

    // Check if game changed (new session started)
    if (!lastState || lastState.titleId !== titleId) {
      console.log(`[XboxMonitor] Game started: ${childId} - ${titleName} (${titleId})`);

      // Emit game stopped event for previous game
      if (lastState) {
        const duration = Date.now() - lastState.timestamp;
        this.emit('gameEnded', {
          childId,
          titleId: lastState.titleId,
          titleName: lastState.titleName,
          deviceType: lastState.deviceType,
          duration,
          timestamp: Date.now()
        });
      }

      // Update last game state
      this.lastGameState[childId] = {
        titleId,
        titleName,
        deviceType,
        timestamp: Date.now()
      };

      // Emit game started event
      this.emit('gameStarted', {
        childId,
        titleId,
        titleName,
        deviceType,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle game stop detection
   * @param {string} childId - Allow2 child ID
   */
  async handleGameStop(childId) {
    const lastState = this.lastGameState[childId];

    // If there was a game running, emit game stopped event
    if (lastState) {
      const duration = Date.now() - lastState.timestamp;
      console.log(`[XboxMonitor] Game ended: ${childId} - ${lastState.titleName} (${Math.round(duration / 1000)}s)`);

      this.emit('gameEnded', {
        childId,
        titleId: lastState.titleId,
        titleName: lastState.titleName,
        deviceType: lastState.deviceType,
        duration,
        timestamp: Date.now()
      });

      // Clear last game state
      delete this.lastGameState[childId];
    }
  }

  /**
   * Force refresh presence for specific child
   * @param {string} childId - Allow2 child ID
   * @returns {Promise<Object>} Presence data
   */
  async refreshChild(childId) {
    const mapping = this.childMappings[childId];
    if (!mapping) {
      throw new Error(`Child ${childId} not found`);
    }

    try {
      const presenceData = await this.xboxAPI.batchPresence([mapping.xuid]);
      const presence = presenceData[0];

      if (presence) {
        return await this.processPresence(childId, mapping.gamertag, presence);
      }

      return null;
    } catch (error) {
      console.error(`[XboxMonitor] Error refreshing child ${childId}:`, error);
      throw error;
    }
  }

  /**
   * Get current status for all children
   * @returns {Object} Status data for all children
   */
  getStatus() {
    return {
      active: this.pollingActive,
      interval: this.checkInterval,
      childCount: Object.keys(this.childMappings).length,
      children: this.childMappings,
      currentGames: this.lastGameState
    };
  }

  /**
   * Get game history for a child
   * @param {string} childId - Allow2 child ID
   * @returns {Array} Array of game sessions
   */
  getGameHistory(childId) {
    // This would typically fetch from a database
    // For now, return the current game state if available
    const currentGame = this.lastGameState[childId];
    if (currentGame) {
      return [{
        titleId: currentGame.titleId,
        titleName: currentGame.titleName,
        deviceType: currentGame.deviceType,
        startTime: currentGame.timestamp,
        endTime: null,
        duration: Date.now() - currentGame.timestamp,
        inProgress: true
      }];
    }
    return [];
  }
}
