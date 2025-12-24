# Git-Based Plugin Discovery & Installation System Architecture

## Executive Summary

This document outlines a decentralized plugin architecture where:
- **NO third-party code is hosted by Allow2**
- Plugins are installed directly from GitHub/Bitbucket repositories
- A curated metadata registry provides discovery without code storage
- Trust indicators guide users toward safe plugins
- Versioning via Git tags enables controlled updates

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Allow2Automate Application                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │   Plugin Store   │  │  Plugin Manager  │  │ Update Checker│ │
│  │   (Discovery UI) │  │  (Installation)  │  │  (Notifier)   │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘ │
│           │                     │                     │          │
│           └─────────────────────┼─────────────────────┘          │
│                                 │                                │
└─────────────────────────────────┼────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
          ┌─────────▼─────────┐       ┌────────▼──────────┐
          │  Registry API      │       │  Git Providers    │
          │  (Metadata Only)   │       │  (GitHub/Bitbucket)│
          └─────────┬──────────┘       └───────────────────┘
                    │
          ┌─────────▼──────────┐
          │  Registry Database │
          │  (PostgreSQL)      │
          └────────────────────┘
```

### Key Components

1. **Plugin Store (UI)** - Discovery interface with search, filtering, and plugin details
2. **Plugin Manager** - Installation, update, removal using electron-plugin-manager
3. **Update Checker** - Monitors Git repos for new tags/versions
4. **Registry API** - RESTful API serving metadata only
5. **Registry Database** - PostgreSQL storing plugin metadata, stats, and trust scores
6. **Git Providers** - External repositories hosting actual plugin code

---

## 2. Namespace-Based Registry Structure

### 2.1 Directory Organization

The registry uses a namespace-based folder structure to organize plugins by publisher:

```
registry/
├── plugins.json              # Master registry index (all plugins)
├── schema.json              # JSON Schema validation
├── README.md                # Registry documentation
└── plugins/                 # Namespace folders
    ├── @allow2/            # Official Allow2 namespace
    │   ├── allow2automate-wemo.json
    │   ├── allow2automate-ssh.json
    │   ├── allow2automate-battle.net.json
    │   └── allow2automate-playstation.json
    ├── @mcafee/            # McAfee namespace (example)
    │   └── allow2automate-safefamily.json
    ├── @community/         # Community-contributed plugins
    │   └── plugin-name.json
    └── @publisher/         # Any third-party publisher
        └── their-plugin.json
```

### 2.2 Plugin File Structure

Each plugin has its own JSON file containing complete metadata:

```json
{
  "id": "allow2automate-wemo",
  "name": "@allow2/allow2automate-wemo",
  "shortName": "wemo",
  "version": "0.0.4",
  "description": "Control WeMo smart devices",
  "publisher": "allow2",
  "author": "Allow2",
  "category": "iot",
  "keywords": ["wemo", "smart-home"],
  "repository": {
    "type": "git",
    "url": "https://github.com/Allow2/allow2automate-wemo"
  },
  "installation": {
    "type": "git",
    "url": "git+https://github.com/Allow2/allow2automate-wemo.git",
    "install_url": "git+https://github.com/Allow2/allow2automate-wemo.git#v0.0.4"
  },
  "pluginFile": "@allow2/allow2automate-wemo.json"
}
```

### 2.3 Master Registry Index (plugins.json)

The master index consolidates all plugins for quick browsing:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-12-23T10:18:00Z",
  "plugins": [
    {
      "id": "allow2automate-wemo",
      "name": "@allow2/allow2automate-wemo",
      "namespace": "@allow2",
      "pluginFile": "@allow2/allow2automate-wemo.json",
      ...
    }
  ],
  "categories": { ... }
}
```

### 2.4 Database Schema (Optional Cloud Backend)

For enhanced features, an optional cloud database can track:

## 2.5 Core Tables

```sql
-- Plugin Registry (Metadata Only)
CREATE TABLE plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id VARCHAR(255) UNIQUE NOT NULL,  -- e.g., "allow2automate-playstation"
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),

    -- Author Information
    author_name VARCHAR(255),
    author_github VARCHAR(255),
    author_email VARCHAR(255),
    author_verified BOOLEAN DEFAULT false,

    -- Repository Information
    repo_type VARCHAR(20) NOT NULL,  -- 'github', 'bitbucket', 'gitlab'
    repo_url TEXT NOT NULL,
    repo_default_branch VARCHAR(100) DEFAULT 'main',
    install_url TEXT NOT NULL,  -- git+https://github.com/...

    -- Status & Trust
    status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, verified, suspended
    trust_score DECIMAL(5,2) DEFAULT 0.0,  -- 0.0 - 100.0
    verification_level VARCHAR(20) DEFAULT 'unverified',  -- unverified, community, verified

    -- Metadata
    permissions_required JSONB,  -- ["network", "configuration", "filesystem"]
    tags JSONB,  -- ["gaming", "parental-control", "api"]
    screenshots JSONB,  -- [{"url": "...", "caption": "..."}]

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_sync_at TIMESTAMP,  -- Last time repo was checked
    approved_at TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_repo_type CHECK (repo_type IN ('github', 'bitbucket', 'gitlab')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'verified', 'suspended'))
);

CREATE INDEX idx_plugins_plugin_id ON plugins(plugin_id);
CREATE INDEX idx_plugins_category ON plugins(category);
CREATE INDEX idx_plugins_status ON plugins(status);
CREATE INDEX idx_plugins_trust_score ON plugins(trust_score DESC);

-- Plugin Versions (from Git tags)
CREATE TABLE plugin_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,  -- e.g., "2.0.0", "v1.5.2-beta"
    git_tag VARCHAR(100) NOT NULL,
    git_commit_sha VARCHAR(40),

    -- Version Metadata
    release_notes TEXT,
    breaking_changes BOOLEAN DEFAULT false,
    min_app_version VARCHAR(50),  -- Minimum Allow2Automate version required

    -- Security Analysis (automated)
    security_scan_status VARCHAR(20),  -- pending, passed, failed, skipped
    security_issues JSONB,  -- [{"severity": "high", "description": "..."}]

    -- Stats
    downloads_count INTEGER DEFAULT 0,

    -- Timestamps
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_plugin_version UNIQUE(plugin_id, version)
);

CREATE INDEX idx_versions_plugin_id ON plugin_versions(plugin_id);
CREATE INDEX idx_versions_version ON plugin_versions(version);

-- Latest Version Tracker (materialized view alternative)
CREATE TABLE plugin_latest_versions (
    plugin_id UUID PRIMARY KEY REFERENCES plugins(id) ON DELETE CASCADE,
    latest_version_id UUID REFERENCES plugin_versions(id),
    latest_stable_version_id UUID REFERENCES plugin_versions(id),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Trust Indicators (aggregated from Git providers)
CREATE TABLE plugin_trust_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE UNIQUE,

    -- GitHub/Git Statistics
    stars_count INTEGER DEFAULT 0,
    forks_count INTEGER DEFAULT 0,
    watchers_count INTEGER DEFAULT 0,
    open_issues_count INTEGER DEFAULT 0,
    contributors_count INTEGER DEFAULT 0,

    -- Repository Health
    last_commit_at TIMESTAMP,
    first_commit_at TIMESTAMP,
    commit_count INTEGER DEFAULT 0,
    repo_age_days INTEGER DEFAULT 0,
    update_frequency_days DECIMAL(10,2),  -- Average days between commits

    -- Community Metrics
    total_installs INTEGER DEFAULT 0,
    active_installs INTEGER DEFAULT 0,  -- Installs in last 30 days
    total_uninstalls INTEGER DEFAULT 0,
    retention_rate DECIMAL(5,2),  -- Percentage who keep it installed

    -- Reviews & Ratings
    average_rating DECIMAL(3,2),  -- 0.00 - 5.00
    total_reviews INTEGER DEFAULT 0,

    -- Security
    has_security_policy BOOLEAN DEFAULT false,
    has_code_of_conduct BOOLEAN DEFAULT false,
    has_license BOOLEAN DEFAULT false,
    license_type VARCHAR(100),

    -- Last Updated
    last_synced_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_rating CHECK (average_rating >= 0 AND average_rating <= 5)
);

CREATE INDEX idx_trust_plugin_id ON plugin_trust_indicators(plugin_id);

-- User Installations (tracking what users have installed)
CREATE TABLE user_plugin_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,  -- Foreign key to users table
    plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
    version_id UUID REFERENCES plugin_versions(id),

    -- Installation Details
    installed_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    uninstalled_at TIMESTAMP,

    -- Status
    status VARCHAR(20) DEFAULT 'active',  -- active, disabled, uninstalled
    auto_update BOOLEAN DEFAULT true,

    -- Usage Tracking
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0,

    CONSTRAINT unique_user_plugin UNIQUE(user_id, plugin_id)
);

CREATE INDEX idx_installations_user_id ON user_plugin_installations(user_id);
CREATE INDEX idx_installations_plugin_id ON user_plugin_installations(plugin_id);
CREATE INDEX idx_installations_status ON user_plugin_installations(status);

-- Plugin Reviews & Ratings
CREATE TABLE plugin_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    rating INTEGER NOT NULL,  -- 1-5 stars
    title VARCHAR(255),
    review_text TEXT,

    -- Helpfulness
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,

    -- Moderation
    status VARCHAR(20) DEFAULT 'published',  -- published, hidden, flagged

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_rating CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT unique_user_review UNIQUE(plugin_id, user_id)
);

CREATE INDEX idx_reviews_plugin_id ON plugin_reviews(plugin_id);
CREATE INDEX idx_reviews_user_id ON plugin_reviews(user_id);

-- Plugin Submission Requests
CREATE TABLE plugin_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Submitted Metadata
    submitted_data JSONB NOT NULL,  -- Full plugin metadata JSON

    -- Submitter
    submitter_name VARCHAR(255),
    submitter_email VARCHAR(255) NOT NULL,
    submitter_github VARCHAR(255),

    -- Review Status
    status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected
    reviewer_id UUID,  -- Foreign key to admin users
    review_notes TEXT,

    -- Linked Plugin (after approval)
    plugin_id UUID REFERENCES plugins(id),

    -- Timestamps
    submitted_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP,

    CONSTRAINT valid_submission_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX idx_submissions_status ON plugin_submissions(status);
CREATE INDEX idx_submissions_submitter_email ON plugin_submissions(submitter_email);

-- Update Notifications
CREATE TABLE update_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
    version_id UUID REFERENCES plugin_versions(id),

    -- Notification Details
    title VARCHAR(255),
    message TEXT,
    notification_type VARCHAR(50),  -- new_version, security_update, breaking_change
    severity VARCHAR(20),  -- info, important, critical

    -- Delivery
    sent_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,

    -- Targeting
    target_user_ids JSONB,  -- NULL = all users with plugin installed

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_plugin_id ON update_notifications(plugin_id);
CREATE INDEX idx_notifications_sent_at ON update_notifications(sent_at);

-- Security Scan Results
CREATE TABLE security_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
    version_id UUID REFERENCES plugin_versions(id),

    -- Scan Details
    scan_type VARCHAR(50),  -- package_json_scripts, dependency_audit, static_analysis
    status VARCHAR(20),  -- pending, in_progress, completed, failed

    -- Results
    risk_level VARCHAR(20),  -- none, low, medium, high, critical
    issues_found JSONB,  -- [{"type": "...", "severity": "...", "description": "..."}]

    -- Scanner Info
    scanner_version VARCHAR(50),
    scanned_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_risk_level CHECK (risk_level IN ('none', 'low', 'medium', 'high', 'critical'))
);

CREATE INDEX idx_scans_plugin_id ON security_scans(plugin_id);
CREATE INDEX idx_scans_version_id ON security_scans(version_id);
CREATE INDEX idx_scans_risk_level ON security_scans(risk_level);
```

### 2.2 Database Views

```sql
-- View: Plugin Search Results (optimized for discovery)
CREATE VIEW plugin_search_results AS
SELECT
    p.id,
    p.plugin_id,
    p.name,
    p.description,
    p.category,
    p.author_name,
    p.author_verified,
    p.repo_url,
    p.install_url,
    p.status,
    p.trust_score,
    p.verification_level,
    p.tags,
    plv.latest_version_id,
    pv.version AS latest_version,
    pti.stars_count,
    pti.forks_count,
    pti.last_commit_at,
    pti.repo_age_days,
    pti.total_installs,
    pti.active_installs,
    pti.average_rating,
    pti.total_reviews
FROM plugins p
LEFT JOIN plugin_latest_versions plv ON p.id = plv.plugin_id
LEFT JOIN plugin_versions pv ON plv.latest_version_id = pv.id
LEFT JOIN plugin_trust_indicators pti ON p.id = pti.plugin_id
WHERE p.status IN ('approved', 'verified');

-- View: User Plugin Library
CREATE VIEW user_plugin_library AS
SELECT
    upi.id AS installation_id,
    upi.user_id,
    upi.installed_at,
    upi.status AS installation_status,
    upi.auto_update,
    p.plugin_id,
    p.name,
    p.description,
    p.category,
    pv.version AS installed_version,
    plv_latest.latest_version_id,
    pv_latest.version AS latest_available_version,
    CASE
        WHEN pv.id != plv_latest.latest_version_id THEN true
        ELSE false
    END AS update_available
FROM user_plugin_installations upi
JOIN plugins p ON upi.plugin_id = p.id
JOIN plugin_versions pv ON upi.version_id = pv.id
LEFT JOIN plugin_latest_versions plv_latest ON p.id = plv_latest.plugin_id
LEFT JOIN plugin_versions pv_latest ON plv_latest.latest_version_id = pv_latest.id
WHERE upi.status = 'active';
```

---

## 3. API Architecture

### 3.1 REST API Endpoints

**Base URL:** `https://api.allow2.com/v1/plugins`

#### Discovery & Search

```
GET /plugins
Query Parameters:
  - q: Search query (name, description, tags)
  - category: Filter by category
  - verified_only: Boolean (default: false)
  - min_trust_score: Minimum trust score (0-100)
  - sort: stars|installs|updated|created (default: trust_score)
  - page: Page number
  - limit: Results per page (max 100)
Response:
{
  "plugins": [
    {
      "plugin_id": "allow2automate-playstation",
      "name": "PlayStation Parental Controls",
      "description": "...",
      "category": "Gaming",
      "author": {
        "name": "JohnDoe",
        "github": "johndoe",
        "verified": false
      },
      "repository": {
        "type": "github",
        "url": "https://github.com/johndoe/allow2automate-playstation",
        "default_branch": "main"
      },
      "install_url": "git+https://github.com/johndoe/allow2automate-playstation.git",
      "latest_version": "2.0.0",
      "verification_level": "unverified",
      "trust_score": 67.5,
      "trust_indicators": {
        "github_stars": 42,
        "github_forks": 8,
        "last_commit": "2024-01-15T10:30:00Z",
        "repo_age_days": 365,
        "total_installs": 1234,
        "active_installs": 892,
        "average_rating": 4.3,
        "total_reviews": 28
      },
      "permissions_required": ["network", "configuration"],
      "tags": ["gaming", "playstation", "parental-control"]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "total_pages": 8
  }
}
```

```
GET /plugins/:plugin_id
Response:
{
  "plugin_id": "allow2automate-playstation",
  "name": "PlayStation Parental Controls",
  "description": "...",
  "long_description": "...",  // Markdown from README
  "category": "Gaming",
  "author": {...},
  "repository": {...},
  "install_url": "...",
  "versions": [
    {
      "version": "2.0.0",
      "git_tag": "v2.0.0",
      "published_at": "2024-01-15T10:30:00Z",
      "release_notes": "...",
      "breaking_changes": false,
      "downloads": 456
    },
    {
      "version": "1.1.0",
      "git_tag": "v1.1.0",
      "published_at": "2023-11-20T14:20:00Z",
      "downloads": 778
    }
  ],
  "latest_version": "2.0.0",
  "verification_level": "unverified",
  "trust_score": 67.5,
  "trust_indicators": {...},
  "security": {
    "last_scan": "2024-01-16T08:00:00Z",
    "risk_level": "low",
    "issues": []
  },
  "permissions_required": ["network", "configuration"],
  "tags": [...],
  "screenshots": [...],
  "reviews_summary": {
    "average_rating": 4.3,
    "total_reviews": 28,
    "rating_distribution": {
      "5": 18,
      "4": 7,
      "3": 2,
      "2": 1,
      "1": 0
    }
  }
}
```

#### Installation & Updates

```
GET /plugins/:plugin_id/install-info
Response:
{
  "install_url": "git+https://github.com/johndoe/allow2automate-playstation.git#v2.0.0",
  "latest_version": "2.0.0",
  "git_tag": "v2.0.0",
  "commit_sha": "abc123def456...",
  "installation_instructions": "...",
  "post_install_steps": [...],
  "required_dependencies": {
    "node": ">=18.0.0",
    "allow2automate": ">=2.0.0"
  },
  "security_warnings": [
    {
      "severity": "info",
      "message": "This plugin requires network access to PlayStation Network API"
    }
  ]
}
```

```
GET /users/:user_id/plugins
Authentication: Required
Response:
{
  "installed_plugins": [
    {
      "plugin_id": "allow2automate-playstation",
      "name": "PlayStation Parental Controls",
      "installed_version": "1.1.0",
      "latest_version": "2.0.0",
      "update_available": true,
      "installed_at": "2023-12-01T10:00:00Z",
      "auto_update": true,
      "status": "active"
    }
  ]
}
```

```
POST /users/:user_id/plugins/:plugin_id/install
Authentication: Required
Body:
{
  "version": "2.0.0",  // Optional, defaults to latest
  "auto_update": true
}
Response:
{
  "installation_id": "uuid",
  "plugin_id": "allow2automate-playstation",
  "version": "2.0.0",
  "status": "installed"
}
```

```
GET /users/:user_id/plugins/updates
Authentication: Required
Response:
{
  "updates_available": [
    {
      "plugin_id": "allow2automate-playstation",
      "current_version": "1.1.0",
      "latest_version": "2.0.0",
      "release_notes": "...",
      "breaking_changes": false,
      "security_update": false
    }
  ]
}
```

#### Reviews & Ratings

```
GET /plugins/:plugin_id/reviews
Query Parameters:
  - sort: helpful|recent|rating (default: helpful)
  - rating: Filter by star rating
  - page, limit
Response:
{
  "reviews": [
    {
      "id": "uuid",
      "user_name": "Alice",
      "rating": 5,
      "title": "Works perfectly!",
      "review_text": "...",
      "helpful_count": 12,
      "not_helpful_count": 1,
      "created_at": "2024-01-10T15:30:00Z"
    }
  ],
  "pagination": {...}
}
```

```
POST /plugins/:plugin_id/reviews
Authentication: Required
Body:
{
  "rating": 5,
  "title": "Works perfectly!",
  "review_text": "..."
}
```

#### Submission

```
POST /plugins/submit
Body:
{
  "plugin_id": "allow2automate-playstation",
  "name": "PlayStation Parental Controls",
  "description": "...",
  "category": "Gaming",
  "repository": {
    "type": "github",
    "url": "https://github.com/johndoe/allow2automate-playstation"
  },
  "submitter": {
    "name": "John Doe",
    "email": "john@example.com",
    "github": "johndoe"
  },
  "permissions_required": ["network", "configuration"],
  "tags": ["gaming", "playstation"]
}
Response:
{
  "submission_id": "uuid",
  "status": "pending",
  "estimated_review_time": "2-3 business days",
  "next_steps": "You will receive an email when your submission is reviewed."
}
```

```
GET /plugins/submissions/:submission_id
Response:
{
  "submission_id": "uuid",
  "status": "approved",
  "plugin_id": "allow2automate-playstation",
  "submitted_at": "2024-01-10T10:00:00Z",
  "reviewed_at": "2024-01-11T14:30:00Z",
  "review_notes": "Approved. Plugin meets all requirements."
}
```

### 3.2 WebSocket API (Real-time Updates)

```javascript
// Connection
const ws = new WebSocket('wss://api.allow2.com/v1/ws');

// Subscribe to plugin updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'plugin_updates',
  user_id: 'user-uuid'
}));

// Receive update notifications
ws.on('message', (data) => {
  const message = JSON.parse(data);
  /*
  {
    type: 'update_available',
    plugin_id: 'allow2automate-playstation',
    current_version: '1.1.0',
    new_version: '2.0.0',
    breaking_changes: false,
    security_update: false
  }
  */
});
```

---

## 4. Git Installation Integration

### 4.1 Installation Architecture

```javascript
// /src/services/PluginInstaller.ts

import { PluginManager } from 'electron-plugin-manager';
import { SecurityScanner } from './SecurityScanner';
import { GitService } from './GitService';

export class PluginInstaller {
  private pluginManager: PluginManager;
  private securityScanner: SecurityScanner;
  private gitService: GitService;

  async installPlugin(
    pluginId: string,
    version?: string
  ): Promise<InstallationResult> {
    // 1. Fetch plugin metadata from registry
    const metadata = await this.fetchPluginMetadata(pluginId);

    // 2. Determine install URL with version tag
    const installUrl = this.buildInstallUrl(metadata, version);

    // 3. Show user confirmation dialog with risk disclosure
    const confirmed = await this.showInstallConfirmation(metadata);
    if (!confirmed) {
      throw new Error('Installation cancelled by user');
    }

    // 4. Clone repository to temporary directory
    const tempDir = await this.gitService.cloneRepo(installUrl, version);

    // 5. Run security scans
    const scanResults = await this.securityScanner.scanPlugin(tempDir);
    if (scanResults.riskLevel === 'critical') {
      await this.showSecurityWarning(scanResults);
      const proceed = await this.confirmDespiteRisks();
      if (!proceed) {
        throw new Error('Installation cancelled due to security risks');
      }
    }

    // 6. Install using electron-plugin-manager
    const result = await this.pluginManager.install({
      source: tempDir,
      sandbox: true,
      permissions: metadata.permissions_required
    });

    // 7. Track installation in local database
    await this.trackInstallation(pluginId, version, result);

    // 8. Clean up temporary directory
    await this.gitService.cleanupTemp(tempDir);

    // 9. Report installation to registry (analytics)
    await this.reportInstallation(pluginId, version);

    return result;
  }

  private buildInstallUrl(metadata: PluginMetadata, version?: string): string {
    const baseUrl = metadata.install_url;
    const targetVersion = version || metadata.latest_version;

    // For GitHub: git+https://github.com/user/repo.git#v2.0.0
    // For Bitbucket: git+https://bitbucket.org/user/repo.git#v2.0.0
    return `${baseUrl}#${metadata.versions.find(v => v.version === targetVersion)?.git_tag}`;
  }

  async updatePlugin(pluginId: string, newVersion: string): Promise<void> {
    // Similar to install, but preserves user configuration
    const currentConfig = await this.pluginManager.getPluginConfig(pluginId);

    await this.uninstallPlugin(pluginId, { preserveConfig: true });
    await this.installPlugin(pluginId, newVersion);

    await this.pluginManager.setPluginConfig(pluginId, currentConfig);
  }
}
```

### 4.2 Git Service

```typescript
// /src/services/GitService.ts

import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export class GitService {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit();
  }

  async cloneRepo(installUrl: string, version?: string): Promise<string> {
    // Parse git URL: git+https://github.com/user/repo.git#v2.0.0
    const { repoUrl, tag } = this.parseGitUrl(installUrl);

    // Create temporary directory
    const tempDir = path.join(
      os.tmpdir(),
      'allow2-plugins',
      `${Date.now()}-${Math.random().toString(36)}`
    );

    await fs.ensureDir(tempDir);

    try {
      // Clone repository
      await this.git.clone(repoUrl, tempDir, ['--depth', '1', '--branch', tag]);

      // Verify package.json exists
      const packageJsonPath = path.join(tempDir, 'package.json');
      if (!await fs.pathExists(packageJsonPath)) {
        throw new Error('Invalid plugin: package.json not found');
      }

      // Read and validate package.json
      const packageJson = await fs.readJson(packageJsonPath);
      this.validatePackageJson(packageJson);

      return tempDir;
    } catch (error) {
      // Cleanup on failure
      await fs.remove(tempDir);
      throw error;
    }
  }

  private parseGitUrl(installUrl: string): { repoUrl: string; tag: string } {
    // git+https://github.com/user/repo.git#v2.0.0
    const match = installUrl.match(/^git\+(.+?)(?:#(.+))?$/);
    if (!match) {
      throw new Error('Invalid git install URL');
    }

    return {
      repoUrl: match[1],
      tag: match[2] || 'HEAD'
    };
  }

  private validatePackageJson(packageJson: any): void {
    // Required fields
    if (!packageJson.name || !packageJson.version) {
      throw new Error('Invalid package.json: missing name or version');
    }

    // Check for allow2automate plugin marker
    if (!packageJson.allow2automate?.plugin) {
      throw new Error('Not a valid Allow2Automate plugin');
    }
  }

  async cleanupTemp(tempDir: string): Promise<void> {
    await fs.remove(tempDir);
  }

  async fetchRepoMetadata(repoUrl: string): Promise<GitRepoMetadata> {
    // Use GitHub/Bitbucket API to fetch repo metadata
    const provider = this.detectProvider(repoUrl);

    switch (provider) {
      case 'github':
        return this.fetchGitHubMetadata(repoUrl);
      case 'bitbucket':
        return this.fetchBitbucketMetadata(repoUrl);
      case 'gitlab':
        return this.fetchGitLabMetadata(repoUrl);
      default:
        throw new Error('Unsupported git provider');
    }
  }

  private async fetchGitHubMetadata(repoUrl: string): Promise<GitRepoMetadata> {
    // Parse owner/repo from URL
    const match = repoUrl.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
    if (!match) throw new Error('Invalid GitHub URL');

    const [, owner, repo] = match;

    // Fetch from GitHub API
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    const data = await response.json();

    // Fetch tags
    const tagsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/tags`);
    const tags = await tagsResponse.json();

    return {
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      openIssues: data.open_issues_count,
      lastCommit: data.pushed_at,
      createdAt: data.created_at,
      license: data.license?.spdx_id,
      defaultBranch: data.default_branch,
      tags: tags.map((t: any) => ({
        name: t.name,
        commit: t.commit.sha
      }))
    };
  }
}
```

### 4.3 Security Scanner

```typescript
// /src/services/SecurityScanner.ts

import * as fs from 'fs-extra';
import * as path from 'path';

export interface SecurityScanResult {
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  issues: SecurityIssue[];
  warnings: string[];
}

export interface SecurityIssue {
  type: 'package_json_script' | 'dependency' | 'file_access' | 'network_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: string;
}

export class SecurityScanner {
  async scanPlugin(pluginDir: string): Promise<SecurityScanResult> {
    const issues: SecurityIssue[] = [];
    const warnings: string[] = [];

    // 1. Scan package.json for dangerous scripts
    await this.scanPackageJsonScripts(pluginDir, issues);

    // 2. Check dependencies for known vulnerabilities
    await this.scanDependencies(pluginDir, issues);

    // 3. Static analysis for dangerous patterns
    await this.scanSourceCode(pluginDir, issues, warnings);

    // 4. Check file permissions requirements
    await this.checkPermissions(pluginDir, warnings);

    // Calculate overall risk level
    const riskLevel = this.calculateRiskLevel(issues);

    return { riskLevel, issues, warnings };
  }

  private async scanPackageJsonScripts(
    pluginDir: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    const packageJsonPath = path.join(pluginDir, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);

    // Dangerous script patterns
    const dangerousPatterns = [
      { pattern: /rm\s+-rf/, severity: 'critical' as const, desc: 'File deletion command' },
      { pattern: /curl\s+.+?\|\s*sh/, severity: 'critical' as const, desc: 'Remote script execution' },
      { pattern: /eval\s*\(/, severity: 'high' as const, desc: 'Code evaluation' },
      { pattern: /process\.env\./, severity: 'medium' as const, desc: 'Environment variable access' }
    ];

    const scripts = packageJson.scripts || {};

    for (const [scriptName, scriptContent] of Object.entries(scripts)) {
      for (const { pattern, severity, desc } of dangerousPatterns) {
        if (pattern.test(scriptContent as string)) {
          issues.push({
            type: 'package_json_script',
            severity,
            description: `Dangerous script in "${scriptName}": ${desc}`,
            location: `package.json:scripts.${scriptName}`
          });
        }
      }
    }
  }

  private async scanDependencies(
    pluginDir: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    // Run npm audit or use Snyk API
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync('npm audit --json', { cwd: pluginDir });
      const auditResult = JSON.parse(stdout);

      if (auditResult.metadata.vulnerabilities.high > 0 ||
          auditResult.metadata.vulnerabilities.critical > 0) {
        issues.push({
          type: 'dependency',
          severity: 'high',
          description: `Found ${auditResult.metadata.vulnerabilities.high} high and ${auditResult.metadata.vulnerabilities.critical} critical vulnerabilities in dependencies`
        });
      }
    } catch (error) {
      // npm audit failed - might be OK, just warn
      console.warn('npm audit failed:', error);
    }
  }

  private async scanSourceCode(
    pluginDir: string,
    issues: SecurityIssue[],
    warnings: string[]
  ): Promise<void> {
    // Scan all .js/.ts files for dangerous patterns
    const glob = require('glob');
    const files = glob.sync('**/*.{js,ts}', {
      cwd: pluginDir,
      ignore: ['node_modules/**', 'test/**', 'tests/**']
    });

    const dangerousPatterns = [
      { pattern: /child_process|exec\(|spawn\(/g, desc: 'Child process execution' },
      { pattern: /require\(['"]fs['"]\)/g, desc: 'File system access' },
      { pattern: /require\(['"]net['"]\)|require\(['"]http['"]\)/g, desc: 'Network access' },
      { pattern: /eval\s*\(/g, desc: 'Code evaluation (eval)' },
      { pattern: /Function\s*\(/g, desc: 'Dynamic function creation' }
    ];

    for (const file of files) {
      const content = await fs.readFile(path.join(pluginDir, file), 'utf-8');

      for (const { pattern, desc } of dangerousPatterns) {
        if (pattern.test(content)) {
          warnings.push(`${desc} detected in ${file}`);
        }
      }
    }
  }

  private async checkPermissions(
    pluginDir: string,
    warnings: string[]
  ): Promise<void> {
    const packageJsonPath = path.join(pluginDir, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);

    const permissions = packageJson.allow2automate?.permissions || [];

    const highRiskPermissions = ['filesystem', 'network', 'system'];
    for (const perm of permissions) {
      if (highRiskPermissions.includes(perm)) {
        warnings.push(`Plugin requires high-risk permission: ${perm}`);
      }
    }
  }

  private calculateRiskLevel(issues: SecurityIssue[]): SecurityScanResult['riskLevel'] {
    if (issues.some(i => i.severity === 'critical')) return 'critical';
    if (issues.some(i => i.severity === 'high')) return 'high';
    if (issues.some(i => i.severity === 'medium')) return 'medium';
    if (issues.length > 0) return 'low';
    return 'none';
  }
}
```

---

## 5. Version Management & Update System

### 5.1 Version Tracking Service

```typescript
// /src/services/VersionManager.ts

export class VersionManager {
  private db: Database;
  private gitService: GitService;

  /**
   * Syncs plugin versions from Git repository
   * Called periodically by background worker
   */
  async syncPluginVersions(pluginId: string): Promise<void> {
    const plugin = await this.db.getPlugin(pluginId);
    const repoMetadata = await this.gitService.fetchRepoMetadata(plugin.repo_url);

    // Process each Git tag
    for (const tag of repoMetadata.tags) {
      // Check if version already exists
      const exists = await this.db.versionExists(plugin.id, tag.name);
      if (exists) continue;

      // Parse version from tag (v2.0.0 -> 2.0.0)
      const version = this.parseVersion(tag.name);

      // Create version record
      await this.db.createVersion({
        plugin_id: plugin.id,
        version,
        git_tag: tag.name,
        git_commit_sha: tag.commit,
        published_at: tag.createdAt
      });

      // Fetch release notes from GitHub releases
      const releaseNotes = await this.fetchReleaseNotes(
        plugin.repo_url,
        tag.name
      );

      if (releaseNotes) {
        await this.db.updateVersion(plugin.id, version, {
          release_notes: releaseNotes.body,
          breaking_changes: this.detectBreakingChanges(releaseNotes.body)
        });
      }
    }

    // Update latest version tracker
    await this.updateLatestVersion(plugin.id);

    // Update plugin metadata
    await this.db.updatePlugin(plugin.id, {
      last_sync_at: new Date()
    });
  }

  /**
   * Updates the latest version tracker for a plugin
   */
  private async updateLatestVersion(pluginId: string): Promise<void> {
    // Get all versions sorted by semver
    const versions = await this.db.getVersions(pluginId);
    const sorted = this.sortVersions(versions);

    const latest = sorted[0];
    const latestStable = sorted.find(v => !this.isPrerelease(v.version));

    await this.db.upsertLatestVersion({
      plugin_id: pluginId,
      latest_version_id: latest.id,
      latest_stable_version_id: latestStable?.id || latest.id
    });
  }

  private sortVersions(versions: Version[]): Version[] {
    const semver = require('semver');
    return versions.sort((a, b) => semver.rcompare(a.version, b.version));
  }

  private parseVersion(tag: string): string {
    // Remove 'v' prefix if present: v2.0.0 -> 2.0.0
    return tag.replace(/^v/, '');
  }

  private isPrerelease(version: string): boolean {
    const semver = require('semver');
    return semver.prerelease(version) !== null;
  }

  private detectBreakingChanges(releaseNotes: string): boolean {
    const breakingKeywords = [
      /breaking\s+change/i,
      /\[breaking\]/i,
      /BREAKING:/i,
      /⚠️/,
      /major\s+version/i
    ];

    return breakingKeywords.some(pattern => pattern.test(releaseNotes));
  }

  private async fetchReleaseNotes(repoUrl: string, tag: string): Promise<any> {
    // GitHub API example
    const match = repoUrl.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
    if (!match) return null;

    const [, owner, repo] = match;

    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`
      );

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch release notes:', error);
      return null;
    }
  }
}
```

### 5.2 Update Checker & Notifier

```typescript
// /src/services/UpdateChecker.ts

export class UpdateChecker {
  private db: Database;
  private versionManager: VersionManager;

  /**
   * Checks for updates for all installed plugins
   * Runs periodically (e.g., every 6 hours)
   */
  async checkForUpdates(userId: string): Promise<Update[]> {
    const installations = await this.db.getUserInstallations(userId);
    const updates: Update[] = [];

    for (const installation of installations) {
      // Skip if auto-update is disabled
      if (!installation.auto_update) continue;

      // Get latest version for this plugin
      const latestVersion = await this.db.getLatestVersion(
        installation.plugin_id
      );

      // Compare with installed version
      if (this.isNewerVersion(latestVersion.version, installation.version)) {
        updates.push({
          plugin_id: installation.plugin_id,
          plugin_name: installation.plugin_name,
          current_version: installation.version,
          latest_version: latestVersion.version,
          breaking_changes: latestVersion.breaking_changes,
          security_update: await this.isSecurityUpdate(latestVersion),
          release_notes: latestVersion.release_notes
        });
      }
    }

    return updates;
  }

  private isNewerVersion(latest: string, current: string): boolean {
    const semver = require('semver');
    return semver.gt(latest, current);
  }

  private async isSecurityUpdate(version: Version): Promise<boolean> {
    // Check release notes for security keywords
    const securityKeywords = [
      /security\s+fix/i,
      /security\s+update/i,
      /CVE-/i,
      /vulnerability/i,
      /\[security\]/i
    ];

    return securityKeywords.some(pattern =>
      pattern.test(version.release_notes || '')
    );
  }

  /**
   * Sends update notifications to users
   */
  async notifyUsers(updates: Update[]): Promise<void> {
    for (const update of updates) {
      const severity = this.calculateSeverity(update);

      // Create notification record
      await this.db.createNotification({
        plugin_id: update.plugin_id,
        version_id: update.latest_version_id,
        title: this.generateNotificationTitle(update),
        message: this.generateNotificationMessage(update),
        notification_type: update.security_update ? 'security_update' : 'new_version',
        severity
      });

      // Send to user (in-app, email, push notification)
      await this.sendNotification(update, severity);
    }
  }

  private calculateSeverity(update: Update): 'info' | 'important' | 'critical' {
    if (update.security_update) return 'critical';
    if (update.breaking_changes) return 'important';
    return 'info';
  }

  private generateNotificationTitle(update: Update): string {
    if (update.security_update) {
      return `Security Update Available: ${update.plugin_name}`;
    }
    if (update.breaking_changes) {
      return `Major Update Available: ${update.plugin_name}`;
    }
    return `Update Available: ${update.plugin_name}`;
  }

  private generateNotificationMessage(update: Update): string {
    let message = `${update.plugin_name} version ${update.latest_version} is now available.`;

    if (update.security_update) {
      message += ' This update includes important security fixes.';
    }

    if (update.breaking_changes) {
      message += ' This is a major version with breaking changes. Please review the release notes before updating.';
    }

    return message;
  }

  /**
   * Automatically installs updates for plugins with auto-update enabled
   */
  async autoUpdate(userId: string): Promise<void> {
    const updates = await this.checkForUpdates(userId);

    for (const update of updates) {
      // Skip breaking changes in auto-update
      if (update.breaking_changes) {
        await this.notifyUsers([update]);
        continue;
      }

      try {
        const installer = new PluginInstaller();
        await installer.updatePlugin(update.plugin_id, update.latest_version);

        // Log successful update
        await this.db.logUpdate({
          user_id: userId,
          plugin_id: update.plugin_id,
          from_version: update.current_version,
          to_version: update.latest_version,
          auto_update: true,
          status: 'success'
        });
      } catch (error) {
        // Log failed update
        await this.db.logUpdate({
          user_id: userId,
          plugin_id: update.plugin_id,
          from_version: update.current_version,
          to_version: update.latest_version,
          auto_update: true,
          status: 'failed',
          error_message: error.message
        });

        // Notify user of failure
        await this.notifyUpdateFailure(update, error);
      }
    }
  }
}
```

### 5.3 Background Worker (Cron Jobs)

```typescript
// /src/workers/PluginSyncWorker.ts

import * as cron from 'node-cron';

export class PluginSyncWorker {
  private versionManager: VersionManager;
  private updateChecker: UpdateChecker;

  start(): void {
    // Sync all plugin versions every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('Starting plugin version sync...');
      await this.syncAllPlugins();
    });

    // Check for updates every 12 hours
    cron.schedule('0 */12 * * *', async () => {
      console.log('Checking for plugin updates...');
      await this.checkAllUserUpdates();
    });

    // Update trust indicators daily
    cron.schedule('0 2 * * *', async () => {
      console.log('Updating trust indicators...');
      await this.updateTrustIndicators();
    });
  }

  private async syncAllPlugins(): Promise<void> {
    const plugins = await this.db.getApprovedPlugins();

    for (const plugin of plugins) {
      try {
        await this.versionManager.syncPluginVersions(plugin.plugin_id);
      } catch (error) {
        console.error(`Failed to sync ${plugin.plugin_id}:`, error);
      }
    }
  }

  private async checkAllUserUpdates(): Promise<void> {
    const users = await this.db.getUsersWithPlugins();

    for (const user of users) {
      try {
        await this.updateChecker.autoUpdate(user.id);
      } catch (error) {
        console.error(`Failed to check updates for user ${user.id}:`, error);
      }
    }
  }

  private async updateTrustIndicators(): Promise<void> {
    const plugins = await this.db.getApprovedPlugins();

    for (const plugin of plugins) {
      try {
        const repoMetadata = await this.gitService.fetchRepoMetadata(plugin.repo_url);

        await this.db.updateTrustIndicators(plugin.id, {
          stars_count: repoMetadata.stars,
          forks_count: repoMetadata.forks,
          watchers_count: repoMetadata.watchers,
          open_issues_count: repoMetadata.openIssues,
          last_commit_at: repoMetadata.lastCommit,
          repo_age_days: this.calculateAgeDays(repoMetadata.createdAt),
          has_license: !!repoMetadata.license,
          license_type: repoMetadata.license,
          last_synced_at: new Date()
        });
      } catch (error) {
        console.error(`Failed to update trust indicators for ${plugin.plugin_id}:`, error);
      }
    }
  }

  private calculateAgeDays(createdAt: string): number {
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  }
}
```

---

## 6. Trust & Reputation Scoring

### 6.1 Trust Score Algorithm

```typescript
// /src/services/TrustScoreCalculator.ts

export class TrustScoreCalculator {
  /**
   * Calculates a trust score (0-100) based on multiple factors
   */
  calculateTrustScore(
    plugin: Plugin,
    trustIndicators: TrustIndicators,
    reviews: ReviewsSummary
  ): number {
    const weights = {
      repository_health: 0.30,
      community_engagement: 0.25,
      security: 0.20,
      user_satisfaction: 0.15,
      maintenance: 0.10
    };

    const scores = {
      repository_health: this.scoreRepositoryHealth(trustIndicators),
      community_engagement: this.scoreCommunityEngagement(trustIndicators),
      security: this.scoreSecurityPractices(plugin, trustIndicators),
      user_satisfaction: this.scoreUserSatisfaction(reviews, trustIndicators),
      maintenance: this.scoreMaintenanceActivity(trustIndicators)
    };

    // Weighted average
    let totalScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
      totalScore += scores[key] * weight;
    }

    // Apply penalties
    totalScore = this.applyPenalties(totalScore, plugin, trustIndicators);

    return Math.round(Math.max(0, Math.min(100, totalScore)));
  }

  private scoreRepositoryHealth(indicators: TrustIndicators): number {
    let score = 0;

    // Stars (max 30 points)
    score += Math.min(30, indicators.stars_count / 10);

    // Forks (max 20 points)
    score += Math.min(20, indicators.forks_count / 5);

    // Has license (20 points)
    if (indicators.has_license) score += 20;

    // Low open issues ratio (max 30 points)
    if (indicators.forks_count > 0) {
      const issueRatio = indicators.open_issues_count / indicators.forks_count;
      score += Math.max(0, 30 - (issueRatio * 10));
    }

    return score;
  }

  private scoreCommunityEngagement(indicators: TrustIndicators): number {
    let score = 0;

    // Installation count (max 40 points)
    const installScore = Math.min(40, indicators.total_installs / 100);
    score += installScore;

    // Retention rate (max 30 points)
    score += (indicators.retention_rate || 0) * 0.3;

    // Active installs ratio (max 30 points)
    if (indicators.total_installs > 0) {
      const activeRatio = indicators.active_installs / indicators.total_installs;
      score += activeRatio * 30;
    }

    return score;
  }

  private scoreSecurityPractices(
    plugin: Plugin,
    indicators: TrustIndicators
  ): number {
    let score = 50; // Start at 50

    // Has security policy (+20)
    if (indicators.has_security_policy) score += 20;

    // Has code of conduct (+10)
    if (indicators.has_code_of_conduct) score += 10;

    // Verified author (+20)
    if (plugin.author_verified) score += 20;

    return score;
  }

  private scoreUserSatisfaction(
    reviews: ReviewsSummary,
    indicators: TrustIndicators
  ): number {
    let score = 0;

    // Average rating (max 60 points)
    score += (reviews.average_rating / 5) * 60;

    // Number of reviews (max 40 points)
    const reviewScore = Math.min(40, reviews.total_reviews * 2);
    score += reviewScore;

    return score;
  }

  private scoreMaintenanceActivity(indicators: TrustIndicators): number {
    let score = 0;

    // Recent commit (max 50 points)
    const daysSinceCommit = this.daysSince(indicators.last_commit_at);
    if (daysSinceCommit <= 7) {
      score += 50;
    } else if (daysSinceCommit <= 30) {
      score += 40;
    } else if (daysSinceCommit <= 90) {
      score += 30;
    } else if (daysSinceCommit <= 180) {
      score += 20;
    } else {
      score += 10;
    }

    // Regular updates (max 50 points)
    if (indicators.update_frequency_days > 0) {
      if (indicators.update_frequency_days <= 14) {
        score += 50;
      } else if (indicators.update_frequency_days <= 30) {
        score += 40;
      } else if (indicators.update_frequency_days <= 60) {
        score += 30;
      } else {
        score += 20;
      }
    }

    return score;
  }

  private applyPenalties(
    score: number,
    plugin: Plugin,
    indicators: TrustIndicators
  ): number {
    // High uninstall rate penalty
    if (indicators.total_installs > 100) {
      const uninstallRate = indicators.total_uninstalls / indicators.total_installs;
      if (uninstallRate > 0.5) {
        score -= 20; // More than 50% uninstall rate
      } else if (uninstallRate > 0.3) {
        score -= 10; // More than 30% uninstall rate
      }
    }

    // Stale repository penalty
    const daysSinceCommit = this.daysSince(indicators.last_commit_at);
    if (daysSinceCommit > 365) {
      score -= 30; // Not updated in over a year
    } else if (daysSinceCommit > 180) {
      score -= 15; // Not updated in over 6 months
    }

    // Young repository penalty
    if (indicators.repo_age_days < 30) {
      score -= 20; // Very new repository
    } else if (indicators.repo_age_days < 90) {
      score -= 10; // Relatively new repository
    }

    return score;
  }

  private daysSince(date: Date | string): number {
    const then = new Date(date);
    const now = new Date();
    return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Determines verification level based on trust score and other factors
   */
  determineVerificationLevel(
    plugin: Plugin,
    trustScore: number,
    indicators: TrustIndicators
  ): 'unverified' | 'community' | 'verified' {
    // Verified: Manually reviewed by Allow2 team
    if (plugin.verification_level === 'verified') {
      return 'verified';
    }

    // Community: High trust score + minimum thresholds
    if (
      trustScore >= 70 &&
      indicators.total_installs >= 100 &&
      indicators.repo_age_days >= 90 &&
      indicators.average_rating >= 4.0 &&
      indicators.total_reviews >= 10
    ) {
      return 'community';
    }

    return 'unverified';
  }
}
```

### 6.2 Trust Score Update Worker

```typescript
// /src/workers/TrustScoreWorker.ts

export class TrustScoreWorker {
  private calculator: TrustScoreCalculator;

  start(): void {
    // Recalculate trust scores every 24 hours
    cron.schedule('0 3 * * *', async () => {
      await this.recalculateAllScores();
    });
  }

  private async recalculateAllScores(): Promise<void> {
    const plugins = await this.db.getApprovedPlugins();

    for (const plugin of plugins) {
      try {
        const indicators = await this.db.getTrustIndicators(plugin.id);
        const reviews = await this.db.getReviewsSummary(plugin.id);

        const trustScore = this.calculator.calculateTrustScore(
          plugin,
          indicators,
          reviews
        );

        const verificationLevel = this.calculator.determineVerificationLevel(
          plugin,
          trustScore,
          indicators
        );

        await this.db.updatePlugin(plugin.id, {
          trust_score: trustScore,
          verification_level: verificationLevel
        });

        // Auto-promote to community verified if criteria met
        if (
          plugin.verification_level === 'unverified' &&
          verificationLevel === 'community'
        ) {
          await this.notifyAutoPromotion(plugin);
        }
      } catch (error) {
        console.error(`Failed to recalculate trust score for ${plugin.plugin_id}:`, error);
      }
    }
  }

  private async notifyAutoPromotion(plugin: Plugin): Promise<void> {
    // Notify plugin author of community verification
    console.log(`Plugin ${plugin.plugin_id} auto-promoted to community verified`);
    // Send email notification, etc.
  }
}
```

---

## 7. Security Architecture

### 7.1 Security Validation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Installation Security Flow                   │
└─────────────────────────────────────────────────────────────────┘

1. User initiates installation
   ↓
2. Fetch plugin metadata from registry
   ↓
3. Display risk disclosure dialog
   - Plugin verification level (unverified/community/verified)
   - Trust score
   - Required permissions
   - GitHub stats (stars, forks, last update)
   - Security scan results (if available)
   ↓
4. User confirms installation
   ↓
5. Clone repository to temporary directory
   ↓
6. Run security scans
   - package.json script analysis
   - Dependency vulnerability check (npm audit)
   - Static code analysis for dangerous patterns
   - Permission validation
   ↓
7. Display security warnings if issues found
   ↓
8. User confirms despite risks (if applicable)
   ↓
9. Install in sandboxed environment
   - Restricted file system access
   - Network access only if permitted
   - No system-level operations
   ↓
10. Track installation and report to registry
```

### 7.2 Risk Disclosure Dialog

```typescript
// /src/ui/components/InstallConfirmationDialog.tsx

export interface InstallConfirmationProps {
  plugin: PluginMetadata;
  securityScan?: SecurityScanResult;
}

export const InstallConfirmationDialog: React.FC<InstallConfirmationProps> = ({
  plugin,
  securityScan
}) => {
  return (
    <Dialog>
      <DialogTitle>Install {plugin.name}?</DialogTitle>
      <DialogContent>
        {/* Verification Badge */}
        <VerificationBadge level={plugin.verification_level} />

        {/* Trust Score */}
        <TrustScore score={plugin.trust_score} />

        {/* Repository Info */}
        <RepositoryInfo
          url={plugin.repository.url}
          stars={plugin.trust_indicators.github_stars}
          forks={plugin.trust_indicators.github_forks}
          lastCommit={plugin.trust_indicators.last_commit}
        />

        {/* Permissions Required */}
        <PermissionsList permissions={plugin.permissions_required} />

        {/* Security Warnings */}
        {securityScan && securityScan.riskLevel !== 'none' && (
          <SecurityWarnings scan={securityScan} />
        )}

        {/* Unverified Plugin Warning */}
        {plugin.verification_level === 'unverified' && (
          <Alert severity="warning">
            <AlertTitle>Unverified Plugin</AlertTitle>
            This plugin has not been verified by Allow2 or the community.
            Install at your own risk. The plugin code is hosted on GitHub
            and not reviewed by Allow2.
          </Alert>
        )}

        {/* Risk Acknowledgment */}
        <Checkbox
          label="I understand the risks and want to install this plugin"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained">
          Install
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

### 7.3 Sandboxing Configuration

```typescript
// /src/config/sandbox.config.ts

export const SANDBOX_CONFIG = {
  // File system restrictions
  filesystem: {
    allow: [
      // Plugin can only access its own directory
      '{{PLUGIN_DIR}}/**',
      // And the app's plugin data directory
      '{{APP_DATA}}/plugins/{{PLUGIN_ID}}/**'
    ],
    deny: [
      // No access to user files
      '{{USER_HOME}}/**',
      // No access to system directories
      '/etc/**',
      '/sys/**',
      '/proc/**',
      // No access to other plugins
      '{{PLUGIN_DIR}}/../**'
    ]
  },

  // Network restrictions
  network: {
    // Only if permission granted
    allowed: (permissions: string[]) => permissions.includes('network'),
    // Block local network access
    denyLocalhost: true,
    denyPrivateIPs: true
  },

  // Process restrictions
  process: {
    // No child process spawning unless permitted
    allowChildProcess: (permissions: string[]) =>
      permissions.includes('system'),
    // CPU/memory limits
    maxCPU: '50%',
    maxMemory: '512MB'
  },

  // Node.js API restrictions
  nodeAPIs: {
    // Always allowed
    allow: ['path', 'util', 'crypto'],
    // Conditional
    conditional: {
      fs: (permissions) => permissions.includes('filesystem'),
      http: (permissions) => permissions.includes('network'),
      https: (permissions) => permissions.includes('network'),
      child_process: (permissions) => permissions.includes('system')
    },
    // Always denied
    deny: ['cluster', 'process.binding', 'native modules']
  }
};
```

---

## 8. Plugin Submission & Review Workflow

### 8.1 Namespace-Based Submission Process

```
Developer Workflow:
─────────────────────────────────────────────────────────────
1. Developer creates GitHub repository
   - Implements plugin following Allow2Automate Plugin Spec
   - Adds package.json with allow2automate metadata
   - Creates README with usage instructions
   - Adds LICENSE file
   - Tags initial release (e.g., v1.0.0)

2. Developer chooses or creates namespace
   - Official publishers: Apply for verified namespace (@company-name)
   - Community contributors: Use @community namespace
   - First-time publishers: Create new namespace folder

3. Developer submits plugin to registry via Pull Request
   - Fork the registry repository
   - Create namespace folder (if new): plugins/@namespace/
   - Create plugin metadata file: plugins/@namespace/plugin-name.json
   - Update plugins.json master index with plugin entry
   - Add namespace to namespaces section (if new)
   - Update lastUpdated timestamp
   - Submit pull request with:
     * New namespace folder (if applicable)
     * Plugin metadata file
     * Updated plugins.json
     * Description of plugin functionality

4. Automated validation (CI/CD)
   - Schema validation against schema.json
   - Check unique plugin ID across all namespaces
   - Verify GitHub repo exists and is public
   - Validate package.json structure
   - Run security scan on latest release
   - Check for LICENSE file
   - Verify pluginFile path matches namespace folder

5. Manual review by Allow2 team
   - Review metadata accuracy
   - Check for inappropriate content
   - Verify namespace ownership/trademark
   - Verify repository looks legitimate
   - Test basic plugin functionality
   - Approve or reject with feedback

6. Plugin published
   - Pull request merged
   - Plugin appears in registry with verification status
   - Available for installation by users
   - Trust indicators start accumulating

7. Namespace verification levels
   - @allow2: Official Allow2 plugins (verified by default)
   - @verified-publisher: Verified third-party publishers
   - @community: Community-contributed plugins
   - Custom namespaces: Require publisher verification

8. Ongoing maintenance
   - Publishers maintain their namespace folders
   - Version updates via new commits to namespace files
   - Registry automatically tracks plugin versions from Git tags
```

### 8.2 Namespace Application Process

For verified namespace ownership:

```
1. Submit namespace application
   - Company/organization name
   - Contact information
   - Proof of trademark/ownership
   - Intended plugin types

2. Verification review
   - Trademark validation
   - Background check
   - Publisher credentials

3. Namespace approval
   - Create @company-name folder
   - Add to verified publishers list
   - Grant commit access to namespace folder

4. Publisher responsibilities
   - Maintain plugin metadata files
   - Keep plugins.json synchronized
   - Follow submission guidelines
   - Respond to security issues
```

### 8.3 Submission API (Optional Future Enhancement)

```typescript
// /src/api/routes/submissions.ts

export class SubmissionRouter {
  async submitPlugin(req: Request, res: Response): Promise<void> {
    const {
      plugin_id,
      name,
      description,
      category,
      repository,
      submitter,
      permissions_required,
      tags
    } = req.body;

    // 1. Validate submission data
    const validation = await this.validateSubmission(req.body);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    // 2. Check if plugin_id is already taken
    const exists = await this.db.pluginExists(plugin_id);
    if (exists) {
      return res.status(409).json({
        error: 'Plugin ID already exists'
      });
    }

    // 3. Verify repository exists and is accessible
    try {
      await this.gitService.fetchRepoMetadata(repository.url);
    } catch (error) {
      return res.status(400).json({
        error: 'Repository not found or not accessible',
        details: error.message
      });
    }

    // 4. Run automated security scan
    const tempDir = await this.gitService.cloneRepo(
      `git+${repository.url}.git`,
      'HEAD'
    );
    const scanResult = await this.securityScanner.scanPlugin(tempDir);
    await this.gitService.cleanupTemp(tempDir);

    // 5. Create submission record
    const submission = await this.db.createSubmission({
      submitted_data: req.body,
      submitter_name: submitter.name,
      submitter_email: submitter.email,
      submitter_github: submitter.github,
      status: 'pending'
    });

    // 6. Store initial security scan
    await this.db.createSecurityScan({
      submission_id: submission.id,
      scan_type: 'initial_submission',
      status: 'completed',
      risk_level: scanResult.riskLevel,
      issues_found: scanResult.issues
    });

    // 7. Notify review team
    await this.notifyReviewTeam(submission);

    res.status(201).json({
      submission_id: submission.id,
      status: 'pending',
      estimated_review_time: '2-3 business days',
      message: 'Your plugin submission has been received and will be reviewed soon.'
    });
  }

  async approveSubmission(req: Request, res: Response): Promise<void> {
    const { submission_id } = req.params;
    const { reviewer_notes } = req.body;

    const submission = await this.db.getSubmission(submission_id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Create plugin record
    const plugin = await this.db.createPlugin({
      ...submission.submitted_data,
      status: 'approved',
      verification_level: 'unverified',
      approved_at: new Date()
    });

    // Sync versions from repository
    await this.versionManager.syncPluginVersions(plugin.plugin_id);

    // Fetch and store trust indicators
    const repoMetadata = await this.gitService.fetchRepoMetadata(
      plugin.repo_url
    );
    await this.db.createTrustIndicators({
      plugin_id: plugin.id,
      ...repoMetadata
    });

    // Calculate initial trust score
    const trustScore = await this.trustCalculator.calculateTrustScore(
      plugin,
      repoMetadata,
      { average_rating: 0, total_reviews: 0 }
    );
    await this.db.updatePlugin(plugin.id, { trust_score: trustScore });

    // Update submission status
    await this.db.updateSubmission(submission_id, {
      status: 'approved',
      plugin_id: plugin.id,
      reviewer_id: req.user.id,
      review_notes: reviewer_notes,
      reviewed_at: new Date()
    });

    // Notify submitter
    await this.notifySubmitter(submission, 'approved');

    res.json({
      message: 'Plugin approved and published',
      plugin_id: plugin.plugin_id
    });
  }
}
```

---

## 9. System Integration Architecture

### 9.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  Allow2Automate Desktop App                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Main UI     │  │  Plugin UI   │  │  Settings    │          │
│  │              │  │  (Store)     │  │              │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│  ┌────────────────────────▼──────────────────────────┐          │
│  │         Plugin Management Layer (Renderer)        │          │
│  │  - PluginStore (UI)                               │          │
│  │  - PluginList (Installed)                         │          │
│  │  - UpdateNotifications                            │          │
│  └────────────────────────┬──────────────────────────┘          │
│                           │ IPC                                 │
│  ┌────────────────────────▼──────────────────────────┐          │
│  │         Plugin Management Layer (Main)            │          │
│  │  - PluginInstaller                                │          │
│  │  - PluginManager (electron-plugin-manager)        │          │
│  │  - UpdateChecker                                  │          │
│  │  - SecurityScanner                                │          │
│  │  - GitService                                     │          │
│  └────────────────────────┬──────────────────────────┘          │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
    ┌─────────▼─────────┐       ┌────────▼──────────┐
    │  Registry API     │       │  Git Providers    │
    │  (allow2.com)     │       │  (GitHub, etc.)   │
    │                   │       │                   │
    │  - Plugin Search  │       │  - Clone Repos    │
    │  - Metadata API   │       │  - Fetch Tags     │
    │  - Version Info   │       │  - Get Metadata   │
    │  - Reviews        │       │                   │
    └───────────────────┘       └───────────────────┘
```

### 9.2 Data Flow

```
Installation Flow:
──────────────────────────────────────────────────────────────────
User searches "playstation" in Plugin Store
  ↓
App fetches search results from Registry API
  ↓
Registry API queries PostgreSQL database
  ↓
Returns plugin metadata + trust indicators
  ↓
User clicks "Install" on PlayStation plugin
  ↓
App fetches detailed plugin info from Registry API
  ↓
App shows install confirmation dialog with:
  - Verification level
  - Trust score
  - GitHub stats
  - Required permissions
  ↓
User confirms installation
  ↓
App (Main process) uses GitService to clone repo from GitHub
  ↓
SecurityScanner analyzes cloned code
  ↓
If security issues found, show warnings to user
  ↓
User confirms despite warnings (if applicable)
  ↓
PluginInstaller uses electron-plugin-manager to install
  ↓
Plugin installed in sandboxed environment
  ↓
Installation tracked in local SQLite database
  ↓
App reports installation to Registry API (analytics)
  ↓
Registry increments total_installs counter
  ↓
User can now use the plugin


Update Flow:
──────────────────────────────────────────────────────────────────
Background worker runs every 12 hours
  ↓
UpdateChecker fetches user's installed plugins
  ↓
For each plugin, fetch latest version from Registry API
  ↓
Registry API syncs with GitHub to get latest tags
  ↓
Compare installed version with latest version
  ↓
If newer version available:
  ↓
  Check if auto-update is enabled
  ↓
  If breaking changes, notify user instead of auto-updating
  ↓
  If security update, mark as critical priority
  ↓
  If auto-update enabled and safe:
    ↓
    Install new version using PluginInstaller
    ↓
    Show notification of successful update
  ↓
  If auto-update disabled:
    ↓
    Show update notification in UI
    ↓
    User can manually trigger update
```

---

## 10. Configuration & Deployment

### 10.1 Environment Variables

```bash
# Registry API Configuration
REGISTRY_API_URL=https://api.allow2.com/v1
REGISTRY_WS_URL=wss://api.allow2.com/v1/ws

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/allow2_plugins
REDIS_URL=redis://localhost:6379

# GitHub API (for fetching repo metadata)
GITHUB_API_TOKEN=ghp_xxxxxxxxxxxxx

# Security
PLUGIN_INSTALL_DIR=/var/lib/allow2automate/plugins
PLUGIN_TEMP_DIR=/tmp/allow2-plugin-installs
SANDBOX_ENABLED=true

# Background Workers
SYNC_INTERVAL_HOURS=6
UPDATE_CHECK_INTERVAL_HOURS=12
TRUST_SCORE_UPDATE_INTERVAL_HOURS=24

# Features
AUTO_UPDATE_ENABLED=true
SECURITY_SCANNING_ENABLED=true
TELEMETRY_ENABLED=true
```

### 10.2 Package.json Plugin Specification

```json
{
  "name": "@allow2automate/playstation-plugin",
  "version": "2.0.0",
  "description": "Control PlayStation consoles via PlayStation Network API",
  "main": "dist/index.js",
  "allow2automate": {
    "plugin": true,
    "pluginId": "allow2automate-playstation",
    "displayName": "PlayStation Parental Controls",
    "category": "Gaming",
    "permissions": ["network", "configuration"],
    "minAppVersion": "2.0.0",
    "api": {
      "actions": [
        {
          "id": "ps.setTimeLimit",
          "name": "Set Play Time Limit",
          "params": {
            "userId": "string",
            "minutes": "number"
          }
        },
        {
          "id": "ps.blockGame",
          "name": "Block Game",
          "params": {
            "gameId": "string"
          }
        }
      ],
      "triggers": [
        {
          "id": "ps.timeExceeded",
          "name": "Time Limit Exceeded",
          "data": {
            "userId": "string",
            "minutesPlayed": "number"
          }
        }
      ]
    }
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/johndoe/allow2automate-playstation.git"
  },
  "author": "John Doe <john@example.com>",
  "license": "MIT",
  "keywords": ["allow2automate", "playstation", "parental-control", "gaming"]
}
```

---

## 11. Monitoring & Analytics

### 11.1 Metrics to Track

```typescript
// /src/services/Analytics.ts

export interface PluginAnalytics {
  // Installation Metrics
  total_installs: number;
  total_uninstalls: number;
  active_installs: number;
  retention_rate: number;

  // Version Adoption
  version_distribution: {
    [version: string]: number;
  };
  update_adoption_rate: number; // % of users on latest version

  // Usage Metrics
  average_daily_active_users: number;
  average_actions_per_user: number;
  most_used_actions: {
    action_id: string;
    usage_count: number;
  }[];

  // Performance Metrics
  average_load_time_ms: number;
  error_rate: number;
  crash_rate: number;

  // User Satisfaction
  average_rating: number;
  total_reviews: number;
  review_sentiment: 'positive' | 'neutral' | 'negative';

  // Security
  security_incidents: number;
  permission_requests_denied: number;
}
```

### 11.2 Dashboard for Plugin Authors

```
Plugin Author Dashboard:
────────────────────────────────────────────────────────────────

Overview:
  - Total Installs: 1,234
  - Active Installs: 892 (72% retention)
  - Average Rating: 4.3 ★ (28 reviews)
  - Trust Score: 67.5
  - Verification Level: Community Verified

Version Adoption:
  - v2.0.0: 456 installs (51%)
  - v1.1.0: 320 installs (36%)
  - v1.0.0: 116 installs (13%)

Recent Activity:
  - 12 new installs today
  - 3 updates to v2.0.0
  - 1 new review (5 stars)

Issues:
  - 2 open GitHub issues
  - 1 crash report this week

Recommendations:
  - 🎯 51% of users on latest version - consider notifying others
  - ⚠️ 13% still on v1.0.0 - has known security issue
  - 💬 High rating but few reviews - encourage users to leave feedback
```

---

## 12. Future Enhancements

### 12.1 Phase 2 Features

1. **Plugin Marketplace Monetization**
   - Allow developers to charge for premium plugins
   - Revenue sharing model (70/30 split)
   - Subscription-based plugins

2. **Plugin Dependencies**
   - Allow plugins to depend on other plugins
   - Automatic dependency installation
   - Version compatibility checking

3. **Plugin Templates**
   - Official starter templates for common use cases
   - CLI tool: `npx create-allow2-plugin`

4. **Advanced Security**
   - Code signing for verified plugins
   - Automated security audits using AI
   - Bug bounty program

5. **Developer Tools**
   - Plugin debugger
   - Hot reload for development
   - Performance profiler

6. **Community Features**
   - Plugin showcase/gallery
   - Developer forums
   - Plugin of the month awards

---

## Conclusion

This architecture provides:

✅ **Decentralized code hosting** - No third-party code hosted by Allow2
✅ **Curated discovery** - Metadata registry for easy plugin search
✅ **Trust & Safety** - Multi-factor trust scoring and security scanning
✅ **Version control** - Git-based versioning with update notifications
✅ **User transparency** - Clear risk indicators before installation
✅ **Developer friendly** - Simple submission process, quick approval
✅ **Scalable** - Can support thousands of plugins
✅ **Secure** - Sandboxed execution with permission system

The system balances openness (anyone can publish) with safety (trust indicators, security scanning, sandboxing), providing users with the freedom to extend Allow2Automate while maintaining security and trust.
