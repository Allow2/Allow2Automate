# Remote Process Monitoring Architecture Decision

**Date**: 2025-12-29
**Status**: Analysis Complete - Recommendation Provided
**Context**: Epic Games & Steam integration require process monitoring for parental controls
**Problem**: allow2automate is a userspace application - how do we monitor processes on remote child machines?

---

## Executive Summary

### The Core Question
**"How do we monitor gaming processes if allow2automate is not installed on the machine running these platforms?"**

After analyzing the current architecture and existing SSH capabilities in the `allow2automate-cmd` plugin, we have identified four viable approaches with different security, reliability, and implementation trade-offs.

### Recommendation
**Option 2: Lightweight Helper Service (`allow2automate-agent`)**

This approach balances security, reliability, and user experience by deploying a minimal system service on the child's machine that communicates with the parent's allow2automate instance via secure HTTPS API.

**Why this is the best choice:**
- ✅ No SSH credential management or network dependency during enforcement
- ✅ Local process monitoring (most reliable)
- ✅ Minimal footprint on child's machine
- ✅ Secure HTTPS communication with parent's allow2automate
- ✅ No visible UI on child's machine (stealth mode)
- ✅ Automatic startup as system service
- ✅ Can work offline with cached policies

---

## Current Architecture Analysis

### allow2automate Deployment Model
From `/mnt/ai/automate/automate/README.md`:

```
This is a userspace app for Mac OSX, Linux and Windows that can be deployed to all relevant
App Stores for these platforms.

The intention is:
1. Provide a base, self contained Electron User Space App that:
    * Provides a fully self-contained app to run in user space with no elevated privileges.
    * Manages an overall user connection to the API back end (rest based)
    * Allows the user to see and monitor Wemo, Homekit and other devices on the local network
    * Switched to a pluggable architecture to support other integrations
2. Provide a separate capability to detect (and authenticate against?) a separate elevated daemon service that runs
on system boot.
3. Includes the ability to automatically install the elevated daemon service where the relevant App Store
allows the binary to provide that capability.
```

**Key Points:**
- **Userspace Electron app** (no elevated privileges)
- **REST API backend** for central management
- **Optional elevated daemon** capability exists
- **Pluggable architecture** for integrations

### Existing SSH Capabilities

The `allow2automate-cmd` plugin (`/mnt/ai/automate/automate/dev-plugins/allow2automate-cmd/`) already provides:

**From `ScriptManager.js` (lines 129-217):**
```javascript
executeSSH(script, params = {}, sshConfig, options = {}) {
    return new Promise((resolve, reject) => {
        const renderedScript = this.substituteParameters(script, params);
        const conn = new SSHClient();

        conn.on('ready', () => {
            conn.exec(renderedScript, (err, stream) => {
                // Execute command and capture stdout/stderr
            });
        });

        conn.connect({
            host: sshConfig.host,
            port: sshConfig.port || 22,
            username: sshConfig.username,
            password: sshConfig.password,
            privateKey: sshConfig.privateKey,
            passphrase: sshConfig.passphrase,
            readyTimeout: options.timeout || 30000
        });
    });
}
```

**Capabilities:**
- ✅ SSH2 library already integrated
- ✅ Password and private key authentication
- ✅ Command execution with stdout/stderr capture
- ✅ Connection testing (`testSSHConnection()`)
- ✅ Mustache template parameter substitution
- ✅ Auto-detect local vs SSH execution

**Existing Use Cases:**
- Execute remote scripts on schedule
- Trigger commands based on Allow2 state changes
- Remote system administration tasks

---

## Option 1: Remote SSH via allow2automate-cmd Plugin

### Architecture
```
┌─────────────────────────────┐
│   Parent's Computer         │
│  ┌───────────────────────┐  │         SSH (port 22)
│  │  allow2automate       │  ├──────────────────────┐
│  │  (Electron app)       │  │                      │
│  │                       │  │                      ▼
│  │  ┌─────────────────┐  │  │         ┌────────────────────────┐
│  │  │ cmd plugin      │  │  │         │  Child's Computer      │
│  │  │ (SSH client)    │  │  │         │                        │
│  │  └─────────────────┘  │  │         │  ┌──────────────────┐  │
│  └───────────────────────┘  │         │  │ SSH Server       │  │
└─────────────────────────────┘         │  │ (OpenSSH/etc)    │  │
                                        │  └──────────────────┘  │
                                        │                        │
                                        │  Steam.exe / Epic...   │
                                        └────────────────────────┘
```

### Implementation Details

**Process Monitoring Scripts:**
```bash
# Windows - Check if Steam is running
tasklist /FI "IMAGENAME eq Steam.exe" | find /I "Steam.exe"

# Windows - Kill Steam
taskkill /F /IM Steam.exe

# Linux/Mac - Check if Steam is running
ps aux | grep -i steam | grep -v grep

# Linux/Mac - Kill Steam
pkill -9 -i steam
```

**allow2automate-cmd Configuration:**
```json
{
  "scripts": {
    "check-steam": {
      "name": "Check Steam Process",
      "script": "tasklist /FI \"IMAGENAME eq Steam.exe\" | find /I \"Steam.exe\"",
      "useSSH": true,
      "sshConfig": {
        "host": "child-pc.local",
        "port": 22,
        "username": "monitoring",
        "privateKey": "/path/to/id_rsa"
      }
    },
    "kill-steam": {
      "name": "Terminate Steam",
      "script": "taskkill /F /IM Steam.exe",
      "useSSH": true,
      "sshConfig": { /* same as above */ }
    }
  },
  "monitors": {
    "steam-monitor": {
      "type": "interval",
      "interval": 60000,
      "scriptId": "check-steam",
      "onDetected": "kill-steam"
    }
  }
}
```

### Pros
- ✅ **Leverage existing infrastructure** - cmd plugin already has SSH capabilities
- ✅ **No software on child's machine** - only SSH server (often pre-installed)
- ✅ **Centralized control** - all logic runs on parent's machine
- ✅ **Fast implementation** - 2-3 weeks to create Steam/Epic plugins using cmd plugin
- ✅ **Parent has full visibility** - all logs and events on parent's machine

### Cons
- ❌ **Network dependency** - SSH must be accessible (firewall, VPN, internet issues)
- ❌ **SSH credential management** - password or private key storage security concern
- ❌ **Latency** - network round-trip for every check (1-5 seconds)
- ❌ **SSH server requirement** - must configure and secure SSH on child's machine
- ❌ **Firewall complexity** - port forwarding, dynamic DNS for remote access
- ❌ **Child can disable SSH** - tech-savvy child could stop SSH service
- ❌ **Polling inefficiency** - must poll every 30-60 seconds, not real-time

### Security Implications
| Aspect | Risk Level | Details |
|--------|-----------|---------|
| **Credential Storage** | 🔴 HIGH | Private keys or passwords stored on parent's machine - if compromised, full SSH access to child's PC |
| **Network Exposure** | 🟡 MEDIUM | SSH port must be open (port 22) - potential attack vector if misconfigured |
| **Man-in-the-Middle** | 🟢 LOW | SSH encryption protects data in transit, but relies on proper key verification |
| **Child Tampering** | 🔴 HIGH | Child with admin access can disable SSH server, change SSH config, or block firewall |

### Reliability Analysis
| Scenario | Impact | Mitigation |
|----------|--------|------------|
| **Network outage** | 🔴 CRITICAL | Process monitoring stops entirely - cannot enforce controls | None - requires network |
| **SSH service crash** | 🔴 CRITICAL | Cannot monitor or enforce | Watchdog to restart SSH (child can disable) |
| **Firewall changes** | 🔴 CRITICAL | SSH blocked - no enforcement | Port knocking, VPN fallback |
| **Dynamic IP changes** | 🟡 MEDIUM | Connection lost | Dynamic DNS, periodic IP updates |

### Implementation Complexity: **LOW** (2-3 weeks)
- Existing cmd plugin handles SSH
- Create process monitoring scripts
- Configure polling intervals
- Add Steam/Epic process detection logic

---

## Option 2: Lightweight Helper Service (`allow2automate-agent`)

### Architecture
```
┌─────────────────────────────┐
│   Parent's Computer         │         HTTPS API (port 443)
│  ┌───────────────────────┐  │         Encrypted JSON
│  │  allow2automate       │  ├──────────────────────┐
│  │  (Electron app)       │  │                      │
│  │                       │  │                      ▼
│  │  REST API Server      │  │         ┌────────────────────────┐
│  │  (Express/Fastify)    │  │         │  Child's Computer      │
│  └───────────────────────┘  │         │                        │
└─────────────────────────────┘         │  ┌──────────────────┐  │
                                        │  │ allow2automate-  │  │
                                        │  │ agent            │  │
                                        │  │ (System Service) │  │
                                        │  │                  │  │
                                        │  │ - Process Monitor│  │
                                        │  │ - Process Killer │  │
                                        │  │ - Policy Cache   │  │
                                        │  │ - HTTPS Client   │  │
                                        │  └──────────────────┘  │
                                        │                        │
                                        │  Steam.exe / Epic...   │
                                        └────────────────────────┘
```

### Technical Design

**allow2automate-agent Service Specifications:**
```
Language: Node.js (or Go/Rust for smaller footprint)
Size: ~5-15 MB installed
Privileges: System service (runs as LocalSystem/root)
Auto-start: Yes (systemd/launchd/Windows Service)
UI: None (headless service)
Configuration: JSON file + HTTPS API from parent
Communication: HTTPS REST API to parent's allow2automate
Logging: Local file + optional remote logging
```

**Process Monitoring Implementation:**
```javascript
// Pseudo-code for agent process monitor
class ProcessMonitor {
  constructor(config) {
    this.policies = config.policies; // Cached from parent
    this.parentApiUrl = config.parentApiUrl;
    this.authToken = config.authToken;
  }

  async monitorLoop() {
    while (true) {
      for (const policy of this.policies) {
        const isRunning = await this.checkProcess(policy.processName);

        if (isRunning && !policy.allowed) {
          console.log(`Terminating unauthorized process: ${policy.processName}`);
          await this.killProcess(policy.processName);
          await this.reportViolation(policy);
        }
      }
      await sleep(policy.checkInterval || 30000); // 30 sec default
    }
  }

  async checkProcess(name) {
    // Platform-specific process check
    if (process.platform === 'win32') {
      const output = await exec(`tasklist /FI "IMAGENAME eq ${name}"`);
      return output.includes(name);
    } else {
      const output = await exec(`pgrep -i ${name}`);
      return output.length > 0;
    }
  }

  async killProcess(name) {
    if (process.platform === 'win32') {
      await exec(`taskkill /F /IM ${name}`);
    } else {
      await exec(`pkill -9 -i ${name}`);
    }
  }

  async reportViolation(policy) {
    try {
      await fetch(`${this.parentApiUrl}/api/violations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: this.agentId,
          policyId: policy.id,
          processName: policy.processName,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      // Cache violation for later sync if network unavailable
      this.cacheViolation(policy);
    }
  }
}
```

**Parent API Endpoints:**
```javascript
// In parent's allow2automate app
app.post('/api/agent/register', authenticateAgent, async (req, res) => {
  // Register new agent, issue auth token
  const agent = await Agent.create({
    machineId: req.body.machineId,
    childId: req.body.childId,
    platform: req.body.platform
  });

  res.json({
    agentId: agent.id,
    authToken: jwt.sign({ agentId: agent.id }, SECRET),
    policies: await getPoliciesForChild(req.body.childId)
  });
});

app.get('/api/agent/policies', authenticateAgent, async (req, res) => {
  // Return current policies for this agent's child
  const policies = await getPoliciesForAgent(req.agentId);
  res.json({ policies });
});

app.post('/api/violations', authenticateAgent, async (req, res) => {
  // Log violation event
  await Violation.create({
    agentId: req.agentId,
    policyId: req.body.policyId,
    processName: req.body.processName,
    timestamp: req.body.timestamp
  });

  // Notify parent in real-time
  notifyParent(req.agentId, req.body);

  res.json({ success: true });
});
```

**Installation Flow:**
1. Parent downloads `allow2automate-agent` installer from allow2automate UI
2. Parent copies installer to child's machine (USB, network share, etc.)
3. Installer runs on child's machine:
   - Prompts for parent's allow2automate URL (e.g., `https://192.168.1.100:8443`)
   - Prompts for registration code (6-digit code from parent's UI)
   - Installs service, starts automatically
4. Agent registers with parent's API, receives policies and auth token
5. Agent starts monitoring processes

### Pros
- ✅ **Local process monitoring** - no network latency, most reliable
- ✅ **Works offline** - cached policies continue enforcement even if parent's machine offline
- ✅ **No SSH** - simpler security model (HTTPS with JWT tokens)
- ✅ **Real-time enforcement** - can monitor every 5-10 seconds vs SSH polling every 60 seconds
- ✅ **Minimal footprint** - 5-15 MB vs full allow2automate install (~200 MB)
- ✅ **No UI** - child doesn't see any application running (stealth mode)
- ✅ **System service** - starts automatically on boot, harder for child to disable
- ✅ **Platform consistency** - same codebase for Windows, Mac, Linux

### Cons
- ❌ **Software installation required** - must deploy agent to child's machine
- ❌ **Development effort** - 6-8 weeks to build, test, and package agent
- ❌ **Update management** - must version and update agent across multiple machines
- ❌ **Parent API surface** - parent's allow2automate must expose HTTPS API (security considerations)
- ❌ **Child can uninstall** - if child has admin access, could remove service
- ❌ **Multi-machine complexity** - parent must manage multiple agent connections

### Security Implications
| Aspect | Risk Level | Details |
|--------|-----------|---------|
| **Authentication** | 🟢 LOW | JWT tokens with expiry, registration codes, mutual TLS possible |
| **Data in Transit** | 🟢 LOW | HTTPS encryption, certificate pinning optional |
| **Privilege Escalation** | 🟡 MEDIUM | Agent runs as system service - must be carefully coded to prevent exploits |
| **Agent Tampering** | 🟡 MEDIUM | Child with admin can stop service, but harder than SSH (no visible UI) |
| **Parent API Exposure** | 🟡 MEDIUM | Parent must expose API port (443/8443) - firewall rules, IP whitelist recommended |

### Reliability Analysis
| Scenario | Impact | Mitigation |
|----------|--------|------------|
| **Network outage** | 🟢 LOW | Agent continues with cached policies | Periodic sync when network available |
| **Agent service crash** | 🟡 MEDIUM | Monitoring stops until restart | Watchdog process, auto-restart on failure |
| **Parent offline** | 🟢 LOW | Agent uses cached policies | Grace period (24-48 hours) before disabling |
| **Child stops service** | 🔴 HIGH | No enforcement | Service dependency chains, parent notification on agent disconnect |

### Implementation Complexity: **MEDIUM** (6-8 weeks)
1. **Week 1-2:** Agent core (process monitoring, policy engine)
2. **Week 3-4:** Parent API integration (registration, policy sync, violations)
3. **Week 5-6:** Installers (Windows MSI, Mac PKG, Linux DEB/RPM)
4. **Week 7-8:** Testing, security audit, documentation

---

## Option 3: Full allow2automate on Child's Machine

### Architecture
```
┌─────────────────────────────┐         ┌────────────────────────┐
│   Parent's Computer         │         │  Child's Computer      │
│  ┌───────────────────────┐  │         │                        │
│  │  allow2automate       │  │         │  ┌──────────────────┐  │
│  │  (Parent Mode)        │  │         │  │ allow2automate   │  │
│  │                       │  │         │  │ (Child Mode)     │  │
│  │  - Full UI access     │  │         │  │                  │  │
│  │  - Policy management  │◄├─────────┤►─│  - Restricted UI │  │
│  │  - Child linking      │  │  API    │  │  - Process Mon.  │  │
│  └───────────────────────┘  │  Sync   │  │  - Local enforce │  │
└─────────────────────────────┘         │  └──────────────────┘  │
                                        │                        │
                                        │  Steam.exe / Epic...   │
                                        └────────────────────────┘
```

### Implementation Details

**Child Mode Configuration:**
```json
{
  "mode": "child",
  "linkedToParent": {
    "parentId": "parent-machine-uuid",
    "childUserId": "child-user-uuid",
    "syncUrl": "https://parent-ip:8443/api/sync",
    "authToken": "jwt-token-here"
  },
  "ui": {
    "restricted": true,
    "allowedViews": ["status", "time-remaining"],
    "disabledViews": ["settings", "plugins", "policies"]
  },
  "processMonitoring": {
    "enabled": true,
    "checkInterval": 10000,
    "monitoredProcesses": ["Steam.exe", "EpicGamesLauncher.exe"]
  }
}
```

**Feature Comparison:**
| Feature | Parent Mode | Child Mode |
|---------|-------------|------------|
| **Full UI** | ✅ Yes | ⚠️ Restricted (read-only) |
| **Policy Management** | ✅ Yes | ❌ No (synced from parent) |
| **Plugin Installation** | ✅ Yes | ❌ No |
| **Process Monitoring** | ⚠️ Optional | ✅ Yes |
| **Local Enforcement** | ⚠️ Optional | ✅ Yes |
| **Disk Space** | ~200 MB | ~200 MB |
| **Visible to Child** | N/A | ✅ Yes (system tray icon) |

### Pros
- ✅ **Feature parity** - all monitoring capabilities available
- ✅ **Consistent codebase** - same Electron app with mode flag
- ✅ **Rich logging** - full UI for troubleshooting
- ✅ **Plugin ecosystem** - can use any allow2automate plugin
- ✅ **Future-proof** - can add features without agent updates

### Cons
- ❌ **Large footprint** - ~200 MB Electron app vs 5-15 MB agent
- ❌ **Visible to child** - system tray icon, visible in task manager
- ❌ **Child can close** - easier to quit than system service
- ❌ **UI complexity** - must maintain child mode UI restrictions
- ❌ **Confusing UX** - two allow2automate installs can confuse users
- ❌ **Resource usage** - Electron app uses more CPU/RAM than lightweight agent

### Security Implications
| Aspect | Risk Level | Details |
|--------|-----------|---------|
| **UI Bypass** | 🟡 MEDIUM | Child could potentially access restricted views via developer tools |
| **Process Visibility** | 🔴 HIGH | Visible in system tray and task manager - child knows it's running |
| **Easy to Close** | 🔴 HIGH | Child can right-click system tray and quit (unless process protection added) |
| **Developer Tools** | 🟡 MEDIUM | Electron dev tools could be exploited to bypass restrictions |

### Reliability Analysis
| Scenario | Impact | Mitigation |
|----------|--------|------------|
| **Child quits app** | 🔴 CRITICAL | No enforcement | Auto-restart on close, hide quit option |
| **Child kills process** | 🔴 CRITICAL | No enforcement | Watchdog process, require admin password to quit |
| **Resource exhaustion** | 🟡 MEDIUM | Electron can use significant resources | Optimize, use hardware acceleration |

### Implementation Complexity: **MEDIUM-HIGH** (8-10 weeks)
1. **Week 1-2:** Child mode UI restrictions
2. **Week 3-4:** Parent-child sync protocol
3. **Week 5-6:** Process monitoring in Electron
4. **Week 7-8:** Auto-update for child mode
5. **Week 9-10:** Security hardening (prevent quit, dev tools)

---

## Option 4: Hybrid Approaches

### 4A: SSH + Local Watchdog
```
Parent's allow2automate uses SSH to deploy a small watchdog script on child's machine.
Watchdog runs as cron job/scheduled task, monitors processes locally, reports violations via HTTPS.
```

**Pros:**
- ✅ Combines SSH simplicity with local monitoring reliability
- ✅ No full agent installation

**Cons:**
- ❌ Still requires SSH for initial deployment
- ❌ Watchdog can be deleted by child

### 4B: Agent + SSH Fallback
```
Primary: allow2automate-agent runs on child's machine
Fallback: If agent disconnects, parent uses SSH to check status and restart agent
```

**Pros:**
- ✅ Resilient to agent failures
- ✅ SSH as backup, not primary

**Cons:**
- ❌ Complexity of maintaining both systems
- ❌ SSH credential storage still required

### 4C: Browser-Based Remote Desktop
```
Parent's allow2automate uses Chrome Remote Desktop API to check processes on child's machine
```

**Pros:**
- ✅ No SSH server required
- ✅ Leverage existing remote desktop software

**Cons:**
- ❌ Requires Chrome Remote Desktop installed and running
- ❌ Not designed for automation (brittle)
- ❌ Privacy concerns (screen recording)

---

## Detailed Comparison Matrix

| Criteria | SSH (Option 1) | Agent (Option 2) | Full Install (Option 3) | Hybrid (Option 4) |
|----------|---------------|-----------------|------------------------|------------------|
| **Implementation Time** | 🟢 2-3 weeks | 🟡 6-8 weeks | 🔴 8-10 weeks | 🔴 10-12 weeks |
| **Reliability (Network)** | 🔴 Requires network | 🟢 Works offline | 🟢 Works offline | 🟡 Mixed |
| **Security** | 🔴 SSH credentials | 🟢 JWT tokens | 🟡 UI bypass risk | 🟡 Mixed |
| **Child Visibility** | 🟢 Hidden | 🟢 Hidden | 🔴 Visible | 🟡 Mixed |
| **Resource Usage** | 🟢 None on child | 🟢 Low (5-15 MB) | 🔴 High (~200 MB) | 🟡 Medium |
| **Maintenance** | 🟢 Low | 🟡 Medium | 🟡 Medium | 🔴 High |
| **Parent Complexity** | 🟢 Low | 🟡 Medium (API) | 🟡 Medium (sync) | 🔴 High |
| **Child Can Disable** | 🔴 Easy (stop SSH) | 🟡 Harder (service) | 🔴 Easy (quit app) | 🟡 Mixed |
| **Works Remotely** | 🟡 Yes (VPN/port fwd) | 🟢 Yes (HTTPS) | 🟢 Yes (HTTPS) | 🟡 Mixed |
| **Latency** | 🔴 High (network) | 🟢 Low (local) | 🟢 Low (local) | 🟡 Mixed |

---

## Security Deep Dive

### Threat Model: Child Attempts to Bypass Monitoring

| Attack Vector | Option 1: SSH | Option 2: Agent | Option 3: Full App | Option 4: Hybrid |
|---------------|---------------|----------------|-------------------|-----------------|
| **Stop service** | 🔴 Stop SSH service → monitoring stops | 🟡 Stop agent service → parent notified, requires admin | 🔴 Quit app → monitoring stops | 🟡 Depends on implementation |
| **Firewall block** | 🔴 Block port 22 → monitoring stops | 🟡 Block port 443 → agent uses cached policies | 🟡 Block port 443 → app uses cached policies | 🟡 Mixed |
| **Uninstall** | 🟢 Cannot uninstall SSH (OS-level) | 🟡 Can uninstall agent (requires admin) | 🟡 Can uninstall app (requires admin) | 🟡 Mixed |
| **Process hiding** | 🟡 SSH can still detect via `tasklist` | 🟢 Agent has elevated privileges | 🟢 App has elevated privileges | 🟡 Mixed |
| **Credential theft** | 🔴 SSH private key theft = full access to child's PC | 🟢 JWT token theft = limited to API access | 🟢 JWT token theft = limited to API access | 🔴 SSH key risk remains |

### Recommended Security Measures by Option

**Option 1 (SSH):**
1. Use SSH key authentication (not passwords)
2. Restrict SSH key to specific commands (`ForceCommand` in `sshd_config`)
3. Use bastion host / jump server
4. Enable SSH connection logging
5. Two-factor authentication for SSH
6. Firewall rules: only parent IP allowed

**Option 2 (Agent):**
1. JWT tokens with 7-day expiry
2. Mutual TLS (client certificates)
3. IP whitelist: only parent's IP allowed
4. Service runs as `NT AUTHORITY\SYSTEM` (Windows) or `root` (Linux/Mac)
5. Code signing for agent binary
6. Watchdog process to restart agent if stopped
7. Tamper detection: hash verification of agent binary

**Option 3 (Full App):**
1. Disable Electron developer tools in production
2. Child mode: password required to access settings
3. Auto-restart on quit (watchdog process)
4. Hide quit option from system tray
5. Require admin password to uninstall
6. Child mode UI: content security policy (CSP)

---

## Recommended Architecture: Option 2 (Lightweight Agent)

### Why Option 2 is the Best Choice

After analyzing security, reliability, implementation complexity, and user experience, **Option 2: Lightweight Helper Service (`allow2automate-agent`)** is the recommended approach.

**Decision Rationale:**

1. **Reliability First**: Local process monitoring eliminates network dependency during enforcement. The agent continues working even if the parent's machine is offline (using cached policies).

2. **Security**: JWT tokens with expiry are more secure than managing SSH credentials. The agent's minimal codebase reduces attack surface compared to full Electron app.

3. **User Experience**: The agent is invisible to the child (no UI, no system tray icon), making it harder to circumvent. Parents only interact with the main allow2automate app.

4. **Reasonable Implementation**: 6-8 weeks is acceptable given the long-term benefits. The agent can be reused for other monitoring needs beyond Steam/Epic.

5. **Scalability**: Parents can manage multiple child machines easily through the central allow2automate UI. Each agent reports to the same parent API.

6. **Future-Proof**: The agent architecture allows adding new monitoring capabilities (screen time, website blocking, etc.) without requiring SSH or full app installs.

### Implementation Roadmap

#### Phase 1: Agent Core (Weeks 1-3)
**Deliverables:**
- Node.js process monitoring library
- Platform-specific process detection (Windows `tasklist`, macOS/Linux `ps`)
- Process termination logic (`taskkill` / `pkill`)
- Local policy cache (JSON file)
- Configuration file parser

**File Structure:**
```
allow2automate-agent/
├── package.json
├── src/
│   ├── index.js              # Entry point, service initialization
│   ├── ProcessMonitor.js     # Core monitoring logic
│   ├── PolicyEngine.js       # Policy evaluation
│   ├── ApiClient.js          # Parent API communication
│   ├── LocalCache.js         # Offline policy storage
│   └── platform/
│       ├── windows.js        # Windows process APIs
│       ├── darwin.js         # macOS process APIs
│       └── linux.js          # Linux process APIs
├── config/
│   └── default.json          # Default configuration
└── tests/
    └── *.test.js
```

**Key Code:**
```javascript
// src/ProcessMonitor.js
class ProcessMonitor {
  constructor(policyEngine, apiClient) {
    this.policyEngine = policyEngine;
    this.apiClient = apiClient;
    this.platform = require(`./platform/${process.platform}`);
  }

  async start() {
    console.log('[Agent] Starting process monitoring...');

    while (true) {
      const policies = await this.policyEngine.getActivePolicies();

      for (const policy of policies) {
        const isRunning = await this.platform.isProcessRunning(policy.processName);

        if (isRunning && !policy.allowed) {
          console.log(`[Agent] Terminating unauthorized process: ${policy.processName}`);
          await this.platform.killProcess(policy.processName);
          await this.apiClient.reportViolation(policy);
        }
      }

      await sleep(policy.checkInterval || 30000);
    }
  }
}
```

#### Phase 2: Parent API Integration (Weeks 4-5)
**Deliverables:**
- REST API endpoints in parent's allow2automate app
- Agent registration flow
- Policy sync mechanism
- Violation reporting
- JWT authentication

**Parent API Routes:**
```javascript
// In parent's allow2automate (app/routes/agent.js)
router.post('/api/agent/register', async (req, res) => {
  const { machineId, registrationCode, platform } = req.body;

  // Validate registration code (6-digit code shown in parent UI)
  const registration = await Registration.findOne({
    code: registrationCode,
    used: false,
    expiresAt: { $gt: new Date() }
  });

  if (!registration) {
    return res.status(400).json({ error: 'Invalid registration code' });
  }

  // Create agent record
  const agent = await Agent.create({
    machineId,
    childId: registration.childId,
    platform,
    registeredAt: new Date()
  });

  // Mark registration as used
  await registration.update({ used: true, agentId: agent.id });

  // Issue JWT token
  const token = jwt.sign(
    { agentId: agent.id, childId: agent.childId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Get initial policies
  const policies = await Policy.find({
    childId: agent.childId,
    enabled: true
  });

  res.json({
    agentId: agent.id,
    authToken: token,
    policies: policies.map(p => ({
      id: p.id,
      processName: p.processName,
      allowed: p.allowed,
      checkInterval: p.checkInterval
    }))
  });
});

router.get('/api/agent/policies', authenticateAgent, async (req, res) => {
  const policies = await Policy.find({
    childId: req.agentChildId,
    enabled: true
  });

  res.json({
    policies: policies.map(p => ({
      id: p.id,
      processName: p.processName,
      allowed: p.allowed,
      checkInterval: p.checkInterval
    }))
  });
});

router.post('/api/agent/violations', authenticateAgent, async (req, res) => {
  await Violation.create({
    agentId: req.agentId,
    childId: req.agentChildId,
    policyId: req.body.policyId,
    processName: req.body.processName,
    timestamp: new Date(req.body.timestamp)
  });

  // Notify parent in real-time (WebSocket/SSE)
  notifyParent(req.agentChildId, {
    type: 'violation',
    processName: req.body.processName,
    timestamp: req.body.timestamp
  });

  res.json({ success: true });
});

router.post('/api/agent/heartbeat', authenticateAgent, async (req, res) => {
  await Agent.update(
    { id: req.agentId },
    {
      lastHeartbeat: new Date(),
      version: req.body.version,
      uptime: req.body.uptime
    }
  );

  res.json({ success: true });
});
```

#### Phase 3: Installers (Weeks 6-7)
**Deliverables:**
- Windows: MSI installer (WiX Toolset)
- macOS: PKG installer (productbuild)
- Linux: DEB + RPM packages (fpm)

**Windows Service (using node-windows):**
```javascript
// install-service.js
const Service = require('node-windows').Service;

const svc = new Service({
  name: 'Allow2Automate Agent',
  description: 'Process monitoring agent for Allow2Automate parental controls',
  script: require('path').join(__dirname, 'src', 'index.js'),
  nodeOptions: ['--harmony', '--max_old_space_size=4096']
});

svc.on('install', () => {
  console.log('Service installed successfully');
  svc.start();
});

svc.install();
```

**macOS LaunchDaemon (plist):**
```xml
<!-- /Library/LaunchDaemons/com.allow2.agent.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.allow2.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/usr/local/lib/allow2automate-agent/src/index.js</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/var/log/allow2automate-agent.log</string>
  <key>StandardErrorPath</key>
  <string>/var/log/allow2automate-agent.error.log</string>
</dict>
</plist>
```

**Linux systemd Service:**
```ini
# /etc/systemd/system/allow2automate-agent.service
[Unit]
Description=Allow2Automate Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /usr/lib/allow2automate-agent/src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Phase 4: Steam/Epic Plugin Development (Weeks 8-10)
**Deliverables:**
- `@allow2/allow2automate-steam` plugin
- `@allow2/allow2automate-epic` plugin
- Both plugins configure agent policies via parent API

**Steam Plugin (uses agent):**
```javascript
// plugins/allow2automate-steam/src/index.js
export default {
  name: '@allow2/allow2automate-steam',
  version: '1.0.0',

  onLoad: async function(state, context) {
    // Check if agent is installed on any linked child machines
    const agents = await context.api.get('/api/agents');

    // Configure Steam monitoring policy for each agent
    for (const agent of agents) {
      await context.api.post('/api/agent/policies', {
        agentId: agent.id,
        policy: {
          processName: 'Steam.exe',
          allowed: false,  // Initially blocked, allow2 state determines
          checkInterval: 30000
        }
      });
    }

    // Listen for Allow2 state changes
    context.allow2.on('stateChange', async (childId, newState) => {
      const agent = agents.find(a => a.childId === childId);
      if (!agent) return;

      // Update policy based on quota/paused state
      const steamAllowed = !newState.paused && newState.quota > 0;

      await context.api.patch('/api/agent/policies', {
        agentId: agent.id,
        processName: 'Steam.exe',
        allowed: steamAllowed
      });
    });
  }
};
```

#### Phase 5: Testing & Security Audit (Weeks 11-12)
**Test Plan:**
1. **Unit Tests**: Each module (ProcessMonitor, PolicyEngine, ApiClient)
2. **Integration Tests**: Agent ↔ Parent API communication
3. **Platform Tests**: Windows 10/11, macOS 12+, Ubuntu 20.04+
4. **Security Tests**:
   - Penetration testing of parent API
   - Agent binary integrity verification
   - JWT token expiry and refresh
   - Child tampering scenarios (stop service, firewall block, etc.)
5. **Performance Tests**: CPU/RAM usage over 24 hours
6. **Reliability Tests**: Network disconnection, parent offline, agent crash recovery

**Security Audit Checklist:**
- [ ] HTTPS with TLS 1.3
- [ ] JWT tokens with 7-day expiry
- [ ] IP whitelist for parent API
- [ ] Code signing for agent binaries
- [ ] Watchdog process for agent restart
- [ ] Tamper detection (binary hash verification)
- [ ] Secure credential storage (OS keychain)
- [ ] Logging: audit trail of all violations
- [ ] Rate limiting on API endpoints

---

## Alternative: Quick Start with Option 1 (SSH)

If the 6-8 week timeline for Option 2 is too long, you can **start with Option 1 (SSH)** as a **proof of concept** and **migrate to Option 2** later.

### Hybrid Rollout Strategy

**Month 1-2: SSH Implementation (Quick Win)**
- Use existing `allow2automate-cmd` plugin
- Create Steam/Epic process monitoring scripts
- Deploy to small beta group of users
- Gather feedback on usability and reliability

**Month 3-4: Agent Development**
- Build `allow2automate-agent` in parallel
- Parent API development
- Installers for all platforms

**Month 5: Migration**
- Offer agent installer to beta users
- Migrate SSH users to agent
- Deprecate SSH approach (keep as fallback)

**Benefits of Hybrid Rollout:**
- ✅ Get Steam/Epic monitoring live in 2-3 weeks
- ✅ Real-world usage data informs agent design
- ✅ Revenue generation starts sooner
- ✅ Reduced development risk (validate demand first)

---

## Conclusion

### Final Recommendation: **Option 2 (Lightweight Agent)**

**Reasoning:**
1. **Security**: No SSH credential management, JWT tokens are safer
2. **Reliability**: Local monitoring works offline, no network dependency during enforcement
3. **User Experience**: Invisible to child, professional solution
4. **Scalability**: Parent can manage multiple child machines easily
5. **Future-Proof**: Agent can be extended for other monitoring needs

**If timeline is critical:** Start with **Option 1 (SSH)** as a proof of concept, plan migration to **Option 2** within 6 months.

### Next Steps

1. **Decision**: Approve Option 2 architecture
2. **Planning**: Create detailed project plan with milestones
3. **Staffing**: Assign developer(s) to agent development
4. **Design**: UI mockups for agent registration flow in parent app
5. **Security Review**: Third-party security audit of architecture before implementation

---

**Document Version**: 1.0
**Author**: Claude Code Analysis
**Review Status**: Pending approval
**Related Documents**:
- `epic-steam-integration-investigation.md` (process monitoring research)
- `../registry/README.md` (plugin architecture)
- `../../dev-plugins/allow2automate-cmd/` (SSH implementation reference)
