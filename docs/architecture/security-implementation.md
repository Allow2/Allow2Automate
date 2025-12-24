# Allow2Automate Plugin Marketplace - Security Implementation Guide

## Table of Contents
1. [Malware Scanning Pipeline](#malware-scanning-pipeline)
2. [Authentication & Authorization](#authentication--authorization)
3. [API Security](#api-security)
4. [Data Protection](#data-protection)
5. [Incident Response](#incident-response)
6. [Security Testing](#security-testing)

---

## 1. Malware Scanning Pipeline

### 1.1 Static Analysis (Stage 1)

**ClamAV Antivirus Scanner**
```javascript
// lambda/scanners/clamav-scanner.js
const { execSync } = require('child_process');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

exports.handler = async (event) => {
  const { pluginId, version, s3Key } = JSON.parse(event.Records[0].body);

  try {
    // Download plugin from S3
    const plugin = await s3.getObject({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key
    }).promise();

    // Write to temp file
    const tempFile = `/tmp/${pluginId}.tgz`;
    fs.writeFileSync(tempFile, plugin.Body);

    // Extract archive
    execSync(`tar -xzf ${tempFile} -C /tmp/${pluginId}`);

    // Run ClamAV scan
    const result = execSync(`clamscan -r --infected --remove=no /tmp/${pluginId}`, {
      timeout: 60000
    }).toString();

    const infected = result.includes('Infected files:') && !result.includes('Infected files: 0');

    // Update database
    await updateScanResult(pluginId, version, 'clamav', {
      status: infected ? 'failed' : 'passed',
      infected_files: infected ? parseInfectedFiles(result) : [],
      scan_time: new Date().toISOString()
    });

    if (infected) {
      await quarantinePlugin(pluginId, version, 'Malware detected by ClamAV');
      await notifyPublisher(pluginId, 'malware_detected', result);
    }

    return { statusCode: 200, body: JSON.stringify({ infected }) };
  } catch (error) {
    console.error('ClamAV scan failed:', error);
    await updateScanResult(pluginId, version, 'clamav', {
      status: 'error',
      error: error.message
    });
    throw error;
  }
};
```

**npm audit Scanner**
```javascript
// lambda/scanners/npm-audit-scanner.js
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

exports.handler = async (event) => {
  const { pluginId, version, s3Key } = JSON.parse(event.Records[0].body);

  try {
    // Download and extract plugin
    await downloadAndExtract(s3Key, `/tmp/${pluginId}`);

    // Run npm audit
    const { stdout, stderr } = await execAsync('npm audit --json', {
      cwd: `/tmp/${pluginId}`,
      timeout: 120000
    });

    const auditResult = JSON.parse(stdout);

    // Analyze vulnerabilities
    const critical = auditResult.metadata.vulnerabilities.critical || 0;
    const high = auditResult.metadata.vulnerabilities.high || 0;
    const moderate = auditResult.metadata.vulnerabilities.moderate || 0;

    const vulnerabilities = Object.values(auditResult.vulnerabilities || {}).map(vuln => ({
      name: vuln.name,
      severity: vuln.severity,
      via: vuln.via,
      range: vuln.range,
      cve: vuln.via.filter(v => typeof v === 'object').map(v => v.source),
      fix_available: vuln.fixAvailable
    }));

    // Update database
    await updateScanResult(pluginId, version, 'npm_audit', {
      status: critical > 0 ? 'failed' : (high > 0 ? 'warning' : 'passed'),
      vulnerabilities,
      summary: {
        critical,
        high,
        moderate,
        low: auditResult.metadata.vulnerabilities.low || 0
      }
    });

    // Auto-reject if critical vulnerabilities
    if (critical > 0) {
      await rejectPlugin(pluginId, version, `${critical} critical vulnerabilities detected`);
      await notifyPublisher(pluginId, 'critical_vulnerabilities', vulnerabilities);
    }

    return { statusCode: 200, body: JSON.stringify({ vulnerabilities }) };
  } catch (error) {
    console.error('npm audit failed:', error);
    await updateScanResult(pluginId, version, 'npm_audit', {
      status: 'error',
      error: error.message
    });
    throw error;
  }
};
```

**Semgrep SAST Scanner**
```yaml
# config/semgrep-rules.yml
rules:
  - id: dangerous-eval
    pattern: eval($ARG)
    message: Use of eval() detected - potential code injection vulnerability
    severity: ERROR
    languages: [javascript]

  - id: hardcoded-secret
    patterns:
      - pattern: |
          password = "..."
      - pattern-not: |
          password = ""
    message: Hardcoded password detected
    severity: WARNING
    languages: [javascript]

  - id: sql-injection
    pattern: |
      db.query($QUERY + ...)
    message: Potential SQL injection - use parameterized queries
    severity: ERROR
    languages: [javascript]

  - id: command-injection
    patterns:
      - pattern: |
          exec($CMD + ...)
      - pattern: |
          spawn($CMD, [$ARGS + ...])
    message: Potential command injection vulnerability
    severity: ERROR
    languages: [javascript]

  - id: path-traversal
    pattern: |
      fs.readFile($USER_INPUT + ...)
    message: Potential path traversal vulnerability
    severity: ERROR
    languages: [javascript]

  - id: insecure-crypto
    patterns:
      - pattern: crypto.createHash('md5')
      - pattern: crypto.createHash('sha1')
    message: Insecure hash algorithm - use SHA-256 or better
    severity: WARNING
    languages: [javascript]
```

### 1.2 Package Validation (Stage 2)

```javascript
// api/validators/plugin-validator.js
const Joi = require('joi');

const packageJsonSchema = Joi.object({
  name: Joi.string().pattern(/^[a-z0-9-]+$/).min(3).max(50).required(),
  version: Joi.string().pattern(/^\d+\.\d+\.\d+(-[\w.]+)?$/).required(), // Semver
  description: Joi.string().max(500).required(),
  main: Joi.string().pattern(/\.(js|mjs)$/).required(),
  author: Joi.alternatives().try(
    Joi.string(),
    Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email(),
      url: Joi.string().uri()
    })
  ).required(),
  license: Joi.string().valid(...SPDX_LICENSES).required(),
  repository: Joi.object({
    type: Joi.string().valid('git'),
    url: Joi.string().uri()
  }),
  keywords: Joi.array().items(Joi.string()).max(10),
  homepage: Joi.string().uri(),

  // Allow2Automate specific
  allow2automate: Joi.object({
    compatibility: Joi.string().pattern(/^[><=~^]\d+\.\d+\.\d+$/).required(),
    permissions: Joi.array().items(Joi.string().valid(
      'network',
      'filesystem',
      'child_process',
      'native_modules'
    )),
    category: Joi.string().valid(
      'automation',
      'integration',
      'monitoring',
      'notification',
      'utility',
      'security'
    ).required()
  }).required(),

  // Security checks
  scripts: Joi.object({
    preinstall: Joi.forbidden(), // Block malicious install hooks
    postinstall: Joi.string().allow(''),
    test: Joi.string()
  }),

  dependencies: Joi.object().pattern(
    Joi.string(),
    Joi.string()
  ),

  devDependencies: Joi.object().forbidden(), // Don't include in published package

  engines: Joi.object({
    node: Joi.string().required()
  })
}).unknown(false);

async function validatePlugin(packageJson, archivePath) {
  const errors = [];

  // 1. Validate package.json schema
  const { error } = packageJsonSchema.validate(packageJson);
  if (error) {
    errors.push({ stage: 'schema', details: error.details });
  }

  // 2. Check file size limits
  const stats = fs.statSync(archivePath);
  if (stats.size > 50 * 1024 * 1024) { // 50MB
    errors.push({ stage: 'size', message: 'Plugin exceeds 50MB limit' });
  }

  // 3. Extract and count files
  const files = await extractArchive(archivePath);
  if (files.length > 1000) {
    errors.push({ stage: 'file_count', message: 'Plugin exceeds 1000 file limit' });
  }

  // 4. Check for suspicious files
  const suspiciousFiles = files.filter(f =>
    f.endsWith('.exe') ||
    f.endsWith('.dll') ||
    f.endsWith('.so') ||
    f.includes('..')  // Path traversal attempt
  );
  if (suspiciousFiles.length > 0) {
    errors.push({ stage: 'suspicious_files', files: suspiciousFiles });
  }

  // 5. Verify license
  const hasLicenseFile = files.some(f => f.toLowerCase() === 'license' || f.toLowerCase() === 'license.md');
  if (!hasLicenseFile && !packageJson.license) {
    errors.push({ stage: 'license', message: 'No license specified' });
  }

  // 6. Check for README
  const hasReadme = files.some(f => f.toLowerCase().startsWith('readme'));
  if (!hasReadme) {
    errors.push({ stage: 'readme', message: 'No README found (recommended)' });
  }

  return {
    valid: errors.filter(e => e.stage !== 'readme').length === 0,
    errors,
    warnings: errors.filter(e => e.stage === 'readme')
  };
}
```

### 1.3 Sandbox Execution (Stage 3)

```dockerfile
# docker/sandbox/Dockerfile
FROM node:18-alpine

# Install security tools
RUN apk add --no-cache \
    strace \
    tcpdump \
    iptables

# Create non-root user
RUN addgroup -S sandbox && adduser -S sandbox -G sandbox

# Set resource limits
RUN echo "sandbox soft nofile 256" >> /etc/security/limits.conf && \
    echo "sandbox hard nofile 512" >> /etc/security/limits.conf && \
    echo "sandbox soft nproc 10" >> /etc/security/limits.conf && \
    echo "sandbox hard nproc 20" >> /etc/security/limits.conf

# Network monitoring script
COPY monitor-network.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/monitor-network.sh

USER sandbox
WORKDIR /home/sandbox

CMD ["node", "test-plugin.js"]
```

```javascript
// lambda/scanners/sandbox-executor.js
const Docker = require('dockerode');
const docker = new Docker();

async function sandboxTest(pluginId, version, archivePath) {
  const containerId = `sandbox-${pluginId}-${Date.now()}`;

  try {
    // Create isolated network
    const network = await docker.createNetwork({
      Name: `sandbox-net-${containerId}`,
      Driver: 'bridge',
      Internal: true  // No external access
    });

    // Create container
    const container = await docker.createContainer({
      Image: 'marketplace-sandbox:latest',
      name: containerId,
      HostConfig: {
        Memory: 512 * 1024 * 1024, // 512MB
        MemorySwap: 512 * 1024 * 1024,
        CpuShares: 512,
        PidsLimit: 50,
        NetworkMode: network.id,
        ReadonlyRootfs: true,
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=100m'
        },
        SecurityOpt: ['no-new-privileges'],
        CapDrop: ['ALL']
      },
      Env: [
        `PLUGIN_PATH=/tmp/plugin.tgz`,
        `TIMEOUT=300000`  // 5 minutes
      ]
    });

    // Copy plugin archive
    await container.putArchive(archivePath, { path: '/tmp' });

    // Start monitoring
    const logs = [];
    const networkCalls = [];
    const fileAccess = [];
    const processSpawns = [];

    // Attach to container output
    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true
    });

    stream.on('data', (chunk) => {
      logs.push(chunk.toString());

      // Parse structured logs
      try {
        const log = JSON.parse(chunk.toString());
        if (log.type === 'network') networkCalls.push(log);
        if (log.type === 'file') fileAccess.push(log);
        if (log.type === 'process') processSpawns.push(log);
      } catch (e) {
        // Non-JSON log
      }
    });

    // Start container
    await container.start();

    // Wait for completion or timeout
    const result = await container.wait({ condition: 'not-running' });

    // Analyze results
    const threats = [];

    // Check for suspicious network calls
    const externalCalls = networkCalls.filter(call =>
      !call.destination.startsWith('127.0.0.1') &&
      !call.destination.startsWith('localhost')
    );
    if (externalCalls.length > 0) {
      threats.push({
        type: 'network',
        severity: 'high',
        description: `Unexpected external network calls detected`,
        details: externalCalls
      });
    }

    // Check for file system tampering
    const suspiciousFiles = fileAccess.filter(f =>
      f.operation === 'write' &&
      !f.path.startsWith('/tmp')
    );
    if (suspiciousFiles.length > 0) {
      threats.push({
        type: 'filesystem',
        severity: 'medium',
        description: 'Attempted write outside /tmp directory',
        details: suspiciousFiles
      });
    }

    // Check for process spawning
    if (processSpawns.length > 5) {
      threats.push({
        type: 'process',
        severity: 'medium',
        description: `Excessive process spawning (${processSpawns.length} processes)`,
        details: processSpawns
      });
    }

    // Clean up
    await container.remove({ force: true });
    await network.remove();

    return {
      status: threats.length === 0 ? 'passed' : 'failed',
      threats,
      logs: logs.join('\n'),
      exit_code: result.StatusCode
    };

  } catch (error) {
    console.error('Sandbox execution failed:', error);
    throw error;
  }
}
```

---

## 2. Authentication & Authorization

### 2.1 OAuth 2.0 Implementation

```javascript
// api/auth/oauth-github.js
const axios = require('axios');
const jwt = require('jsonwebtoken');

async function handleGitHubCallback(code, state) {
  // Exchange code for access token
  const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    code,
    state
  }, {
    headers: { Accept: 'application/json' }
  });

  const { access_token } = tokenResponse.data;

  // Fetch user profile
  const userResponse = await axios.get('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${access_token}` }
  });

  const githubUser = userResponse.data;

  // Find or create user
  let user = await db.query(
    'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
    ['github', githubUser.id]
  );

  if (user.rows.length === 0) {
    // Create new user
    user = await db.query(
      `INSERT INTO users (email, username, oauth_provider, oauth_id, is_verified)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [githubUser.email, githubUser.login, 'github', githubUser.id]
    );
  }

  const dbUser = user.rows[0];

  // Check if user is banned
  if (dbUser.is_banned) {
    throw new Error('User account is banned');
  }

  // Generate JWT
  const token = jwt.sign(
    {
      user_id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      scopes: ['plugin:read', 'plugin:publish', 'user:read']
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '24h',
      issuer: 'marketplace.allow2automate.com',
      audience: 'api.allow2automate.com'
    }
  );

  // Update last login
  await db.query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [dbUser.id]
  );

  // Log audit event
  await logAuditEvent({
    user_id: dbUser.id,
    action: 'user.login',
    ip_address: request.ip,
    user_agent: request.headers['user-agent']
  });

  return { token, user: dbUser };
}
```

### 2.2 API Key Management

```javascript
// api/auth/api-keys.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');

async function generateApiKey(userId, name, scopes) {
  // Generate cryptographically secure random key
  const keyBytes = crypto.randomBytes(32);
  const apiKey = `a2a_live_${keyBytes.toString('hex')}`;

  // Hash key for storage (bcrypt)
  const keyHash = await bcrypt.hash(apiKey, 10);

  // Store in database
  const result = await db.query(
    `INSERT INTO api_keys (user_id, key_hash, key_prefix, name, scopes, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '90 days')
     RETURNING id, key_prefix, created_at, expires_at`,
    [
      userId,
      keyHash,
      apiKey.substring(0, 20),  // Store prefix for identification
      name,
      scopes
    ]
  );

  // Log audit event
  await logAuditEvent({
    user_id: userId,
    action: 'api_key.created',
    resource_type: 'api_key',
    resource_id: result.rows[0].id,
    metadata: { scopes, name }
  });

  // Return full key (only shown once)
  return {
    api_key: apiKey,
    ...result.rows[0]
  };
}

async function validateApiKey(apiKey) {
  if (!apiKey || !apiKey.startsWith('a2a_live_')) {
    throw new Error('Invalid API key format');
  }

  // Rate limit API key validation attempts
  const rateLimitKey = `ratelimit:api_key:${apiKey.substring(0, 20)}`;
  const attempts = await redis.incr(rateLimitKey);
  await redis.expire(rateLimitKey, 60);

  if (attempts > 10) {
    throw new Error('Too many validation attempts');
  }

  // Find keys with matching prefix (narrow search)
  const keys = await db.query(
    `SELECT k.*, u.is_banned, u.email
     FROM api_keys k
     JOIN users u ON k.user_id = u.id
     WHERE k.key_prefix = $1 AND k.is_revoked = false AND k.expires_at > NOW()`,
    [apiKey.substring(0, 20)]
  );

  // Compare hash (constant-time comparison)
  for (const key of keys.rows) {
    const valid = await bcrypt.compare(apiKey, key.key_hash);
    if (valid) {
      if (key.is_banned) {
        throw new Error('User account is banned');
      }

      // Update last used timestamp (async, don't wait)
      db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [key.id])
        .catch(err => console.error('Failed to update last_used_at:', err));

      return {
        user_id: key.user_id,
        email: key.email,
        scopes: key.scopes,
        api_key_id: key.id
      };
    }
  }

  throw new Error('Invalid API key');
}
```

### 2.3 Multi-Factor Authentication (TOTP)

```javascript
// api/auth/mfa.js
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

async function enableMFA(userId) {
  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `Allow2Automate Marketplace (${user.email})`,
    issuer: 'Allow2Automate'
  });

  // Store secret (encrypted)
  const encryptedSecret = encrypt(secret.base32, process.env.MFA_ENCRYPTION_KEY);

  await db.query(
    `UPDATE users SET mfa_secret = $1, mfa_enabled = false WHERE id = $2`,
    [encryptedSecret, userId]
  );

  // Generate QR code
  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,  // Show once for manual entry
    qr_code: qrCodeDataUrl,
    backup_codes: generateBackupCodes()  // 10 single-use codes
  };
}

async function verifyMFAToken(userId, token) {
  const user = await db.query(
    'SELECT mfa_secret FROM users WHERE id = $1 AND mfa_enabled = true',
    [userId]
  );

  if (user.rows.length === 0) {
    throw new Error('MFA not enabled for this user');
  }

  const decryptedSecret = decrypt(user.rows[0].mfa_secret, process.env.MFA_ENCRYPTION_KEY);

  const verified = speakeasy.totp.verify({
    secret: decryptedSecret,
    encoding: 'base32',
    token,
    window: 2  // Allow 2 time steps (60 seconds) drift
  });

  if (!verified) {
    // Check backup codes
    const backupCodeValid = await checkBackupCode(userId, token);
    if (!backupCodeValid) {
      throw new Error('Invalid MFA token');
    }
  }

  return true;
}
```

---

## 3. API Security

### 3.1 Rate Limiting (Redis)

```javascript
// api/middleware/rate-limiter.js
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

const RATE_LIMITS = {
  anonymous: { requests: 100, window: 60 },       // 100/min
  authenticated: { requests: 1000, window: 60 },  // 1000/min
  trusted: { requests: 5000, window: 60 }         // 5000/min
};

async function rateLimitMiddleware(req, res, next) {
  const tier = getUserTier(req);
  const { requests, window } = RATE_LIMITS[tier];

  const identifier = req.user?.id || req.ip;
  const key = `ratelimit:${tier}:${identifier}:${Math.floor(Date.now() / 1000 / window)}`;

  try {
    const current = await redis.incr(key);
    await redis.expire(key, window);

    // Set response headers
    res.setHeader('X-RateLimit-Limit', requests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, requests - current));
    res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + window);

    if (current > requests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retry_after: window
      });
    }

    next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Fail open (allow request) if Redis is down
    next();
  }
}

function getUserTier(req) {
  if (!req.user) return 'anonymous';
  if (req.user.reputation_score > 1000) return 'trusted';
  return 'authenticated';
}
```

### 3.2 Input Validation

```javascript
// api/middleware/validator.js
const Joi = require('joi');

function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate({
      body: req.body,
      query: req.query,
      params: req.params
    }, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }))
      });
    }

    // Replace request with validated data
    req.validatedData = value;
    next();
  };
}

// Example usage
const publishPluginSchema = Joi.object({
  body: Joi.object({
    package: Joi.string().base64().required(),  // Base64-encoded .tgz
    readme: Joi.string().max(50000),
    changelog: Joi.string().max(10000)
  }),
  query: Joi.object({}),
  params: Joi.object({})
});

router.post('/plugins',
  authenticate,
  validateRequest(publishPluginSchema),
  publishPluginHandler
);
```

---

## 4. Data Protection

### 4.1 Encryption at Rest

```javascript
// api/utils/encryption.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');  // 32 bytes

function encrypt(plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv + authTag + ciphertext
  return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

function decrypt(ciphertext) {
  const iv = Buffer.from(ciphertext.substring(0, 32), 'hex');
  const authTag = Buffer.from(ciphertext.substring(32, 64), 'hex');
  const encrypted = ciphertext.substring(64);

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### 4.2 SQL Injection Prevention

```javascript
// api/database/queries.js
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: 100,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// ✅ CORRECT: Parameterized query
async function getPluginByName(name) {
  const result = await pool.query(
    'SELECT * FROM plugins WHERE name = $1 AND security_status = $2',
    [name, 'approved']
  );
  return result.rows[0];
}

// ❌ WRONG: String concatenation (vulnerable to SQL injection)
// async function getPluginByName(name) {
//   const result = await pool.query(
//     `SELECT * FROM plugins WHERE name = '${name}'`
//   );
//   return result.rows[0];
// }

// Prepared statements for frequently executed queries
async function searchPlugins(query, category, limit, offset) {
  const prepared = {
    name: 'search-plugins',
    text: `
      SELECT id, name, display_name, description, rating_average, download_count
      FROM plugins
      WHERE tsv @@ plainto_tsquery('english', $1)
        AND ($2::varchar IS NULL OR category = $2)
        AND security_status = 'approved'
      ORDER BY ts_rank(tsv, plainto_tsquery('english', $1)) DESC, download_count DESC
      LIMIT $3 OFFSET $4
    `,
    values: [query, category, limit, offset]
  };

  const result = await pool.query(prepared);
  return result.rows;
}
```

---

## 5. Incident Response

### 5.1 Security Incident Playbook

```yaml
# docs/incident-response-playbook.yml
incident_types:
  malware_detection:
    severity: P1
    response_time: 15_minutes

    steps:
      - action: Quarantine plugin immediately
        command: |
          UPDATE plugins SET security_status = 'quarantined' WHERE id = :plugin_id;
          DELETE FROM cdn_cache WHERE key LIKE '/plugins/:plugin_id%';

      - action: Notify affected users
        template: malware_notification
        recipients:
          - plugin_author
          - users_who_installed

      - action: Analyze infection scope
        queries:
          - Count installations in last 30 days
          - Check for similar patterns in other plugins

      - action: Report to authorities
        conditions:
          - severity >= HIGH
          - user_impact > 100
        recipients:
          - cert@us-cert.gov
          - security@github.com

      - action: Post-mortem
        deadline: 72_hours
        template: incident_post_mortem

  data_breach:
    severity: P0
    response_time: immediate

    steps:
      - action: Enable maintenance mode
        command: |
          aws elbv2 modify-rule --rule-arn :rule_arn --actions Type=fixed-response,FixedResponseConfig={StatusCode=503}

      - action: Snapshot all databases
        command: |
          aws rds create-db-snapshot --db-instance-identifier :instance --db-snapshot-identifier breach-:timestamp

      - action: Rotate all secrets
        targets:
          - database_credentials
          - api_keys
          - jwt_secrets
          - oauth_secrets

      - action: Notify users (GDPR compliance)
        deadline: 72_hours
        template: data_breach_notification

      - action: Engage legal counsel
        immediate: true

      - action: Preserve evidence
        actions:
          - Disable log rotation
          - Export CloudTrail logs
          - Snapshot EBS volumes

  ddos_attack:
    severity: P2
    response_time: 30_minutes

    steps:
      - action: Enable AWS Shield Advanced
        if: traffic_spike > 10x

      - action: Activate WAF emergency rules
        rules:
          - block_by_geo
          - challenge_all_requests

      - action: Scale infrastructure
        targets:
          - api_servers: +200%
          - database_read_replicas: +2

      - action: Notify CDN provider
        provider: cloudfront
        request: emergency_caching
```

---

## 6. Security Testing

### 6.1 Automated Security Tests

```javascript
// test/security/api-security.test.js
const request = require('supertest');
const app = require('../app');

describe('API Security Tests', () => {
  describe('SQL Injection Protection', () => {
    it('should reject SQL injection in plugin name', async () => {
      const maliciousInput = "'; DROP TABLE plugins; --";

      const response = await request(app)
        .get(`/api/v1/plugins/${encodeURIComponent(maliciousInput)}`);

      expect(response.status).toBe(404);

      // Verify table still exists
      const plugins = await db.query('SELECT COUNT(*) FROM plugins');
      expect(plugins.rows[0].count).toBeGreaterThan(0);
    });
  });

  describe('XSS Protection', () => {
    it('should sanitize plugin description', async () => {
      const xssPayload = '<script>alert("XSS")</script>';

      const response = await request(app)
        .post('/api/v1/plugins')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'test-plugin',
          description: xssPayload
        });

      expect(response.body.description).not.toContain('<script>');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const promises = Array(150).fill().map(() =>
        request(app).get('/api/v1/plugins')
      );

      const responses = await Promise.all(promises);
      const tooManyRequests = responses.filter(r => r.status === 429);

      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Authentication', () => {
    it('should reject invalid JWT', async () => {
      const response = await request(app)
        .post('/api/v1/plugins')
        .set('Authorization', 'Bearer invalid_token')
        .send({ name: 'test' });

      expect(response.status).toBe(401);
    });

    it('should reject expired JWT', async () => {
      const expiredToken = jwt.sign(
        { user_id: 'test' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .post('/api/v1/plugins')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ name: 'test' });

      expect(response.status).toBe(401);
    });
  });
});
```

---

## Security Checklist

- [x] Malware scanning (ClamAV, npm audit, semgrep)
- [x] Automated vulnerability detection
- [x] Rate limiting (Redis-backed)
- [x] DDoS protection (AWS Shield, WAF)
- [x] OAuth 2.0 authentication
- [x] API key management with rotation
- [x] Multi-factor authentication (TOTP)
- [x] Input validation (Joi schemas)
- [x] SQL injection prevention (parameterized queries)
- [x] XSS protection (output encoding)
- [x] Encryption at rest (AES-256-GCM)
- [x] Encryption in transit (TLS 1.3)
- [x] Audit logging (CloudWatch, database)
- [x] Incident response playbook
- [x] Security testing suite
- [x] GDPR compliance (data export, erasure)
- [x] Abuse reporting system
- [x] Automated security updates (Dependabot)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-22
**Owner:** Security Team
**Classification:** INTERNAL
