# Agent Installation Analysis & Recommended Fixes

## Executive Summary

This document provides a comprehensive analysis of the Allow2 Automate agent installation system, identifying critical bugs and providing detailed recommendations for fixes. The analysis covers both the main app (parent) and the agent codebase.

**Status**: 3 critical bugs identified, architecture is sound but needs refinement
**Estimated Fix Time**: 12-14 hours

---

## Table of Contents

1. [Current Architecture Overview](#current-architecture-overview)
2. [Critical Bugs Identified](#critical-bugs-identified)
3. [Recommended Fixes](#recommended-fixes)
4. [Power User Feature: Hardcoded URL Support](#power-user-feature-hardcoded-url-support)
5. [Implementation Priority](#implementation-priority)
6. [Testing Checklist](#testing-checklist)

---

## Current Architecture Overview

### Agent Installation Flow

```
1. User clicks "Download Installer" in main app
   ↓
2. Main app generates:
   - Registration code (6-char, optional for child assignment)
   - Config file with parentApiUrl, registrationCode, settings
   - Copies installer PKG/DEB/MSI to Downloads folder
   ↓
3. User installs agent on target device
   - PKG installer runs (macOS)
   - Binaries installed to /usr/local/bin/
   - LaunchDaemon created for system service
   ↓
4. Agent starts on boot
   - Generates UUID if no agentId in config
   - Starts mDNS advertising (if enableMDNS: true)
   - Advertises as "allow2-agent-{hostname}" on port 8443
   ↓
5. Main app discovers agent via mDNS
   - Scans for _allow2._tcp services
   - Gets agent metadata from TXT records
   ↓
6. Main app pairs with agent
   - Sends POST to agent's /api/config endpoint
   - Provides: parentApiUrl, agentId, authToken
   - Agent saves to /etc/allow2/agent/config.json
   ↓
7. Agent begins syncing policies
   - Polls parentApiUrl every 30 seconds
   - Downloads policies and enforces restrictions
```

### Key Components

**Main App (`/mnt/ai/automate/automate/`):**
- `app/main-agent-integration.js` - IPC handlers, installer download
- `app/services/AgentService.js` - Agent management, registration codes
- `app/services/AgentUpdateService.js` - Config generation, installer export
- `app/services/AgentDiscovery.js` - mDNS discovery of agents

**Agent (`/home/andrew/ai/automate/allow2automate-agent/`):**
- `src/index.js` - Main entry point, service orchestration
- `src/ConfigManager.js` - Config file handling
- `src/DiscoveryAdvertiser.js` - mDNS advertising
- `src/ApiServer.js` - REST API for pairing and management
- `installers/{macos,linux,windows}/` - Platform-specific installers

---

## Critical Bugs Identified

### BUG #1: Link-Local IP Address Selection (169.254.x.x)

**Location:** `/mnt/ai/automate/automate/app/main-agent-integration.js:286-293`

**Current Code:**
```javascript
// Find first non-internal IPv4 address
for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
        if (iface.family === 'IPv4' && !iface.internal) {
            serverUrl = `http://${iface.address}:${serverPort}`;
            break;  // ❌ PROBLEM: Takes first IP, often link-local
        }
    }
}
```

**Why This Fails:**

On Linux/macOS, `os.networkInterfaces()` returns interfaces in arbitrary order:
```json
{
  "docker0": [{"address": "172.17.0.1", "internal": false}],
  "virbr0": [{"address": "192.168.122.1", "internal": false}],
  "wlp3s0": [
    {"address": "169.254.169.254", "internal": false},  // ❌ Link-local
    {"address": "192.168.1.100", "internal": false}     // ✅ Actual IP
  ]
}
```

The code picks the **first** non-internal IP, which is often:
- Link-local (169.254.x.x) - not routable
- Docker bridge (172.17.x.x) - virtual network
- Virtual bridge (192.168.122.x) - libvirt/KVM

**Impact:** Config file contains unreachable IP address, agent cannot connect

**Root Cause:** No filtering for virtual/link-local interfaces

---

### BUG #2: Config File Not Copied During Installation

**Locations:**
- Main app generates config: `/mnt/ai/automate/automate/app/services/AgentUpdateService.js:556-563`
- Agent expects config at: `/home/andrew/ai/automate/allow2automate-agent/src/ConfigManager.js:39`

**Current Behavior:**

1. **Main App** downloads config to: `~/Downloads/allow2automate-agent-config.json`
2. **Installer** expects user to manually copy it (no documentation)
3. **Agent** looks for config at: `/etc/allow2/agent/config.json`
4. **Result:** Config never reaches agent, pairing relies entirely on mDNS

**Why Instructions Are Unclear:**

The download success dialog says:
```
Configuration:
/Users/andrew/Downloads/allow2automate-agent-config.json

Installation Instructions
Step 2: Run the installer (double-click the PKG file)
```

But **nowhere** does it say to move the config file! The installer doesn't:
- Prompt for config file location
- Fail if config is missing
- Display config contents for confirmation

**Impact:** Config file is ignored, all installations are unconfigured

**Root Cause:** Missing post-install script to copy config from Downloads to system location

---

### BUG #3: Registration Code Has SQL Syntax Error

**Location:** `/mnt/ai/automate/automate/app/services/AgentService.js:179`

**Current Code:**
```javascript
async validateRegistrationCode(code) {
  const result = await this.db.query(
    'SELECT * FROM registration_codes WHERE code = $1 AND used = false AND expires_at > datetime("now")',
    //                                                                     ^^^^^^^^^^^^^^^^
    //                                                                     ❌ SQLite syntax in PostgreSQL
    [code]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}
```

**Why This Fails:**

- The app uses **PostgreSQL** (not SQLite)
- `datetime("now")` is SQLite function syntax
- PostgreSQL uses `NOW()` or `CURRENT_TIMESTAMP`
- Registration code validation will **always fail** with syntax error

**Impact:** Registration codes are generated but can never be validated

**Root Cause:** Code written for SQLite, not PostgreSQL

---

### BUG #4: Registration Code Not Used by Agent

**Location:** `/home/andrew/ai/automate/allow2automate-agent/src/index.js:62-66`

**Current Behavior:**

1. Main app generates registration code
2. Code is written to config file
3. Agent reads config file (if it exists)
4. **Agent ignores registration code** - never sends it to parent

**Agent Pairing Flow:**
```javascript
// index.js:142-148
if (this.configManager.isConfigured()) {
  // Configured = has agentId, parentApiUrl, authToken
  // Does NOT check for registrationCode!
  await this.policyEngine.syncFromParent();
}
```

**Missing Logic:**

Agent should:
1. Check for `registrationCode` in config on first run
2. Send registration code to parent during initial connection
3. Parent validates code and returns `agentId` + `authToken`
4. Agent saves credentials and removes registration code from config

**Impact:** Registration code is dead code, serves no purpose

**Root Cause:** Feature partially implemented but never completed

---

## Recommended Fixes

### FIX #1: Intelligent Network Interface Selection

**File:** `/mnt/ai/automate/automate/app/main-agent-integration.js:280-293`

**Replace with:**

```javascript
/**
 * Get the preferred network IP address for agent connections
 * Filters out link-local, loopback, and virtual interfaces
 */
function getPreferredIPAddress() {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  const candidates = [];

  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      // Skip non-IPv4 and internal addresses
      if (iface.family !== 'IPv4' || iface.internal) continue;

      // Skip link-local addresses (169.254.0.0/16)
      if (iface.address.startsWith('169.254.')) continue;

      // Skip common virtual interfaces
      if (interfaceName.startsWith('docker') ||
          interfaceName.startsWith('veth') ||
          interfaceName.startsWith('virbr') ||
          interfaceName.startsWith('br-')) continue;

      // Calculate priority based on interface name
      let priority = 0;
      if (interfaceName.startsWith('eth') ||
          interfaceName.startsWith('en')) {
        priority = 3; // Ethernet interfaces (highest priority)
      } else if (interfaceName.startsWith('wlan') ||
                 interfaceName.startsWith('wl') ||
                 interfaceName.startsWith('wi-fi')) {
        priority = 2; // WiFi interfaces
      } else {
        priority = 1; // Other interfaces
      }

      candidates.push({
        address: iface.address,
        priority,
        name: interfaceName
      });
    }
  }

  // Sort by priority (highest first)
  candidates.sort((a, b) => b.priority - a.priority);

  // Return highest priority address, or localhost as fallback
  return candidates.length > 0 ? candidates[0].address : 'localhost';
}

// Usage in installer download handler (line 286):
const serverIp = getPreferredIPAddress();
const serverPort = (global.services && global.services.serverPort) || 8080;
const serverUrl = `http://${serverIp}:${serverPort}`;
```

**Benefits:**
- ✅ Prefers wired Ethernet over WiFi
- ✅ Filters link-local and virtual interfaces
- ✅ Graceful fallback to localhost if no suitable interface
- ✅ Consistent behavior across platforms

---

### FIX #2: Installer Post-Install Script

**Problem:** Config file downloaded to `~/Downloads` but needs to be at `/etc/allow2/agent/config.json`

**Solution A: macOS PKG Post-Install Script**

**File:** `/home/andrew/ai/automate/allow2automate-agent/installers/macos/build.sh:220-235`

**Modify postinstall script:**

```bash
#!/bin/bash
set -e

# Start main agent service (system-wide)
launchctl load /Library/LaunchDaemons/com.allow2.automate-agent.plist 2>/dev/null || true
launchctl start com.allow2.automate-agent 2>/dev/null || true

# Start helper for current user
CURRENT_USER=$(stat -f%Su /dev/console)
if [ -n "$CURRENT_USER" ] && [ "$CURRENT_USER" != "root" ]; then
  sudo -u "$CURRENT_USER" launchctl load /Library/LaunchAgents/com.allow2.agent-helper.plist 2>/dev/null || true
fi

# Check for config file in common locations
CONFIG_LOCATIONS=(
  "/Users/$CURRENT_USER/Downloads/allow2automate-agent-config.json"
  "/tmp/allow2automate-agent-config.json"
  "$(dirname "$0")/allow2automate-agent-config.json"
)

CONFIG_DEST="/Library/Application Support/Allow2/agent/config.json"
CONFIG_DIR="$(dirname "$CONFIG_DEST")"

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"
chmod 755 "$CONFIG_DIR"

# Search for config file and copy if found
CONFIG_FOUND=false
for CONFIG_SRC in "${CONFIG_LOCATIONS[@]}"; do
  if [ -f "$CONFIG_SRC" ]; then
    echo "Found config file at: $CONFIG_SRC"
    cp "$CONFIG_SRC" "$CONFIG_DEST"
    chmod 600 "$CONFIG_DEST"
    chown root:wheel "$CONFIG_DEST"
    CONFIG_FOUND=true
    echo "✅ Configuration installed to: $CONFIG_DEST"
    rm "$CONFIG_SRC"  # Clean up source file
    break
  fi
done

if [ "$CONFIG_FOUND" = false ]; then
  echo "⚠️  Configuration file not found. Agent will use mDNS discovery."
  echo "   To configure manually, place config at: $CONFIG_DEST"
fi

echo "✅ Allow2 Automate Agent installed successfully"
exit 0
```

**Solution B: Update Main App to Place Config in /tmp**

**File:** `/mnt/ai/automate/automate/app/main-agent-integration.js:303-310`

**Change download location:**

```javascript
// Instead of Downloads folder, use /tmp for config
const configTmpPath = platform === 'darwin'
  ? '/tmp/allow2automate-agent-config.json'
  : platform === 'linux'
  ? '/tmp/allow2automate-agent-config.json'
  : path.join(downloadsPath, 'allow2automate-agent-config.json');

// Export installer (downloads if needed)
const result = await agentUpdateService.exportInstaller(
  platformInfo.version,
  platform,
  downloadsPath,  // Installer still goes to Downloads
  serverUrl,
  registrationCode,
  configTmpPath   // Add new parameter for config path
);
```

**File:** `/mnt/ai/automate/automate/app/services/AgentUpdateService.js:489`

**Update exportInstaller signature:**

```javascript
async exportInstaller(version, platform, destinationPath, serverUrl, registrationCode, configPath = null) {
  // ... existing code ...

  // Generate configuration file
  let configFile = null;
  if (serverUrl) {
    // Use provided config path, or default to Downloads folder
    configFile = configPath || path.join(destinationPath, 'allow2automate-agent-config.json');

    const config = this.generateAgentConfig(serverUrl, registrationCode, platform);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');

    // Set permissions if on Unix-like system
    if (platform !== 'win32') {
      fs.chmodSync(configFile, 0o644);  // Readable by all, writable by owner
    }

    console.log(`[AgentUpdateService] Generated config file at ${configFile}`);
  }

  return { installerPath: destFile, configPath: configFile, version };
}
```

**Recommendation:** Implement **both solutions** for maximum compatibility.

---

### FIX #3: Correct PostgreSQL SQL Syntax

**File:** `/mnt/ai/automate/automate/app/services/AgentService.js:177-192`

**Replace:**

```javascript
async validateRegistrationCode(code) {
  try {
    const result = await this.db.query(
      'SELECT * FROM registration_codes WHERE code = $1 AND used = false AND expires_at > NOW()',
      //                                                                     ^^^^^^
      //                                                                     ✅ PostgreSQL syntax
      [code]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Mark code as used
    await this.db.query(
      'UPDATE registration_codes SET used = true, used_at = NOW() WHERE code = $1',
      [code]
    );

    return result.rows[0];
  } catch (error) {
    console.error('[AgentService] Error validating registration code:', error);
    throw error;
  }
}
```

**Benefits:**
- ✅ Uses correct PostgreSQL `NOW()` function
- ✅ Marks code as used after validation
- ✅ Returns null if code invalid/expired
- ✅ Proper error handling

---

### FIX #4: Remove or Complete Registration Code Feature

**Option A: Remove Registration Code (Recommended)**

Registration codes add complexity without clear benefit when using mDNS discovery. Agents can be paired directly through the UI.

**Changes Required:**

1. **Remove code generation:**
   - Delete: `app/services/AgentService.js:166-192`
   - Remove: `app/main-agent-integration.js:274-277`

2. **Simplify config generation:**
   - Remove `registrationCode` parameter from `exportInstaller()`
   - Remove `registrationCode` from `generateAgentConfig()`

3. **Update UI:**
   - Remove registration code display from download dialog
   - Remove Step 3 from installation instructions

**Option B: Complete Registration Code Implementation**

If registration codes are needed for pre-authorized child assignment:

**Agent Changes:**

**File:** `/home/andrew/ai/automate/allow2automate-agent/src/index.js:62-85`

```javascript
async initialize() {
  // ... existing code ...

  // Generate agent ID if not set
  if (!this.configManager.get('agentId')) {
    const agentId = uuidv4();
    this.configManager.set('agentId', agentId);
  }

  // Check for registration code and attempt registration
  const registrationCode = this.configManager.get('registrationCode');
  if (registrationCode && !this.configManager.get('authToken')) {
    this.logger.info('Registration code found, attempting registration...');
    await this.registerWithParent(registrationCode);
  }

  // ... rest of initialization ...
}

/**
 * Register agent with parent using registration code
 */
async registerWithParent(registrationCode) {
  try {
    const parentUrl = this.configManager.get('parentApiUrl');
    if (!parentUrl) {
      this.logger.warn('No parent URL configured, cannot register');
      return;
    }

    const response = await fetch(`${parentUrl}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationCode,
        agentId: this.configManager.get('agentId'),
        hostname: os.hostname(),
        platform: process.platform
      })
    });

    if (!response.ok) {
      throw new Error(`Registration failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Save credentials from parent
    this.configManager.update({
      authToken: data.authToken,
      parentApiUrl: data.parentApiUrl,
      registrationCode: null  // Remove code after successful registration
    });

    this.logger.info('Successfully registered with parent server');
  } catch (error) {
    this.logger.error('Failed to register with parent:', error.message);
  }
}
```

**Parent App Changes:**

**File:** `/mnt/ai/automate/automate/app/routes/agent.js`

Add registration endpoint:

```javascript
router.post('/api/agents/register', async (req, res) => {
  try {
    const { registrationCode, agentId, hostname, platform } = req.body;

    // Validate registration code
    const codeData = await global.services.agent.validateRegistrationCode(registrationCode);
    if (!codeData) {
      return res.status(401).json({ error: 'Invalid or expired registration code' });
    }

    // Generate auth token for agent
    const jwt = require('jsonwebtoken');
    const authToken = jwt.sign(
      { agentId, type: 'agent' },
      process.env.JWT_SECRET || 'default-secret-change-me',
      { expiresIn: '365d' }
    );

    // Register agent in database
    await global.services.agent.registerAgent({
      id: agentId,
      childId: codeData.child_id,
      hostname,
      platform,
      authToken
    });

    res.json({
      success: true,
      authToken,
      parentApiUrl: `http://${req.hostname}:${global.services.serverPort}`,
      childId: codeData.child_id
    });
  } catch (error) {
    console.error('[AgentRegistration] Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Recommendation:** Choose **Option A** (remove registration codes) unless there's a specific need for pre-authorized child assignment.

---

## Power User Feature: Hardcoded URL Support

### Current State

The config file **already includes** `parentApiUrl`:

```json
{
  "parentApiUrl": "http://192.168.1.100:8080",
  "apiPort": 8443,
  "checkInterval": 30000,
  "logLevel": "info",
  "enableMDNS": true,
  "autoUpdate": true
}
```

**Problem:** Agent doesn't use `parentApiUrl` from config as a fallback to mDNS discovery.

### Recommended Implementation

**1. Agent Logic Update**

**File:** `/home/andrew/ai/automate/allow2automate-agent/src/index.js:96-104`

**Change:**

```javascript
// Initialize mDNS discovery (if enabled AND no hardcoded parent URL)
const hasHardcodedParent = !!(this.configManager.get('parentApiUrl') &&
                              this.configManager.get('authToken'));

if (this.configManager.get('enableMDNS') && !hasHardcodedParent) {
  this.discoveryAdvertiser = new DiscoveryAdvertiser(
    this.configManager.get('agentId'),
    apiPort,
    this.logger
  );
  this.logger.info('Discovery advertiser initialized (mDNS mode)');
} else if (hasHardcodedParent) {
  this.logger.info('Using hardcoded parent URL, mDNS disabled', {
    parentUrl: this.configManager.get('parentApiUrl')
  });
}
```

**Logic:**
- If `parentApiUrl` + `authToken` are set → skip mDNS (power user mode)
- If `enableMDNS: true` and no hardcoded URL → use mDNS discovery
- If `enableMDNS: false` and no hardcoded URL → wait for manual configuration

**2. Config File Enhancement**

**File:** `/mnt/ai/automate/automate/app/services/AgentUpdateService.js:578-606`

**Add comments for power users:**

```javascript
generateAgentConfig(serverUrl, registrationCode, platform, advancedMode = false) {
  const config = {
    // Parent server URL (auto-detected)
    // Advanced users: Set this to a fixed IP:PORT to bypass mDNS discovery
    // Example: "http://192.168.1.100:8080"
    parentApiUrl: serverUrl,

    // Agent API port (default: 8443)
    apiPort: 8443,

    // Policy sync interval in milliseconds (default: 30 seconds)
    checkInterval: 30000,

    // Log level: 'error', 'warn', 'info', 'debug'
    logLevel: 'info',

    // Enable mDNS/Bonjour discovery (set to false if using hardcoded parentApiUrl)
    enableMDNS: !advancedMode,

    // Enable automatic updates
    autoUpdate: true
  };

  // Add auth token if in advanced mode (pre-configured agent)
  if (advancedMode && registrationCode) {
    config.authToken = registrationCode;  // In advanced mode, this is actually the JWT token
    config.agentId = null;  // Will be generated on first run
  }

  // Platform-specific paths
  if (platform === 'win32') {
    config.configPath = 'C:\\ProgramData\\Allow2\\agent\\config.json';
    config.logPath = 'C:\\ProgramData\\Allow2\\agent\\logs\\';
  } else if (platform === 'darwin') {
    config.configPath = '/Library/Application Support/Allow2/agent/config.json';
    config.logPath = '/Library/Logs/Allow2/agent/';
  } else if (platform === 'linux') {
    config.configPath = '/etc/allow2/agent/config.json';
    config.logPath = '/var/log/allow2/agent/';
  }

  return config;
}
```

**3. UI Enhancement in Main App**

Add checkbox in installer download dialog:

```javascript
// Renderer process (React/Vue component)

<Dialog title="Download Agent Installer">
  <FormGroup>
    <Label>Platform</Label>
    <Select value={platform} onChange={setPlatform}>
      <option value="darwin">macOS</option>
      <option value="linux">Linux</option>
      <option value="win32">Windows</option>
    </Select>
  </FormGroup>

  <FormGroup>
    <Label>
      <Checkbox checked={advancedMode} onChange={setAdvancedMode} />
      Advanced: Use fixed IP address (bypass auto-discovery)
    </Label>
    <HelpText>
      For power users only. Hardcodes this server's IP address in the agent config.
      Use this if you have specific networking requirements or mDNS doesn't work.
    </HelpText>
  </FormGroup>

  {advancedMode && (
    <>
      <FormGroup>
        <Label>Server IP Address</Label>
        <Input
          type="text"
          value={serverIp}
          onChange={setServerIp}
          placeholder="192.168.1.100"
        />
      </FormGroup>

      <FormGroup>
        <Label>Server Port</Label>
        <Input
          type="number"
          value={serverPort}
          onChange={setServerPort}
          placeholder="8080"
        />
      </FormGroup>

      <Alert variant="warning">
        ⚠️ The agent will ONLY connect to {serverIp}:{serverPort}.
        If this IP changes, you'll need to manually update the agent config.
      </Alert>
    </>
  )}

  <Button onClick={handleDownload}>Download Installer</Button>
</Dialog>
```

**IPC Handler Update:**

```javascript
// main-agent-integration.js
ipcMain.handle('agents:download-installer', async (event, { platform, childId, advancedMode, customIp, customPort }) => {
  try {
    const downloadsPath = electronApp.getPath('downloads');

    // Generate registration code if childId provided
    let registrationCode = null;
    if (childId) {
      registrationCode = await agentService.generateRegistrationCode(childId);
    }

    // Determine server URL
    let serverUrl;
    if (advancedMode && customIp && customPort) {
      // Power user mode: use custom IP/port
      serverUrl = `http://${customIp}:${customPort}`;
    } else {
      // Auto-detect mode: use preferred network interface
      const serverIp = getPreferredIPAddress();
      const serverPort = (global.services && global.services.serverPort) || 8080;
      serverUrl = `http://${serverIp}:${serverPort}`;
    }

    // Get latest version for this platform
    const latestVersions = agentUpdateService.getLatestVersions();
    const platformInfo = latestVersions[platform];

    if (!platformInfo) {
      throw new Error(`No installer available for platform: ${platform}`);
    }

    // Export installer with advanced mode flag
    const result = await agentUpdateService.exportInstaller(
      platformInfo.version,
      platform,
      downloadsPath,
      serverUrl,
      registrationCode,
      null,  // configPath (use default)
      advancedMode
    );

    return {
      success: true,
      installerPath: result.installerPath,
      configPath: result.configPath,
      serverUrl: serverUrl,
      registrationCode: registrationCode,
      version: result.version,
      checksum: platformInfo.checksum,
      advancedMode: advancedMode
    };
  } catch (error) {
    console.error('[IPC] Error downloading installer:', error);
    return { success: false, error: error.message };
  }
});
```

**Benefits:**
- ✅ Default mode: Auto-discovery via mDNS (easy for most users)
- ✅ Advanced mode: Fixed IP/port (power users with specific requirements)
- ✅ Config file clearly documents both modes with comments
- ✅ Agent respects `enableMDNS: false` when hardcoded URL is present

---

## Implementation Priority

### Phase 1: Critical Fixes (Must Do)
**Estimated Time:** 6-8 hours

1. ✅ **FIX #1**: Intelligent network interface selection (2 hours)
   - Implement `getPreferredIPAddress()` function
   - Test on Linux/macOS/Windows with various network configs
   - Verify correct IP selection

2. ✅ **FIX #2**: Installer post-install script (3 hours)
   - Update macOS PKG post-install script
   - Update Linux DEB/RPM post-install script
   - Test config file copying from /tmp
   - Verify permissions (600, root-owned)

3. ✅ **FIX #3**: PostgreSQL SQL syntax (30 mins)
   - Change `datetime("now")` to `NOW()`
   - Test registration code validation
   - Verify code is marked as used

### Phase 2: Architecture Improvements (Should Do)
**Estimated Time:** 4-6 hours

4. ✅ **FIX #4**: Remove registration code feature (2 hours)
   - Remove code generation from main app
   - Remove validation logic
   - Update UI to remove registration instructions
   - Test agent pairing without codes

5. ✅ **Power User Feature**: Hardcoded URL support (3 hours)
   - Add UI checkbox for advanced mode
   - Update config generation with advancedMode flag
   - Modify agent to prefer hardcoded URL over mDNS
   - Add clear documentation in config file
   - Test both modes (auto-discovery and fixed IP)

### Phase 3: Documentation & Polish (Nice to Have)
**Estimated Time:** 2-3 hours

6. ✅ Update installation instructions (1 hour)
   - Clarify config file handling
   - Document advanced mode for power users
   - Add troubleshooting section

7. ✅ Add validation & error messages (1 hour)
   - Validate IP address format in UI
   - Better error messages if config missing
   - Warning if selected IP is link-local

8. ✅ Automated testing (1 hour)
   - Unit test for `getPreferredIPAddress()`
   - Integration test for installer flow
   - E2E test for agent pairing

---

## Testing Checklist

### Network Interface Selection
- [ ] Test on Linux with Docker installed
- [ ] Test on macOS with VPN active
- [ ] Test on Windows with multiple adapters
- [ ] Verify Ethernet prioritized over WiFi
- [ ] Verify link-local addresses filtered
- [ ] Verify fallback to localhost works

### Config File Installation
- [ ] Test macOS PKG installer with config in /tmp
- [ ] Test macOS PKG installer with config in Downloads
- [ ] Test Linux DEB installer with config in /tmp
- [ ] Verify config permissions (600, root-owned)
- [ ] Verify config directory created (755)
- [ ] Test installer without config (graceful fallback)

### Registration Code (if kept)
- [ ] Test code generation
- [ ] Test code validation (valid code)
- [ ] Test code validation (expired code)
- [ ] Test code validation (already used)
- [ ] Verify PostgreSQL NOW() syntax works
- [ ] Test agent registration with code

### Power User Mode
- [ ] Test with advancedMode: true
- [ ] Test with enableMDNS: false
- [ ] Test with hardcoded parentApiUrl
- [ ] Verify mDNS disabled when URL hardcoded
- [ ] Test with invalid IP format
- [ ] Verify agent connects to hardcoded URL
- [ ] Test switching from auto to manual mode

### End-to-End
- [ ] Download installer (normal mode)
- [ ] Install on fresh VM
- [ ] Verify mDNS discovery works
- [ ] Pair agent through UI
- [ ] Download installer (advanced mode)
- [ ] Install on fresh VM
- [ ] Verify agent connects to hardcoded URL
- [ ] Test policy sync in both modes

---

## Summary

The agent installation system is **architecturally sound** but has **3 critical bugs** that prevent proper operation:

1. **Wrong IP detection** (169.254.x.x) - prevents agent connectivity
2. **Config file not installed** - orphans configuration
3. **SQL syntax error** - breaks registration codes

Additionally, the **registration code feature is incomplete** and should either be:
- Removed entirely (recommended)
- Completed with proper agent-side implementation

The requested **power user feature** for hardcoded URLs is **partially implemented** - the config structure exists, but the agent doesn't respect it. This requires minor logic changes to prefer hardcoded URLs over mDNS discovery.

**Total estimated fix time:** 12-14 hours (including testing)

**Highest impact fixes:**
1. Network interface selection (FIX #1) - 2 hours, critical
2. Config file installation (FIX #2) - 3 hours, critical
3. Power user hardcoded URL (Phase 2) - 3 hours, high value

Recommend tackling in this order for fastest time-to-working-system.
