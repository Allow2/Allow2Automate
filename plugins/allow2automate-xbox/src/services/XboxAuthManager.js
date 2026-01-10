/**
 * XboxAuthManager - Manages Xbox Live OAuth2 authentication
 *
 * Implements 3-stage authentication flow:
 * 1. Microsoft OAuth2 (login.live.com)
 * 2. Xbox User Token (XAU)
 * 3. Xbox Security Token Service (XSTS) with SandboxId: RETAIL
 *
 * Features:
 * - Automatic token refresh before 1-hour expiry
 * - Secure token storage via Electron safeStorage
 * - Error handling with retry logic
 */

import fetch from 'node-fetch';
import { EventEmitter } from 'events';

export default class XboxAuthManager extends EventEmitter {
  constructor(tokenStorage) {
    super();
    this.tokenStorage = tokenStorage;
    this.state = {
      authenticated: false,
      oauthToken: null,
      refreshToken: null,
      xstsToken: null,
      expiresAt: null
    };
    this.refreshInterval = null;
  }

  /**
   * Build Microsoft OAuth2 authorization URL
   * @returns {string} OAuth URL for user to visit
   */
  buildAuthUrl() {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || 'YOUR_CLIENT_ID',
      response_type: 'code',
      redirect_uri: process.env.XBOX_OAUTH_REDIRECT_URI || 'http://localhost:8080/oauth/callback',
      scope: 'Xboxlive.signin Xboxlive.offline_access',
      state: this.generateState()
    });
    return `https://login.live.com/oauth20_authorize.srf?${params}`;
  }

  /**
   * Generate secure state parameter for OAuth
   * @returns {string} Random state string
   */
  generateState() {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Exchange OAuth code for access token
   * @param {string} code - OAuth authorization code
   * @returns {Promise<Object>} OAuth tokens
   */
  async exchangeCode(code) {
    try {
      const response = await fetch('https://login.live.com/oauth20_token.srf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Allow2Automate-Xbox/1.0'
        },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID || 'YOUR_CLIENT_ID',
          client_secret: process.env.MICROSOFT_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: process.env.XBOX_OAUTH_REDIRECT_URI || 'http://localhost:8080/oauth/callback'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OAuth token exchange failed: ${error}`);
      }

      const tokens = await response.json();
      return tokens;
    } catch (error) {
      console.error('[XboxAuthManager] Code exchange error:', error);
      throw error;
    }
  }

  /**
   * Stage 2: Get Xbox User Token (XAU)
   * @param {string} oauthToken - OAuth access token
   * @returns {Promise<Object>} User token with UHS
   */
  async getUserToken(oauthToken) {
    try {
      const response = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-xbl-contract-version': '1',
          'User-Agent': 'Allow2Automate-Xbox/1.0'
        },
        body: JSON.stringify({
          RelyingParty: 'http://auth.xboxlive.com',
          TokenType: 'JWT',
          Properties: {
            AuthMethod: 'RPS',
            SiteName: 'user.auth.xboxlive.com',
            RpsTicket: `d=${oauthToken}`
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Xbox User Token request failed: ${error}`);
      }

      const data = await response.json();
      return {
        token: data.Token,
        uhs: data.DisplayClaims.xui[0].uhs
      };
    } catch (error) {
      console.error('[XboxAuthManager] User token error:', error);
      throw error;
    }
  }

  /**
   * Stage 3: Get XSTS Token with RETAIL sandbox
   * @param {Object} userToken - User token with UHS
   * @returns {Promise<Object>} XSTS token with XUID
   */
  async getXSTSToken(userToken) {
    try {
      const response = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-xbl-contract-version': '1',
          'User-Agent': 'Allow2Automate-Xbox/1.0'
        },
        body: JSON.stringify({
          RelyingParty: 'http://xboxlive.com',
          TokenType: 'JWT',
          Properties: {
            UserTokens: [userToken.token],
            SandboxId: 'RETAIL'
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`XSTS Token request failed: ${error}`);
      }

      const data = await response.json();
      return {
        token: data.Token,
        uhs: data.DisplayClaims.xui[0].uhs,
        xuid: data.DisplayClaims.xui[0].xid
      };
    } catch (error) {
      console.error('[XboxAuthManager] XSTS token error:', error);
      throw error;
    }
  }

  /**
   * Complete full authentication chain
   * @param {string} code - OAuth authorization code
   * @returns {Promise<Object>} Complete authentication state
   */
  async authenticate(code) {
    try {
      console.log('[XboxAuthManager] Starting authentication...');

      // Stage 1: OAuth token
      const oauthTokens = await this.exchangeCode(code);
      console.log('[XboxAuthManager] OAuth tokens obtained');

      // Stage 2: Xbox User Token
      const userToken = await this.getUserToken(oauthTokens.access_token);
      console.log('[XboxAuthManager] Xbox User Token obtained');

      // Stage 3: XSTS Token
      const xstsToken = await this.getXSTSToken(userToken);
      console.log('[XboxAuthManager] XSTS Token obtained');

      // Store tokens securely
      this.state.authenticated = true;
      this.state.oauthToken = this.tokenStorage.encrypt(oauthTokens.access_token);
      this.state.refreshToken = this.tokenStorage.encrypt(oauthTokens.refresh_token);
      this.state.xstsToken = {
        token: this.tokenStorage.encrypt(xstsToken.token),
        uhs: xstsToken.uhs,
        xuid: xstsToken.xuid
      };
      this.state.expiresAt = Date.now() + (oauthTokens.expires_in * 1000);

      // Start auto-refresh timer (refresh 5 minutes before expiry)
      this.startAutoRefresh();

      this.emit('authenticated', this.state);
      console.log('[XboxAuthManager] Authentication complete');

      return this.state;
    } catch (error) {
      console.error('[XboxAuthManager] Authentication error:', error);
      this.state.authenticated = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Refresh OAuth token using refresh token
   * @returns {Promise<void>}
   */
  async refreshToken() {
    try {
      console.log('[XboxAuthManager] Refreshing token...');

      const refreshToken = this.tokenStorage.decrypt(this.state.refreshToken);

      const response = await fetch('https://login.live.com/oauth20_token.srf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Allow2Automate-Xbox/1.0'
        },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID || 'YOUR_CLIENT_ID',
          client_secret: process.env.MICROSOFT_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      const tokens = await response.json();

      // Re-authenticate with new OAuth token
      const userToken = await this.getUserToken(tokens.access_token);
      const xstsToken = await this.getXSTSToken(userToken);

      // Update stored tokens
      this.state.oauthToken = this.tokenStorage.encrypt(tokens.access_token);
      this.state.refreshToken = this.tokenStorage.encrypt(tokens.refresh_token);
      this.state.xstsToken = {
        token: this.tokenStorage.encrypt(xstsToken.token),
        uhs: xstsToken.uhs,
        xuid: xstsToken.xuid
      };
      this.state.expiresAt = Date.now() + (tokens.expires_in * 1000);

      this.emit('tokenRefreshed', this.state);
      console.log('[XboxAuthManager] Token refreshed successfully');
    } catch (error) {
      console.error('[XboxAuthManager] Token refresh error:', error);
      this.state.authenticated = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Ensure token is valid, refresh if needed
   * @returns {Promise<void>}
   */
  async ensureValidToken() {
    if (!this.state.authenticated) {
      throw new Error('Not authenticated');
    }

    const now = Date.now();
    const timeUntilExpiry = this.state.expiresAt - now;

    // Refresh if less than 5 minutes remaining
    if (timeUntilExpiry < 300000) {
      console.log('[XboxAuthManager] Token expiring soon, refreshing...');
      await this.refreshToken();
    }
  }

  /**
   * Start automatic token refresh
   */
  startAutoRefresh() {
    // Clear existing interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Check token validity every minute
    this.refreshInterval = setInterval(async () => {
      try {
        await this.ensureValidToken();
      } catch (error) {
        console.error('[XboxAuthManager] Auto-refresh error:', error);
      }
    }, 60000); // 1 minute
  }

  /**
   * Stop automatic token refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Get current XSTS token (decrypted)
   * @returns {Object} XSTS token with UHS and XUID
   */
  getXSTSToken() {
    if (!this.state.authenticated || !this.state.xstsToken) {
      return null;
    }

    return {
      token: this.tokenStorage.decrypt(this.state.xstsToken.token),
      uhs: this.state.xstsToken.uhs,
      xuid: this.state.xstsToken.xuid
    };
  }

  /**
   * Check if authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.state.authenticated;
  }

  /**
   * Sign out and clear tokens
   */
  signOut() {
    this.stopAutoRefresh();
    this.state = {
      authenticated: false,
      oauthToken: null,
      refreshToken: null,
      xstsToken: null,
      expiresAt: null
    };
    this.emit('signedOut');
    console.log('[XboxAuthManager] Signed out');
  }

  /**
   * Load state from storage
   * @param {Object} savedState - Previously saved state
   */
  loadState(savedState) {
    if (savedState && savedState.authenticated) {
      this.state = savedState;
      this.startAutoRefresh();
      console.log('[XboxAuthManager] State loaded from storage');
    }
  }

  /**
   * Get state for storage
   * @returns {Object} Current state
   */
  getState() {
    return this.state;
  }
}
