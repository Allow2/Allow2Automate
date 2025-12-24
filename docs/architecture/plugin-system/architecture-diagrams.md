# Architecture Diagrams - Git-Based Plugin System

## C4 Model Architecture

### Level 1: System Context Diagram

```
                                    ┌─────────────────┐
                                    │                 │
                                    │  Plugin Author  │
                                    │                 │
                                    └────────┬────────┘
                                             │
                                             │ Submits plugins
                                             │ Reviews analytics
                                             ↓
┌──────────────┐                   ┌─────────────────┐
│              │                   │                 │
│   End User   │◄─────────────────►│ Allow2Automate  │
│              │  Uses app,        │   Application   │
└──────────────┘  installs plugins │                 │
                                   └────────┬────────┘
                                            │
                         ┌──────────────────┼──────────────────┐
                         │                  │                  │
                         ↓                  ↓                  ↓
              ┌──────────────────┐ ┌────────────────┐ ┌──────────────┐
              │                  │ │                │ │              │
              │  Plugin Registry │ │  Git Provider  │ │  Allow2 API  │
              │  API (Metadata)  │ │  (GitHub/BB)   │ │  (Auth/Data) │
              │                  │ │                │ │              │
              └──────────────────┘ └────────────────┘ └──────────────┘
```

**Key Interactions:**
- End users discover and install plugins through the app
- App fetches metadata from Plugin Registry API
- App downloads actual plugin code from Git providers
- Plugin authors submit metadata to registry and host code on Git
- Analytics flow from app to registry for trust scoring

---

### Level 2: Container Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        Allow2Automate Application                          │
│                           [Electron Desktop App]                           │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                          Renderer Process                            │  │
│  │                           [React + TypeScript]                       │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  • Plugin Store UI          • Settings UI                           │  │
│  │  • Plugin List UI           • Update Notifications                  │  │
│  │  • Install Dialog           • Security Warnings                     │  │
│  │                                                                       │  │
│  └───────────────────────────────┬─────────────────────────────────────┘  │
│                                  │ IPC                                     │
│  ┌───────────────────────────────▼─────────────────────────────────────┐  │
│  │                           Main Process                               │  │
│  │                           [Node.js + TypeScript]                     │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  ┌──────────────────┐  ┌───────────────────┐  ┌─────────────────┐  │  │
│  │  │ PluginInstaller  │  │  UpdateChecker    │  │ SecurityScanner │  │  │
│  │  └──────────────────┘  └───────────────────┘  └─────────────────┘  │  │
│  │                                                                       │  │
│  │  ┌──────────────────┐  ┌───────────────────┐  ┌─────────────────┐  │  │
│  │  │  GitService      │  │  PluginManager    │  │ AnalyticsService│  │  │
│  │  └──────────────────┘  └───────────────────┘  └─────────────────┘  │  │
│  │                                                                       │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │               Local Database (SQLite)                        │   │  │
│  │  │  • Installed plugins  • Update tracking  • User preferences  │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  │                                                                       │  │
│  └───────┬───────────────┬─────────────────────────────┬───────────────┘  │
│          │               │                             │                   │
└──────────┼───────────────┼─────────────────────────────┼───────────────────┘
           │               │                             │
           │               │                             │
           │ HTTPS         │ Git Protocol                │ WebSocket
           ↓               ↓                             ↓
  ┌────────────────┐  ┌────────────┐          ┌──────────────────┐
  │                │  │            │          │                  │
  │ Registry API   │  │ GitHub API │          │ Notification     │
  │ [Node.js/REST] │  │ Bitbucket  │          │ Service [WS]     │
  │                │  │ GitLab     │          │                  │
  └────────┬───────┘  └────────────┘          └──────────────────┘
           │
           ↓
  ┌────────────────┐
  │  PostgreSQL    │
  │  [Registry DB] │
  │                │
  │ • Plugins      │
  │ • Versions     │
  │ • Reviews      │
  │ • Analytics    │
  └────────────────┘
```

---

### Level 3: Component Diagram - Plugin Installation Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Plugin Installation System                      │
└────────────────────────────────────────────────────────────────────────┘

    User Action: "Install PlayStation Plugin"
           │
           ↓
    ┌──────────────────┐
    │  PluginStoreUI   │
    │                  │
    │  • Search        │
    │  • Display       │
    │  • User Actions  │
    └─────────┬────────┘
              │ IPC: installPlugin(pluginId)
              ↓
    ┌──────────────────┐
    │ PluginInstaller  │──────────────┐
    │                  │              │
    │ • Validate       │              │
    │ • Clone Repo     │              │
    │ • Security Scan  │              │
    │ • Install        │              │
    └─────────┬────────┘              │
              │                       │
              ├───────────────────────┼──────────────────────┐
              │                       │                      │
              ↓                       ↓                      ↓
    ┌──────────────────┐    ┌─────────────────┐   ┌──────────────────┐
    │   GitService     │    │ SecurityScanner │   │ RegistryClient   │
    │                  │    │                 │   │                  │
    │ • cloneRepo()    │    │ • scanPlugin()  │   │ • fetchMetadata()│
    │ • parseGitUrl()  │    │ • checkScripts()│   │ • reportInstall()│
    │ • fetchMetadata()│    │ • auditDeps()   │   │ • getVersions()  │
    │ • cleanupTemp()  │    │ • analyzeCode() │   │                  │
    └─────────┬────────┘    └────────┬────────┘   └─────────┬────────┘
              │                      │                      │
              ├──────────────────────┴──────────────────────┤
              │                                             │
              ↓                                             ↓
    ┌──────────────────┐                          ┌──────────────────┐
    │  electron-       │                          │  Local Database  │
    │  plugin-manager  │                          │  (SQLite)        │
    │                  │                          │                  │
    │ • install()      │                          │ • trackInstall() │
    │ • sandbox()      │                          │ • storeVersion() │
    │ • permissions()  │                          │ • updateStats()  │
    └──────────────────┘                          └──────────────────┘
```

---

### Level 4: Code Diagram - Security Scanning

```typescript
┌─────────────────────────────────────────────────────────────────────┐
│                         SecurityScanner                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  + scanPlugin(pluginDir: string): SecurityScanResult                │
│  - scanPackageJsonScripts(dir, issues): void                        │
│  - scanDependencies(dir, issues): void                              │
│  - scanSourceCode(dir, issues, warnings): void                      │
│  - checkPermissions(dir, warnings): void                            │
│  - calculateRiskLevel(issues): RiskLevel                            │
│                                                                       │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ uses
                      ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      SecurityScanResult                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  + riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical'      │
│  + issues: SecurityIssue[]                                          │
│  + warnings: string[]                                               │
│                                                                       │
└───────────────────────────────────────────────────────────┬─────────┘
                                                            │ contains
                                                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        SecurityIssue                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  + type: 'package_json_script' | 'dependency' | ...                │
│  + severity: 'low' | 'medium' | 'high' | 'critical'                │
│  + description: string                                              │
│  + location?: string                                                │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

Scanning Process Flow:
──────────────────────────────────────────────────────────────────────

  scanPlugin(pluginDir)
       │
       ├──► scanPackageJsonScripts()
       │         │
       │         ├─► Check for dangerous patterns
       │         │   • rm -rf
       │         │   • curl | sh
       │         │   • eval()
       │         │
       │         └─► Add issues to array
       │
       ├──► scanDependencies()
       │         │
       │         ├─► Run npm audit
       │         └─► Check for vulnerabilities
       │
       ├──► scanSourceCode()
       │         │
       │         ├─► Scan all .js/.ts files
       │         ├─► Match dangerous patterns
       │         └─► Add warnings
       │
       ├──► checkPermissions()
       │         │
       │         └─► Validate requested permissions
       │
       └──► calculateRiskLevel(issues)
                 │
                 └─► Return SecurityScanResult
```

---

## Data Flow Diagrams

### Plugin Discovery & Installation Flow

```
┌──────┐                                                         ┌──────────┐
│ User │                                                         │ Registry │
└──┬───┘                                                         │   API    │
   │                                                             └────┬─────┘
   │ 1. Search for "playstation"                                     │
   ├────────────────────────────────────────────────────────────────►│
   │                                                                  │
   │ 2. Return search results with metadata + trust indicators       │
   │◄─────────────────────────────────────────────────────────────────┤
   │                                                                  │
   │ 3. Click "Install" on plugin                                    │
   │                                                                  │
   │                                                                  │
   │                                                             ┌────▼─────┐
   │ 4. Fetch detailed plugin info + install URL                │ Database │
   ├────────────────────────────────────────────────────────────►├──────────┤
   │                                                             │ • Plugins│
   │ 5. Return install_url, versions, security status           │ • Trust  │
   │◄─────────────────────────────────────────────────────────────┤ • Reviews│
   │                                                             └──────────┘
   │
   │                                                             ┌──────────┐
   │ 6. Clone repository from GitHub                            │  GitHub  │
   ├────────────────────────────────────────────────────────────►│   API    │
   │                                                             └────┬─────┘
   │ 7. Return plugin code at specified tag                          │
   │◄─────────────────────────────────────────────────────────────────┤
   │                                                                  │
   │ 8. Run security scans locally                                   │
   │ ── [SecurityScanner processes code] ──                          │
   │                                                                  │
   │ 9. Show install confirmation with risks                         │
   │ ◄── [User reviews and confirms] ──                              │
   │                                                                  │
   │ 10. Install in sandbox                                          │
   │ ── [electron-plugin-manager installs] ──                        │
   │                                                                  │
   │ 11. Track installation locally                                  │
   │ ── [SQLite update] ──                                           │
   │                                                                  │
   │ 12. Report installation (analytics)                        ┌────▼─────┐
   ├────────────────────────────────────────────────────────────►│ Registry │
   │                                                             │   API    │
   │ 13. Increment install counter                              └──────────┘
   │◄─────────────────────────────────────────────────────────────┤
   │                                                                  │
   │ 14. Plugin ready to use                                         │
   └──────────────────────────────────────────────────────────────────
```

### Update Notification Flow

```
Background Worker (Runs every 12 hours)
┌────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  For each user with installed plugins:                             │
│                                                                      │
│  1. Fetch user's installed plugins from local DB                   │
│     ↓                                                               │
│  2. For each plugin:                                               │
│     ├─► Query Registry API for latest version                      │
│     │   ↓                                                           │
│     │   Registry syncs with GitHub to get latest tags              │
│     │   ↓                                                           │
│     │   Return latest version info                                 │
│     │                                                               │
│     ├─► Compare installed version vs. latest                       │
│     │   ↓                                                           │
│     │   If newer version available:                                │
│     │   ├─► Check if breaking changes                             │
│     │   ├─► Check if security update                              │
│     │   └─► Check if auto-update enabled                          │
│     │                                                               │
│     └─► If auto-update enabled AND safe:                          │
│         ├─► Install new version                                    │
│         ├─► Show notification of update                           │
│         └─► Log update in database                                │
│                                                                      │
│         If auto-update disabled OR breaking changes:               │
│         └─► Create notification for user                          │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘

                              ↓

┌────────────────────────────────────────────────────────────────────┐
│                        User Notification                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  In-App:                                                            │
│  • Badge on "Plugins" menu item                                    │
│  • List of available updates in Plugin Manager                    │
│  • "Update All" button (skips breaking changes)                   │
│                                                                      │
│  Push Notification (optional):                                     │
│  • "2 plugin updates available"                                    │
│                                                                      │
│  Critical Security Updates:                                        │
│  • Modal dialog on app startup                                     │
│  • Strongly encourage immediate update                             │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

### Trust Score Calculation Flow

```
Daily Background Worker
┌────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  For each approved plugin:                                         │
│                                                                      │
│  1. Fetch plugin metadata from database                            │
│  2. Fetch trust indicators from database                           │
│  3. Fetch reviews summary from database                            │
│     ↓                                                               │
│  4. Calculate component scores:                                    │
│                                                                      │
│     Repository Health (30%):                                       │
│     ├─► GitHub stars (max 30 pts)                                 │
│     ├─► Forks (max 20 pts)                                        │
│     ├─► Has license (20 pts)                                      │
│     └─► Low issue ratio (max 30 pts)                              │
│                                                                      │
│     Community Engagement (25%):                                    │
│     ├─► Total installs (max 40 pts)                               │
│     ├─► Retention rate (max 30 pts)                               │
│     └─► Active install ratio (max 30 pts)                         │
│                                                                      │
│     Security (20%):                                                │
│     ├─► Has security policy (+20 pts)                             │
│     ├─► Has code of conduct (+10 pts)                             │
│     └─► Verified author (+20 pts)                                 │
│                                                                      │
│     User Satisfaction (15%):                                       │
│     ├─► Average rating (max 60 pts)                               │
│     └─► Number of reviews (max 40 pts)                            │
│                                                                      │
│     Maintenance (10%):                                             │
│     ├─► Recent commit activity (max 50 pts)                       │
│     └─► Regular updates (max 50 pts)                              │
│     ↓                                                               │
│  5. Calculate weighted average                                     │
│     ↓                                                               │
│  6. Apply penalties:                                               │
│     ├─► High uninstall rate (-10 to -20 pts)                      │
│     ├─► Stale repository (-15 to -30 pts)                         │
│     └─► Young repository (-10 to -20 pts)                         │
│     ↓                                                               │
│  7. Determine verification level:                                  │
│     ├─► Score >= 70 + criteria → "community"                      │
│     ├─► Manual review → "verified"                                │
│     └─► Default → "unverified"                                    │
│     ↓                                                               │
│  8. Update plugin record in database                               │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘

Example Calculation:
────────────────────────────────────────────────────────────────────
Plugin: allow2automate-playstation

  Repository Health (30%):
    Stars: 42 → 4.2 pts
    Forks: 8 → 1.6 pts
    License: Yes → 20 pts
    Issues: 3/8 = 0.375 → 26.25 pts
    Subtotal: 52.05 pts

  Community Engagement (25%):
    Installs: 1234 → 12.34 pts
    Retention: 72% → 21.6 pts
    Active: 892/1234 = 72% → 21.6 pts
    Subtotal: 55.54 pts

  Security (20%):
    Security policy: No → 0 pts
    Code of conduct: No → 0 pts
    Verified author: No → 0 pts
    Subtotal: 0 pts

  User Satisfaction (15%):
    Rating: 4.3/5 → 51.6 pts
    Reviews: 28 → 28 pts
    Subtotal: 79.6 pts

  Maintenance (10%):
    Last commit: 7 days ago → 50 pts
    Update freq: 21 days → 40 pts
    Subtotal: 90 pts

  Weighted Score:
    52.05 * 0.30 = 15.62
    55.54 * 0.25 = 13.89
    0.00 * 0.20 = 0.00
    79.60 * 0.15 = 11.94
    90.00 * 0.10 = 9.00
    ─────────────────────
    Total: 50.45

  Penalties:
    Uninstall rate: 15% → 0 pts penalty
    Stale: 7 days → 0 pts penalty
    Age: 365 days → 0 pts penalty

  Final Score: 50.45 → 50 (rounded)

  Verification Level: unverified
    (needs 70+ and other criteria for "community")
```

---

## Deployment Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        Production Deployment                        │
└────────────────────────────────────────────────────────────────────┘

Desktop Application (Electron):
────────────────────────────────────────────────────────────────────
• Distributed as:
  - Windows: .exe installer
  - macOS: .dmg / .pkg
  - Linux: .deb / .AppImage

• Auto-update via Electron-updater
• Local SQLite database for user data
• Sandboxed plugin execution


Registry API (Cloud):
────────────────────────────────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer                            │
└────────────────┬────────────────────────────────────────────────┘
                 │
     ┌───────────┼───────────┐
     │           │           │
     ↓           ↓           ↓
┌─────────┐ ┌─────────┐ ┌─────────┐
│  API     │ │  API     │ │  API     │
│  Server  │ │  Server  │ │  Server  │
│  Node 1  │ │  Node 2  │ │  Node 3  │
└─────┬────┘ └─────┬────┘ └─────┬────┘
      │            │            │
      └────────────┼────────────┘
                   │
         ┌─────────▼──────────┐
         │  PostgreSQL        │
         │  (Primary/Replica) │
         └────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  Redis Cache       │
         │  (Session/Cache)   │
         └────────────────────┘


Background Workers:
────────────────────────────────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────┐
│  Worker Node 1: Plugin Sync Worker                              │
│  • Syncs plugin versions from Git every 6 hours                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Worker Node 2: Trust Score Calculator                          │
│  • Recalculates trust scores daily                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Worker Node 3: Trust Indicator Updater                         │
│  • Fetches GitHub stats daily                                   │
└─────────────────────────────────────────────────────────────────┘


Monitoring & Observability:
────────────────────────────────────────────────────────────────────
• Application Performance Monitoring (APM)
• Error tracking (Sentry)
• Log aggregation (CloudWatch / Datadog)
• Uptime monitoring
• Security scanning (Snyk)
```

---

## Security Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                      Security Layers                               │
└────────────────────────────────────────────────────────────────────┘

Layer 1: Code Source Verification
──────────────────────────────────────────────────────────────────────
• Plugin code ONLY from approved Git providers
• Verify Git URL matches registry metadata
• Check SSL certificates on clone
• Validate Git tags match expected versions

Layer 2: Static Analysis (Pre-Installation)
──────────────────────────────────────────────────────────────────────
• Package.json script scanning
  ├─► Dangerous commands (rm -rf, curl | sh)
  ├─► Environment variable access
  └─► Process spawning

• Dependency vulnerability scanning
  ├─► npm audit / Snyk
  └─► Known CVE database

• Source code pattern matching
  ├─► eval() usage
  ├─► File system access
  ├─► Network calls
  └─► Child process spawning

Layer 3: User Disclosure
──────────────────────────────────────────────────────────────────────
• Display security scan results
• Show required permissions clearly
• Trust score and verification badge
• GitHub repository health indicators
• "Install anyway" confirmation for high-risk

Layer 4: Runtime Sandboxing
──────────────────────────────────────────────────────────────────────
• Separate process for each plugin
• File system restrictions
  ├─► Only plugin's own directory
  └─► App's plugin data directory

• Network restrictions
  ├─► Only if "network" permission granted
  ├─► Block localhost
  └─► Block private IP ranges

• API restrictions
  ├─► Whitelist of allowed Node.js modules
  ├─► Proxy for sensitive APIs
  └─► Permission checks before execution

• Resource limits
  ├─► Max CPU: 50%
  ├─► Max memory: 512MB
  └─► Max execution time per action

Layer 5: Monitoring & Anomaly Detection
──────────────────────────────────────────────────────────────────────
• Track plugin behavior
  ├─► File access patterns
  ├─► Network requests
  └─► API calls

• Detect anomalies
  ├─► Unexpected network activity
  ├─► Excessive resource usage
  └─► Permission violations

• Auto-disable on suspicious activity
• Alert user and allow2 team

Layer 6: Update Security
──────────────────────────────────────────────────────────────────────
• Re-scan on every update
• Block auto-update if security risk increases
• Notify users of security-related updates
• Require user confirmation for major version changes
```

