import KeypairManager from '../../app/services/KeypairManager.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';

describe('KeypairManager', () => {
  let keypairManager;
  let mockApp;
  let tempDir;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(process.cwd(), 'test-keypair-'));

    // Mock Electron app
    mockApp = {
      getPath: jest.fn((name) => {
        if (name === 'userData') {
          return tempDir;
        }
        return tempDir;
      })
    };

    keypairManager = new KeypairManager(mockApp);
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('getKeypair()', () => {
    it('should generate new RSA-4096 keypair on first call', async () => {
      const { privateKey, publicKey } = await keypairManager.getKeypair();

      expect(privateKey).toBeTruthy();
      expect(publicKey).toBeTruthy();
      expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
      expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    });

    it('should persist keypair to disk with correct permissions', async () => {
      await keypairManager.getKeypair();

      const privateKeyPath = path.join(tempDir, 'parent-keypair.pem');
      const publicKeyPath = path.join(tempDir, 'parent-public.pem');

      expect(fs.existsSync(privateKeyPath)).toBe(true);
      expect(fs.existsSync(publicKeyPath)).toBe(true);

      // Check private key permissions (0o600 - owner read/write only)
      const stats = fs.statSync(privateKeyPath);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it('should load existing keypair from disk on subsequent calls', async () => {
      // First call generates keypair
      const { privateKey: key1, publicKey: pub1 } = await keypairManager.getKeypair();

      // Create new manager instance (simulates app restart)
      const newManager = new KeypairManager(mockApp);
      const { privateKey: key2, publicKey: pub2 } = await newManager.getKeypair();

      // Keys should be identical
      expect(key1).toBe(key2);
      expect(pub1).toBe(pub2);
    });

    it('should cache keypair in memory', async () => {
      const { privateKey: key1 } = await keypairManager.getKeypair();
      const { privateKey: key2 } = await keypairManager.getKeypair();

      // Second call should return same instance (cached)
      expect(key1).toBe(key2);
    });
  });

  describe('getPublicKey()', () => {
    it('should return only public key', async () => {
      const publicKey = await keypairManager.getPublicKey();

      expect(publicKey).toBeTruthy();
      expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(publicKey).not.toContain('PRIVATE');
    });
  });

  describe('signChallenge()', () => {
    it('should sign data with private key', async () => {
      await keypairManager.getKeypair();
      const data = 'test-nonce:12345678';
      const signature = keypairManager.signChallenge(data);

      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      // Base64 signature should be roughly 512-600 characters for RSA-4096
      expect(signature.length).toBeGreaterThan(500);
    });

    it('should throw error if private key not loaded', () => {
      const data = 'test-nonce:12345678';
      expect(() => {
        keypairManager.signChallenge(data);
      }).toThrow('Private key not loaded');
    });
  });

  describe('verifySignature()', () => {
    it('should verify valid signature', async () => {
      await keypairManager.getKeypair();
      const data = 'test-nonce:12345678';
      const signature = keypairManager.signChallenge(data);

      const isValid = keypairManager.verifySignature(data, signature);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', async () => {
      await keypairManager.getKeypair();
      const data = 'test-nonce:12345678';
      const signature = keypairManager.signChallenge(data);

      // Tamper with data
      const tamperedData = 'test-nonce:87654321';
      const isValid = keypairManager.verifySignature(tamperedData, signature);
      expect(isValid).toBe(false);
    });

    it('should reject signature from different key', async () => {
      await keypairManager.getKeypair();
      const data = 'test-nonce:12345678';

      // Generate different keypair
      const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });

      // Sign with different key
      const sign = crypto.createSign('SHA256');
      sign.update(data);
      sign.end();
      const signature = sign.sign(otherKey, 'base64');

      // Should fail verification with our public key
      const isValid = keypairManager.verifySignature(data, signature);
      expect(isValid).toBe(false);
    });
  });

  describe('getKeypairPaths()', () => {
    it('should return correct file paths', () => {
      const paths = keypairManager.getKeypairPaths();

      expect(paths.privateKeyPath).toContain('parent-keypair.pem');
      expect(paths.publicKeyPath).toContain('parent-public.pem');
    });
  });

  describe('Cryptographic properties', () => {
    it('should generate different keypairs for different instances', async () => {
      const manager1 = new KeypairManager(mockApp);
      const { publicKey: pub1 } = await manager1.getKeypair();

      // Create new temp directory for second manager
      const tempDir2 = fs.mkdtempSync(path.join(process.cwd(), 'test-keypair-'));
      const mockApp2 = {
        getPath: jest.fn(() => tempDir2)
      };
      const manager2 = new KeypairManager(mockApp2);
      const { publicKey: pub2 } = await manager2.getKeypair();

      // Keys should be different
      expect(pub1).not.toBe(pub2);

      // Cleanup second directory
      fs.rmSync(tempDir2, { recursive: true, force: true });
    });

    it('should use SHA256 for signatures', async () => {
      await keypairManager.getKeypair();
      const data = 'test-data';
      const signature = keypairManager.signChallenge(data);

      // Verify using crypto module with SHA256
      const verify = crypto.createVerify('SHA256');
      verify.update(data);
      verify.end();
      const isValid = verify.verify(keypairManager.publicKey, signature, 'base64');

      expect(isValid).toBe(true);
    });
  });
});
