# Allow2Automate Plugin Review System - Implementation Plan

## Executive Summary

This document provides a detailed implementation plan for the Allow2Automate plugin review and approval system, based on research of major software ecosystems.

**Recommended Approach**: Tiered Hybrid Model (Automated Security Gateway + Manual Review Tiers)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Plugin Submission Flow                       │
└─────────────────────────────────────────────────────────────────┘

Developer Submits Plugin
         │
         ▼
┌─────────────────────┐
│  Package Validation │  ←─ Structure, manifest, metadata
│   (Automated - 1m)  │
└──────────┬──────────┘
           │
           ▼
      [Pass/Fail]
           │
    ┌──────┴──────┐
    │ FAIL        │ PASS
    ▼             ▼
  Reject    ┌─────────────────────┐
  Notify    │  Security Scanning  │  ←─ Malware, vulnerabilities, patterns
  Developer │  (Automated - 5m)   │
            └──────────┬──────────┘
                       │
                       ▼
                  [Pass/Fail]
                       │
                ┌──────┴──────┐
                │ FAIL        │ PASS
                ▼             ▼
              Reject    ┌────────────────────┐
              Notify    │ Permission Analysis│  ←─ Risk assessment
              Developer │ (Automated - 2m)   │
                        └──────────┬─────────┘
                                   │
                                   ▼
                            [Risk Level]
                                   │
            ┌──────────────────────┼──────────────────────┐
            ▼                      ▼                      ▼
    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
    │  LOW RISK    │      │ MEDIUM RISK  │      │  HIGH RISK   │
    │              │      │              │      │              │
    │ Auto-Approve │      │ Manual Review│      │ Full Review  │
    │  (instant)   │      │   (3-5 days) │      │  (5-7 days)  │
    └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
           │                     │                     │
           │                     ▼                     ▼
           │              Code Review          Security Review
           │              Functionality        + Code Review
           │              Testing              + Functionality
           │                     │             + Privacy Review
           │                     │                     │
           └─────────────────────┴─────────────────────┘
                                 │
                                 ▼
                          ┌─────────────┐
                          │  Published  │
                          │             │
                          │ + Continuous│
                          │   Monitoring│
                          └─────────────┘
```

---

## Phase 1: Automated Security Gateway (MVP)

### 1.1 Package Validation Service

**Responsibility**: Validate plugin package structure and metadata

**Implementation**:
```javascript
// File: /service/plugin-review/validators/package-validator.js

class PackageValidator {
  async validate(pluginPath) {
    const results = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check required files
    const requiredFiles = ['package.json', 'README.md', 'LICENSE'];
    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join(pluginPath, file))) {
        results.errors.push(`Missing required file: ${file}`);
        results.valid = false;
      }
    }

    // Validate package.json
    const packageJson = await this.loadPackageJson(pluginPath);
    if (!packageJson) {
      results.errors.push('Invalid or missing package.json');
      results.valid = false;
      return results;
    }

    // Validate naming convention
    if (!packageJson.name.startsWith('allow2automate-')) {
      results.errors.push('Plugin name must start with "allow2automate-"');
      results.valid = false;
    }

    // Validate required fields
    const requiredFields = [
      'name', 'version', 'description', 'main',
      'author', 'license', 'keywords', 'allow2automate'
    ];

    for (const field of requiredFields) {
      if (!packageJson[field]) {
        results.errors.push(`Missing required field: ${field}`);
        results.valid = false;
      }
    }

    // Validate allow2automate manifest
    if (!packageJson.allow2automate) {
      results.errors.push('Missing allow2automate manifest');
      results.valid = false;
    } else {
      const manifestValidation = this.validateManifest(packageJson.allow2automate);
      results.errors.push(...manifestValidation.errors);
      results.warnings.push(...manifestValidation.warnings);
      results.valid = results.valid && manifestValidation.valid;
    }

    return results;
  }

  validateManifest(manifest) {
    const results = { valid: true, errors: [], warnings: [] };

    // Required manifest fields
    if (!manifest.permissions || !Array.isArray(manifest.permissions)) {
      results.errors.push('Manifest must declare permissions array');
      results.valid = false;
    }

    if (!manifest.deviceTypes || manifest.deviceTypes.length === 0) {
      results.warnings.push('No device types declared');
    }

    // Validate description length
    if (manifest.description && manifest.description.length < 50) {
      results.warnings.push('Description should be at least 50 characters');
    }

    return results;
  }
}

module.exports = PackageValidator;
```

**Schema for allow2automate manifest**:
```json
{
  "allow2automate": {
    "version": "1.0",
    "permissions": [
      "control:devices",
      "network:api.example.com",
      "storage:local"
    ],
    "deviceTypes": ["router", "wifi"],
    "description": "Detailed description of what the plugin does",
    "privacyPolicyUrl": "https://example.com/privacy",
    "supportUrl": "https://example.com/support",
    "configSchema": {
      "type": "object",
      "properties": {
        "apiKey": {
          "type": "string",
          "description": "API key for service"
        }
      }
    }
  }
}
```

### 1.2 Security Scanning Service

**Responsibility**: Detect malware, vulnerabilities, and dangerous patterns

**Implementation**:
```javascript
// File: /service/plugin-review/scanners/security-scanner.js

const { ESLint } = require('eslint');
const { exec } = require('child_process');
const axios = require('axios');

class SecurityScanner {
  constructor(config) {
    this.virusTotalApiKey = config.virusTotalApiKey;
    this.eslint = new ESLint({
      baseConfig: {
        extends: [
          'eslint:recommended',
          'plugin:security/recommended',
          'plugin:node/recommended'
        ],
        plugins: ['security', 'node', 'no-unsanitized']
      }
    });
  }

  async scan(pluginPath) {
    const results = {
      passed: true,
      malware: null,
      vulnerabilities: [],
      codeQuality: [],
      dangerousPatterns: []
    };

    // 1. Malware scanning via VirusTotal
    results.malware = await this.scanMalware(pluginPath);
    if (results.malware.detected) {
      results.passed = false;
    }

    // 2. Dependency vulnerability scanning
    results.vulnerabilities = await this.scanDependencies(pluginPath);
    const criticalVulns = results.vulnerabilities.filter(v =>
      v.severity === 'critical' || v.severity === 'high'
    );
    if (criticalVulns.length > 0) {
      results.passed = false;
    }

    // 3. Code quality and security patterns
    results.codeQuality = await this.scanCodeQuality(pluginPath);
    const criticalIssues = results.codeQuality.filter(i =>
      i.severity === 2 // ESLint error level
    );
    if (criticalIssues.length > 0) {
      results.passed = false;
    }

    // 4. Dangerous pattern detection
    results.dangerousPatterns = await this.detectDangerousPatterns(pluginPath);
    if (results.dangerousPatterns.length > 0) {
      results.passed = false;
    }

    return results;
  }

  async scanMalware(pluginPath) {
    // Package directory as zip
    const zipPath = await this.createZip(pluginPath);

    // Upload to VirusTotal
    const uploadResponse = await axios.post(
      'https://www.virustotal.com/api/v3/files',
      fs.createReadStream(zipPath),
      {
        headers: {
          'x-apikey': this.virusTotalApiKey
        }
      }
    );

    const analysisId = uploadResponse.data.data.id;

    // Wait for analysis (may take 1-2 minutes)
    await this.sleep(60000);

    // Get results
    const resultResponse = await axios.get(
      `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
      {
        headers: {
          'x-apikey': this.virusTotalApiKey
        }
      }
    );

    const stats = resultResponse.data.data.attributes.stats;

    return {
      detected: stats.malicious > 0,
      engines: stats.malicious,
      total: Object.values(stats).reduce((a, b) => a + b, 0),
      details: resultResponse.data.data.attributes.results
    };
  }

  async scanDependencies(pluginPath) {
    return new Promise((resolve, reject) => {
      exec('npm audit --json', { cwd: pluginPath }, (error, stdout, stderr) => {
        if (stderr) {
          // npm audit returns non-zero exit code when vulnerabilities found
          // This is expected, so we don't reject
        }

        try {
          const auditResult = JSON.parse(stdout);
          const vulnerabilities = [];

          // Parse npm audit output
          if (auditResult.vulnerabilities) {
            for (const [name, vuln] of Object.entries(auditResult.vulnerabilities)) {
              vulnerabilities.push({
                package: name,
                severity: vuln.severity,
                title: vuln.via[0]?.title || 'Unknown',
                range: vuln.range,
                fixAvailable: vuln.fixAvailable
              });
            }
          }

          resolve(vulnerabilities);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async scanCodeQuality(pluginPath) {
    const results = await this.eslint.lintFiles([`${pluginPath}/**/*.js`]);

    const issues = [];
    for (const result of results) {
      for (const message of result.messages) {
        issues.push({
          file: result.filePath.replace(pluginPath, ''),
          line: message.line,
          column: message.column,
          severity: message.severity,
          message: message.message,
          rule: message.ruleId
        });
      }
    }

    return issues;
  }

  async detectDangerousPatterns(pluginPath) {
    const dangerous = [];

    // Read all JavaScript files
    const jsFiles = await this.findFiles(pluginPath, '.js');

    const dangerousPatterns = [
      {
        pattern: /\beval\s*\(/g,
        description: 'Use of eval() - remote code execution risk',
        severity: 'critical'
      },
      {
        pattern: /new\s+Function\s*\(/g,
        description: 'Use of Function constructor - code injection risk',
        severity: 'critical'
      },
      {
        pattern: /child_process|spawn|exec/g,
        description: 'Child process execution - requires manual review',
        severity: 'high'
      },
      {
        pattern: /crypto.*mine|bitcoin|monero/gi,
        description: 'Cryptocurrency mining indicators',
        severity: 'critical'
      },
      {
        pattern: /atob|btoa.*eval/g,
        description: 'Base64 encoding with eval - obfuscation',
        severity: 'high'
      },
      {
        pattern: /\.ssh\/id_rsa|private.*key/gi,
        description: 'SSH private key access',
        severity: 'critical'
      }
    ];

    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8');

      for (const { pattern, description, severity } of dangerousPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          dangerous.push({
            file: file.replace(pluginPath, ''),
            pattern: pattern.toString(),
            description,
            severity,
            occurrences: matches.length
          });
        }
      }
    }

    return dangerous;
  }
}

module.exports = SecurityScanner;
```

### 1.3 Permission Analysis Service

**Responsibility**: Analyze requested permissions and assess risk level

**Implementation**:
```javascript
// File: /service/plugin-review/analyzers/permission-analyzer.js

class PermissionAnalyzer {
  constructor() {
    this.permissionRiskLevels = {
      'storage:local': 'low',
      'storage:encrypted': 'low',
      'network:specific': 'medium',
      'network:*': 'high',
      'control:devices': 'high',
      'data:user': 'medium',
      'data:children': 'high',
      'system:exec': 'critical',
      'ssh:*': 'critical'
    };
  }

  analyze(manifest, codeFiles) {
    const results = {
      riskLevel: 'low',
      permissions: [],
      issues: [],
      requiresManualReview: false
    };

    // Check each declared permission
    for (const permission of manifest.permissions || []) {
      const permissionAnalysis = this.analyzePermission(permission, codeFiles);
      results.permissions.push(permissionAnalysis);

      // Escalate risk level
      if (this.compareRisk(permissionAnalysis.risk, results.riskLevel) > 0) {
        results.riskLevel = permissionAnalysis.risk;
      }

      // Check if actually used in code
      if (!permissionAnalysis.usedInCode) {
        results.issues.push({
          severity: 'warning',
          permission,
          message: 'Permission declared but not used in code'
        });
      }
    }

    // Check for undeclared permissions
    const undeclared = this.findUndeclaredPermissions(manifest, codeFiles);
    for (const permission of undeclared) {
      results.issues.push({
        severity: 'error',
        permission,
        message: 'Permission used in code but not declared in manifest'
      });
      results.requiresManualReview = true;
    }

    // Determine if manual review required
    if (results.riskLevel === 'high' || results.riskLevel === 'critical') {
      results.requiresManualReview = true;
    }

    return results;
  }

  analyzePermission(permission, codeFiles) {
    const [category, scope] = permission.split(':');

    const risk = this.permissionRiskLevels[permission] ||
                 this.permissionRiskLevels[`${category}:*`] ||
                 'medium';

    // Check if permission is actually used in code
    const usedInCode = this.isPermissionUsed(permission, codeFiles);

    return {
      permission,
      category,
      scope,
      risk,
      usedInCode,
      justificationRequired: risk === 'high' || risk === 'critical'
    };
  }

  isPermissionUsed(permission, codeFiles) {
    const [category, scope] = permission.split(':');

    // Define API patterns that indicate permission usage
    const usagePatterns = {
      'network': /fetch\(|axios\.|https?\.request/g,
      'control': /device\.control|executeAction/g,
      'storage': /localStorage|sessionStorage|allow2\.storage/g,
      'data': /allow2\.user|allow2\.children/g,
      'system': /exec\(|spawn\(|child_process/g,
      'ssh': /ssh2|node-ssh|ssh\.connect/g
    };

    const pattern = usagePatterns[category];
    if (!pattern) return false;

    // Search through code files
    for (const file of codeFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  }

  findUndeclaredPermissions(manifest, codeFiles) {
    const declared = new Set(manifest.permissions || []);
    const undeclared = new Set();

    // Check for common API usage without declaration
    const apiChecks = [
      {
        pattern: /fetch\(|axios\./g,
        permission: 'network:*'
      },
      {
        pattern: /localStorage|sessionStorage/g,
        permission: 'storage:local'
      },
      {
        pattern: /device\.control/g,
        permission: 'control:devices'
      },
      {
        pattern: /exec\(|spawn\(/g,
        permission: 'system:exec'
      }
    ];

    for (const file of codeFiles) {
      const content = fs.readFileSync(file, 'utf8');

      for (const check of apiChecks) {
        if (check.pattern.test(content)) {
          // Check if any permission covers this
          const covered = Array.from(declared).some(perm =>
            perm.startsWith(check.permission.split(':')[0])
          );

          if (!covered) {
            undeclared.add(check.permission);
          }
        }
      }
    }

    return Array.from(undeclared);
  }

  compareRisk(risk1, risk2) {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[risk1] - levels[risk2];
  }
}

module.exports = PermissionAnalyzer;
```

### 1.4 Review Orchestrator

**Responsibility**: Coordinate all validation and scanning steps

**Implementation**:
```javascript
// File: /service/plugin-review/review-orchestrator.js

const PackageValidator = require('./validators/package-validator');
const SecurityScanner = require('./scanners/security-scanner');
const PermissionAnalyzer = require('./analyzers/permission-analyzer');

class ReviewOrchestrator {
  constructor(config) {
    this.packageValidator = new PackageValidator();
    this.securityScanner = new SecurityScanner(config);
    this.permissionAnalyzer = new PermissionAnalyzer();
  }

  async reviewPlugin(pluginPath, metadata) {
    const review = {
      pluginName: metadata.name,
      version: metadata.version,
      timestamp: new Date().toISOString(),
      status: 'pending',
      steps: {}
    };

    try {
      // Step 1: Package Validation
      console.log('Step 1: Validating package structure...');
      review.steps.packageValidation = await this.packageValidator.validate(pluginPath);

      if (!review.steps.packageValidation.valid) {
        review.status = 'rejected';
        review.reason = 'Package validation failed';
        return review;
      }

      // Step 2: Security Scanning
      console.log('Step 2: Running security scans...');
      review.steps.securityScan = await this.securityScanner.scan(pluginPath);

      if (!review.steps.securityScan.passed) {
        review.status = 'rejected';
        review.reason = 'Security scan failed';
        return review;
      }

      // Step 3: Permission Analysis
      console.log('Step 3: Analyzing permissions...');
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(pluginPath, 'package.json'), 'utf8')
      );
      const codeFiles = await this.findCodeFiles(pluginPath);

      review.steps.permissionAnalysis = this.permissionAnalyzer.analyze(
        packageJson.allow2automate,
        codeFiles
      );

      // Determine final status
      if (review.steps.permissionAnalysis.requiresManualReview) {
        review.status = 'pending_manual_review';
        review.reason = 'High-risk permissions require manual review';
        review.priority = review.steps.permissionAnalysis.riskLevel;
      } else {
        review.status = 'approved';
        review.reason = 'All automated checks passed';
      }

      return review;

    } catch (error) {
      review.status = 'error';
      review.error = error.message;
      return review;
    }
  }

  async findCodeFiles(pluginPath) {
    const files = [];

    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git') {
            walk(fullPath);
          }
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
    };

    walk(pluginPath);
    return files;
  }
}

module.exports = ReviewOrchestrator;
```

---

## Phase 2: Manual Review Process

### 2.1 Review Queue Dashboard

**UI Components**:
```javascript
// File: /app/components/ReviewQueue.js

import React, { useState, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Button, Dialog, DialogTitle, DialogContent
} from '@material-ui/core';

export default function ReviewQueue() {
  const [queue, setQueue] = useState([]);
  const [selectedPlugin, setSelectedPlugin] = useState(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    const response = await fetch('/api/review-queue');
    const data = await response.json();
    setQueue(data.queue);
  };

  const getRiskColor = (risk) => {
    const colors = {
      low: 'default',
      medium: 'primary',
      high: 'secondary',
      critical: 'error'
    };
    return colors[risk] || 'default';
  };

  const startReview = (plugin) => {
    setSelectedPlugin(plugin);
  };

  return (
    <div>
      <h2>Plugin Review Queue</h2>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Plugin</TableCell>
            <TableCell>Version</TableCell>
            <TableCell>Submitted</TableCell>
            <TableCell>Risk Level</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {queue.map(plugin => (
            <TableRow key={plugin.id}>
              <TableCell>{plugin.name}</TableCell>
              <TableCell>{plugin.version}</TableCell>
              <TableCell>{new Date(plugin.submittedAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <Chip
                  label={plugin.riskLevel.toUpperCase()}
                  color={getRiskColor(plugin.riskLevel)}
                  size="small"
                />
              </TableCell>
              <TableCell>{plugin.status}</TableCell>
              <TableCell>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => startReview(plugin)}
                >
                  Review
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedPlugin && (
        <ReviewDialog
          plugin={selectedPlugin}
          onClose={() => setSelectedPlugin(null)}
          onComplete={fetchQueue}
        />
      )}
    </div>
  );
}
```

### 2.2 Review Checklist Interface

```javascript
// File: /app/components/ReviewDialog.js

import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Checkbox, FormControlLabel, Button, TextField,
  Typography, Divider, Tabs, Tab
} from '@material-ui/core';

export default function ReviewDialog({ plugin, onClose, onComplete }) {
  const [activeTab, setActiveTab] = useState(0);
  const [checklist, setChecklist] = useState({
    codeReview: {
      noObfuscatedCode: false,
      properErrorHandling: false,
      inputValidation: false,
      outputEncoding: false,
      secureAuth: false,
      noHardcodedSecrets: false
    },
    securityReview: {
      httpsOnly: false,
      dataEncryption: false,
      secureStorage: false,
      noSqlInjection: false,
      noXss: false,
      csrfProtection: false
    },
    privacyReview: {
      privacyPolicyPresent: false,
      dataCollectionDocumented: false,
      userConsentMechanisms: false,
      dataRetentionPolicies: false,
      gdprCompliant: false
    },
    functionalityReview: {
      matchesDescription: false,
      noCrashes: false,
      reasonablePerformance: false,
      properInstallUninstall: false
    }
  });
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState(null);

  const handleCheckboxChange = (category, item) => {
    setChecklist({
      ...checklist,
      [category]: {
        ...checklist[category],
        [item]: !checklist[category][item]
      }
    });
  };

  const isAllChecked = () => {
    return Object.values(checklist).every(category =>
      Object.values(category).every(checked => checked)
    );
  };

  const submitReview = async (approved) => {
    const reviewData = {
      pluginId: plugin.id,
      approved,
      checklist,
      notes,
      reviewedBy: 'current-user-id', // Get from auth context
      reviewedAt: new Date().toISOString()
    };

    await fetch('/api/plugin-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewData)
    });

    onComplete();
    onClose();
  };

  return (
    <Dialog open={true} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Review: {plugin.name} v{plugin.version}
      </DialogTitle>

      <DialogContent>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label="Code Review" />
          <Tab label="Security" />
          <Tab label="Privacy" />
          <Tab label="Functionality" />
          <Tab label="Automated Results" />
        </Tabs>

        {activeTab === 0 && (
          <div style={{ marginTop: 20 }}>
            <Typography variant="h6">Code Review Checklist</Typography>
            {Object.entries(checklist.codeReview).map(([key, checked]) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    checked={checked}
                    onChange={() => handleCheckboxChange('codeReview', key)}
                  />
                }
                label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              />
            ))}
          </div>
        )}

        {activeTab === 1 && (
          <div style={{ marginTop: 20 }}>
            <Typography variant="h6">Security Review Checklist</Typography>
            {Object.entries(checklist.securityReview).map(([key, checked]) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    checked={checked}
                    onChange={() => handleCheckboxChange('securityReview', key)}
                  />
                }
                label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              />
            ))}
          </div>
        )}

        {activeTab === 2 && (
          <div style={{ marginTop: 20 }}>
            <Typography variant="h6">Privacy Review Checklist</Typography>
            {Object.entries(checklist.privacyReview).map(([key, checked]) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    checked={checked}
                    onChange={() => handleCheckboxChange('privacyReview', key)}
                  />
                }
                label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              />
            ))}
          </div>
        )}

        {activeTab === 3 && (
          <div style={{ marginTop: 20 }}>
            <Typography variant="h6">Functionality Review Checklist</Typography>
            {Object.entries(checklist.functionalityReview).map(([key, checked]) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    checked={checked}
                    onChange={() => handleCheckboxChange('functionalityReview', key)}
                  />
                }
                label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              />
            ))}
          </div>
        )}

        {activeTab === 4 && (
          <div style={{ marginTop: 20 }}>
            <Typography variant="h6">Automated Scan Results</Typography>
            <pre style={{ background: '#f5f5f5', padding: 10, borderRadius: 4, overflow: 'auto' }}>
              {JSON.stringify(plugin.automatedResults, null, 2)}
            </pre>
          </div>
        )}

        <Divider style={{ margin: '20px 0' }} />

        <TextField
          fullWidth
          multiline
          rows={4}
          label="Review Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any additional notes or concerns..."
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => submitReview(false)}
          color="secondary"
        >
          Reject
        </Button>
        <Button
          onClick={() => submitReview(true)}
          color="primary"
          disabled={!isAllChecked()}
        >
          Approve
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

---

## Phase 3: Continuous Monitoring

### 3.1 Scheduled Re-Scanning

```javascript
// File: /service/plugin-review/continuous-monitor.js

const cron = require('node-cron');
const SecurityScanner = require('./scanners/security-scanner');

class ContinuousMonitor {
  constructor(config) {
    this.scanner = new SecurityScanner(config);
    this.db = config.database;
  }

  start() {
    // Run daily scans at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Starting daily plugin re-scan...');
      await this.scanAllPublishedPlugins();
    });

    // Check for dependency updates every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('Checking for new CVEs in plugin dependencies...');
      await this.checkDependencyUpdates();
    });
  }

  async scanAllPublishedPlugins() {
    const plugins = await this.db.query(`
      SELECT id, name, version, path
      FROM plugins
      WHERE status = 'published'
    `);

    for (const plugin of plugins) {
      try {
        const scanResult = await this.scanner.scan(plugin.path);

        if (!scanResult.passed) {
          await this.handleSecurityIssue(plugin, scanResult);
        }
      } catch (error) {
        console.error(`Error scanning plugin ${plugin.name}:`, error);
      }
    }
  }

  async checkDependencyUpdates() {
    const plugins = await this.db.query(`
      SELECT id, name, version, path
      FROM plugins
      WHERE status = 'published'
    `);

    for (const plugin of plugins) {
      const vulns = await this.scanner.scanDependencies(plugin.path);
      const newCritical = vulns.filter(v =>
        v.severity === 'critical' &&
        this.isNewVulnerability(plugin.id, v)
      );

      if (newCritical.length > 0) {
        await this.handleNewVulnerabilities(plugin, newCritical);
      }
    }
  }

  async handleSecurityIssue(plugin, scanResult) {
    // Determine severity
    const severity = this.calculateSeverity(scanResult);

    // Create incident
    const incident = await this.db.query(`
      INSERT INTO security_incidents
      (plugin_id, severity, scan_result, detected_at, status)
      VALUES ($1, $2, $3, NOW(), 'open')
      RETURNING id
    `, [plugin.id, severity, JSON.stringify(scanResult)]);

    // Take action based on severity
    if (severity === 'critical') {
      await this.suspendPlugin(plugin);
      await this.notifyUsers(plugin, incident.id);
    } else if (severity === 'high') {
      await this.flagPlugin(plugin);
      await this.notifyDeveloper(plugin, incident.id, '24 hours');
    } else {
      await this.notifyDeveloper(plugin, incident.id, '7 days');
    }
  }

  calculateSeverity(scanResult) {
    if (scanResult.malware?.detected) return 'critical';

    const criticalVulns = scanResult.vulnerabilities?.filter(v =>
      v.severity === 'critical'
    ).length || 0;

    if (criticalVulns > 0) return 'critical';

    const dangerousPatterns = scanResult.dangerousPatterns?.filter(p =>
      p.severity === 'critical'
    ).length || 0;

    if (dangerousPatterns > 0) return 'high';

    return 'medium';
  }

  async suspendPlugin(plugin) {
    await this.db.query(`
      UPDATE plugins
      SET status = 'suspended', suspended_at = NOW()
      WHERE id = $1
    `, [plugin.id]);

    // Trigger force-disable on client apps
    await this.broadcastPluginDisable(plugin.id);
  }
}

module.exports = ContinuousMonitor;
```

---

## Database Schema

```sql
-- File: /service/migrations/001_plugin_review_system.sql

-- Plugins table
CREATE TABLE plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  author_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending, pending_manual_review, approved, published, rejected, suspended

  risk_level VARCHAR(20), -- low, medium, high, critical
  trust_tier VARCHAR(20), -- community, verified, official

  manifest JSONB NOT NULL,
  path TEXT NOT NULL,

  submitted_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by UUID,
  published_at TIMESTAMP,
  suspended_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Plugin reviews table
CREATE TABLE plugin_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id),
  version VARCHAR(50) NOT NULL,

  automated_results JSONB,
  manual_checklist JSONB,
  reviewer_notes TEXT,

  approved BOOLEAN NOT NULL,
  reviewed_by UUID NOT NULL,
  reviewed_at TIMESTAMP DEFAULT NOW(),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Security incidents table
CREATE TABLE security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id),

  severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
  category VARCHAR(50), -- malware, vulnerability, pattern, behavior

  scan_result JSONB,
  description TEXT,

  detected_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open, acknowledged, resolved, false_positive

  notified_developer BOOLEAN DEFAULT FALSE,
  notified_users BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Plugin statistics table
CREATE TABLE plugin_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id),

  downloads_total INT DEFAULT 0,
  downloads_last_30_days INT DEFAULT 0,
  active_installations INT DEFAULT 0,

  rating_average DECIMAL(3,2),
  rating_count INT DEFAULT 0,

  last_updated TIMESTAMP DEFAULT NOW()
);

-- Developer reputation table
CREATE TABLE developer_reputation (
  user_id UUID PRIMARY KEY,

  plugins_published INT DEFAULT 0,
  plugins_suspended INT DEFAULT 0,

  tier VARCHAR(20) DEFAULT 'unverified', -- unverified, verified, trusted, partner
  verified_at TIMESTAMP,

  total_downloads INT DEFAULT 0,
  average_rating DECIMAL(3,2),

  security_violations INT DEFAULT 0,
  policy_violations INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_plugins_status ON plugins(status);
CREATE INDEX idx_plugins_author ON plugins(author_id);
CREATE INDEX idx_plugin_reviews_plugin ON plugin_reviews(plugin_id);
CREATE INDEX idx_security_incidents_plugin ON security_incidents(plugin_id);
CREATE INDEX idx_security_incidents_severity ON security_incidents(severity, status);
```

---

## API Endpoints

```javascript
// File: /service/routes/plugin-review-routes.js

const express = require('express');
const router = express.Router();
const ReviewOrchestrator = require('../plugin-review/review-orchestrator');

// Submit plugin for review
router.post('/api/plugins/submit', async (req, res) => {
  try {
    const { pluginPath, metadata } = req.body;

    const orchestrator = new ReviewOrchestrator(config);
    const review = await orchestrator.reviewPlugin(pluginPath, metadata);

    // Save review to database
    await db.query(`
      INSERT INTO plugins (name, version, author_id, status, risk_level, manifest, path)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      metadata.name,
      metadata.version,
      req.user.id,
      review.status,
      review.steps.permissionAnalysis?.riskLevel || 'low',
      JSON.stringify(metadata.manifest),
      pluginPath
    ]);

    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get review queue (for reviewers)
router.get('/api/review-queue', async (req, res) => {
  const queue = await db.query(`
    SELECT p.*, dr.tier as developer_tier
    FROM plugins p
    LEFT JOIN developer_reputation dr ON p.author_id = dr.user_id
    WHERE p.status = 'pending_manual_review'
    ORDER BY
      CASE p.risk_level
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      p.submitted_at ASC
  `);

  res.json({ queue: queue.rows });
});

// Submit review decision
router.post('/api/plugin-reviews', async (req, res) => {
  const { pluginId, approved, checklist, notes } = req.body;

  await db.query(`
    INSERT INTO plugin_reviews
    (plugin_id, approved, manual_checklist, reviewer_notes, reviewed_by)
    VALUES ($1, $2, $3, $4, $5)
  `, [pluginId, approved, JSON.stringify(checklist), notes, req.user.id]);

  const newStatus = approved ? 'approved' : 'rejected';
  await db.query(`
    UPDATE plugins
    SET status = $1, reviewed_at = NOW(), reviewed_by = $2
    WHERE id = $3
  `, [newStatus, req.user.id, pluginId]);

  // If approved, publish the plugin
  if (approved) {
    await db.query(`
      UPDATE plugins
      SET status = 'published', published_at = NOW()
      WHERE id = $1
    `, [pluginId]);
  }

  res.json({ success: true });
});

// Report security issue
router.post('/api/plugins/:id/report', async (req, res) => {
  const { description, category } = req.body;

  await db.query(`
    INSERT INTO security_incidents
    (plugin_id, severity, category, description)
    VALUES ($1, 'medium', $2, $3)
  `, [req.params.id, category, description]);

  res.json({ success: true });
});

module.exports = router;
```

---

## Next Steps

1. **Implement Phase 1 (Months 1-3)**
   - Set up automated validation and scanning infrastructure
   - Create review queue UI
   - Hire/designate first reviewer
   - Beta test with trusted developers

2. **Scale to Phase 2 (Months 4-6)**
   - Add trust tiers and badges
   - Implement continuous monitoring
   - Build user reporting system
   - Launch public marketplace

3. **Advance to Phase 3 (Months 7-12)**
   - Add sandbox testing
   - Launch developer program
   - Implement enterprise features
   - Scale review team as needed

This implementation provides a comprehensive, security-focused plugin review system tailored for Allow2Automate's unique requirements as a parental control platform.
