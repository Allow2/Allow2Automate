/**
 * Token Storage Utility
 * Provides secure encryption/decryption for Xbox authentication tokens using Electron's safeStorage
 *
 * @module utils/tokenStorage
 */

import { safeStorage } from 'electron';

/**
 * Secure token storage wrapper using Electron's safeStorage API
 * Handles encryption/decryption of sensitive authentication tokens
 *
 * @class TokenStorage
 * @example
 * const encrypted = TokenStorage.encrypt('my-secret-token');
 * const decrypted = TokenStorage.decrypt(encrypted);
 */
export class TokenStorage {
  /**
   * Encrypts a plain text token using OS-level encryption
   *
   * @static
   * @param {string} token - Plain text token to encrypt
   * @returns {string} Base64-encoded encrypted token
   * @throws {Error} If encryption is not available on the platform
   *
   * @example
   * const encrypted = TokenStorage.encrypt('xsts_token_here');
   */
  static encrypt(token) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available on this platform');
    }

    if (!token || typeof token !== 'string') {
      throw new Error('Token must be a non-empty string');
    }

    try {
      const buffer = safeStorage.encryptString(token);
      return buffer.toString('base64');
    } catch (error) {
      throw new Error(`Token encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts a previously encrypted token
   *
   * @static
   * @param {string} encryptedToken - Base64-encoded encrypted token
   * @returns {string} Decrypted plain text token
   * @throws {Error} If decryption fails
   *
   * @example
   * const decrypted = TokenStorage.decrypt(encrypted);
   */
  static decrypt(encryptedToken) {
    if (!encryptedToken || typeof encryptedToken !== 'string') {
      throw new Error('Encrypted token must be a non-empty string');
    }

    try {
      const buffer = Buffer.from(encryptedToken, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      throw new Error(`Token decryption failed: ${error.message}`);
    }
  }

  /**
   * Stores a value by encrypting it first
   * Accepts any JSON-serializable value
   *
   * @static
   * @param {string} key - Identifier for the stored value (not used in encryption)
   * @param {*} value - Any JSON-serializable value to encrypt
   * @returns {string} Encrypted base64 string
   * @throws {Error} If value cannot be serialized or encrypted
   *
   * @example
   * const encrypted = TokenStorage.store('xsts', {
   *   token: 'xsts_token',
   *   uhs: 'user_hash',
   *   expiresAt: Date.now() + 3600000
   * });
   */
  static store(key, value) {
    if (!key || typeof key !== 'string') {
      throw new Error('Key must be a non-empty string');
    }

    try {
      const serialized = JSON.stringify(value);
      return this.encrypt(serialized);
    } catch (error) {
      throw new Error(`Failed to store value for key '${key}': ${error.message}`);
    }
  }

  /**
   * Retrieves and decrypts a previously stored value
   *
   * @static
   * @param {string} encryptedValue - Encrypted base64 string from store()
   * @returns {*} Deserialized original value
   * @throws {Error} If decryption or deserialization fails
   *
   * @example
   * const xstsData = TokenStorage.retrieve(encryptedValue);
   * console.log(xstsData.token);
   */
  static retrieve(encryptedValue) {
    try {
      const decrypted = this.decrypt(encryptedValue);
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Failed to retrieve value: ${error.message}`);
    }
  }

  /**
   * Checks if encryption is available on the current platform
   *
   * @static
   * @returns {boolean} True if encryption is available
   *
   * @example
   * if (TokenStorage.isAvailable()) {
   *   // Safe to use encryption
   * }
   */
  static isAvailable() {
    return safeStorage.isEncryptionAvailable();
  }
}

export default TokenStorage;
