const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * KeypairManager - Manages RSA keypair for parent authentication
 *
 * Generates and stores RSA-4096 keypair for cryptographic verification
 * of parent identity. Agents use the public key to verify parent authenticity
 * via challenge-response handshake.
 */
class KeypairManager {
  constructor(app) {
    this.app = app;
    this.userDataPath = app.getPath('userData');
    this.keypairPath = path.join(this.userDataPath, 'parent-keypair.pem');
    this.publicKeyPath = path.join(this.userDataPath, 'parent-public.pem');
    this.privateKey = null;
    this.publicKey = null;
  }

  /**
   * Get or generate keypair
   * @returns {Promise<{privateKey: string, publicKey: string}>}
   */
  async getKeypair() {
    if (this.privateKey && this.publicKey) {
      return { privateKey: this.privateKey, publicKey: this.publicKey };
    }

    // Try to load from disk
    if (fs.existsSync(this.keypairPath) && fs.existsSync(this.publicKeyPath)) {
      try {
        this.privateKey = fs.readFileSync(this.keypairPath, 'utf8');
        this.publicKey = fs.readFileSync(this.publicKeyPath, 'utf8');
        console.log('[KeypairManager] Loaded existing keypair from disk');
        return { privateKey: this.privateKey, publicKey: this.publicKey };
      } catch (error) {
        console.error('[KeypairManager] Error loading keypair:', error);
        // Fall through to generate new keypair
      }
    }

    // Generate new keypair
    console.log('[KeypairManager] Generating new RSA-4096 keypair...');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Save to disk with secure permissions
    try {
      fs.writeFileSync(this.keypairPath, privateKey, { mode: 0o600 });
      fs.writeFileSync(this.publicKeyPath, publicKey, { mode: 0o644 });
      console.log('[KeypairManager] Keypair saved to:', this.keypairPath);
    } catch (error) {
      console.error('[KeypairManager] Error saving keypair:', error);
      throw error;
    }

    this.privateKey = privateKey;
    this.publicKey = publicKey;

    return { privateKey, publicKey };
  }

  /**
   * Get public key only (for config generation)
   * @returns {Promise<string>} PEM-encoded public key
   */
  async getPublicKey() {
    const { publicKey } = await this.getKeypair();
    return publicKey;
  }

  /**
   * Sign a challenge (for agent verification)
   * @param {string} data - Data to sign (typically nonce:timestamp)
   * @returns {string} Base64-encoded signature
   */
  signChallenge(data) {
    if (!this.privateKey) {
      throw new Error('Private key not loaded - call getKeypair() first');
    }

    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(this.privateKey, 'base64');
  }

  /**
   * Verify signature (for testing)
   * @param {string} data - Original data
   * @param {string} signature - Base64-encoded signature
   * @returns {boolean} True if signature is valid
   */
  verifySignature(data, signature) {
    if (!this.publicKey) {
      throw new Error('Public key not loaded - call getKeypair() first');
    }

    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(this.publicKey, signature, 'base64');
  }

  /**
   * Get keypair file paths (for backup/recovery)
   * @returns {{privateKeyPath: string, publicKeyPath: string}}
   */
  getKeypairPaths() {
    return {
      privateKeyPath: this.keypairPath,
      publicKeyPath: this.publicKeyPath
    };
  }
}

module.exports = KeypairManager;
