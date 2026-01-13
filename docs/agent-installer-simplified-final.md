# Agent Installer - Simplified Final Implementation

## Changes from Previous Design

### ❌ REMOVED: Registration Code
- **Why**: Registration codes are not used by the agent
- **Impact**: Simpler UI, cleaner code, less confusion
- **Pairing Method**: mDNS discovery (already implemented in agent)

### ✅ SIMPLIFIED: Installation Instructions
**Before** (4 steps):
1. Download installer and config
2. Transfer both files
3. Keep in same folder
4. Run installer with registration code

**After** (3 steps):
1. Save installer
2. Transfer to target machine
3. Run installer

---

## Updated Implementation

### 1. Main App IPC Handler (Simplified)

**File:** `/mnt/ai/automate/automate/app/main-agent-integration.js:268-325`

**Replace entire handler:**

```javascript
// Download installer bundle with save dialog
ipcMain.handle('agents:download-installer', async (event, { platform, childId, advancedMode, customIp, customPort }) => {
  try {
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

    // Create installer bundle (ZIP with installer + config)
    console.log('[AgentIntegration] Creating installer bundle...');
    const bundle = await agentUpdateService.exportInstallerBundle(
      platformInfo.version,
      platform,
      serverUrl,
      childId,  // Pass childId for optional pre-assignment
      advancedMode
    );

    // Show save dialog
    const saveResult = await dialog.showSaveDialog({
      title: 'Save Agent Installer',
      defaultPath: path.join(electronApp.getPath('downloads'), bundle.zipFileName),
      filters: [
        { name: 'ZIP Archive', extensions: ['zip'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    // Check if user cancelled
    if (saveResult.canceled || !saveResult.filePath) {
      console.log('[AgentIntegration] User cancelled save dialog');
      fs.unlinkSync(bundle.zipPath); // Clean up temp file
      return { success: false, cancelled: true };
    }

    // Move bundle from temp location to chosen location
    const finalPath = saveResult.filePath;
    fs.copyFileSync(bundle.zipPath, finalPath);
    fs.unlinkSync(bundle.zipPath); // Clean up temp file

    console.log(`[AgentIntegration] Installer bundle saved to: ${finalPath}`);

    // Calculate file size for display
    const stats = fs.statSync(finalPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    // Show success dialog with simplified instructions
    const messageResult = await dialog.showMessageBox({
      type: 'info',
      title: 'Agent Installer Ready',
      message: `Installer saved successfully`,
      detail:
        `✅ Saved to: ${finalPath}\n\n` +
        `📦 Contents:\n` +
        `  • Agent installer (${bundle.version})\n` +
        `  • Configuration file\n\n` +
        `📊 Size: ${fileSizeMB} MB\n` +
        `🌐 Server: ${serverUrl}\n\n` +
        `📋 Installation:\n` +
        `  1. Save installer\n` +
        `  2. Transfer to target machine\n` +
        `  3. Run installer\n\n` +
        (advancedMode ?
          `⚙️ Advanced: Fixed IP (mDNS disabled)\n` :
          `🔍 Standard: Auto-discovery via mDNS\n`) +
        `\n` +
        `The installer will automatically detect and validate\n` +
        `the configuration when you extract and run it.`,
      buttons: ['OK', 'Show in Folder', 'Copy Path'],
      defaultId: 0
    });

    // Handle button clicks
    if (messageResult.response === 1) {
      require('electron').shell.showItemInFolder(finalPath);
    } else if (messageResult.response === 2) {
      const { clipboard } = require('electron');
      clipboard.writeText(finalPath);
    }

    return {
      success: true,
      bundlePath: finalPath,
      serverUrl: serverUrl,
      version: bundle.version,
      platform: platform,
      advancedMode: advancedMode,
      childId: childId // Return for tracking
    };

  } catch (error) {
    console.error('[IPC] Error creating installer bundle:', error);

    await dialog.showMessageBox({
      type: 'error',
      title: 'Download Failed',
      message: 'Failed to create installer',
      detail: error.message,
      buttons: ['OK']
    });

    return { success: false, error: error.message };
  }
});
```

---

### 2. Update AgentUpdateService (Remove Registration Code)

**File:** `/mnt/ai/automate/automate/app/services/AgentUpdateService.js`

**Update `generateAgentConfig` method (lines 578-606):**

```javascript
/**
 * Generate agent configuration file
 * @param {string} serverUrl - Parent server URL
 * @param {string} childId - Optional child ID for pre-assignment
 * @param {string} platform - Platform (win32, darwin, linux)
 * @param {boolean} advancedMode - Use fixed IP (disable mDNS)
 */
generateAgentConfig(serverUrl, childId, platform, advancedMode = false) {
  const config = {
    // Parent server URL (auto-detected or user-specified)
    // Advanced users: This can be updated post-install if needed
    parentApiUrl: serverUrl,

    // Agent API port (default: 8443)
    apiPort: 8443,

    // Policy sync interval in milliseconds (default: 30 seconds)
    checkInterval: 30000,

    // Log level: 'error', 'warn', 'info', 'debug'
    logLevel: 'info',

    // Enable mDNS/Bonjour discovery
    // Set to false if using fixed parentApiUrl in advanced mode
    enableMDNS: !advancedMode,

    // Enable automatic updates
    autoUpdate: true
  };

  // Add child ID if provided (for optional pre-assignment)
  if (childId) {
    config.preAssignedChildId = childId;
  }

  // Platform-specific paths (for reference in config)
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

**Update `exportInstallerBundle` method:**

```javascript
/**
 * Export installer bundle as ZIP (installer + config)
 * @param {string} version - Version to export
 * @param {string} platform - Platform (darwin, linux, win32)
 * @param {string} serverUrl - Parent server URL
 * @param {string} childId - Optional child ID for pre-assignment
 * @param {boolean} advancedMode - Use fixed IP mode
 */
async exportInstallerBundle(version, platform, serverUrl, childId = null, advancedMode = false) {
  try {
    console.log(`[AgentUpdateService] Creating installer bundle for ${platform} v${version}...`);

    // Create temp directory for staging
    const tempDir = path.join(this.app.getPath('temp'), 'allow2-installer-staging');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Get installer file (from cache or download)
    let installerPath;
    let installerExt;

    const versionCache = this.installerCache.get(version);
    if (versionCache && versionCache[platform]) {
      // Use cached installer
      const installer = versionCache[platform];
      installerExt = installer.ext;
      installerPath = installer.path;
      console.log(`[AgentUpdateService] Using cached installer: ${installerPath}`);
    } else {
      // Download from GitHub
      console.log(`[AgentUpdateService] Downloading installer from GitHub...`);

      const release = this.releases.find(r => r.version === version);
      if (!release) {
        throw new Error(`Release version ${version} not found`);
      }

      const installerAsset = release.assets.find(a =>
        a.platform === platform && a.type === 'installer'
      );
      if (!installerAsset) {
        throw new Error(`No installer found for ${platform} in version ${version}`);
      }

      const fileName = installerAsset.name;
      const cachePath = path.join(this.cacheDir, fileName);

      await this.downloadFile(installerAsset.url, cachePath);

      // Update cache
      const checksum = await this.calculateChecksum(cachePath);
      if (!this.installerCache.has(version)) {
        this.installerCache.set(version, {});
      }
      this.installerCache.get(version)[platform] = {
        path: cachePath,
        checksum,
        ext: installerAsset.ext
      };

      installerPath = cachePath;
      installerExt = installerAsset.ext;
    }

    // Generate config file (NO registration code)
    const configPath = path.join(tempDir, 'allow2automate-agent-config.json');
    const config = this.generateAgentConfig(serverUrl, childId, platform, advancedMode);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

    console.log(`[AgentUpdateService] Config generated: ${configPath}`);

    // Determine ZIP filename
    const platformArch = platform === 'darwin' ? 'darwin-x64' :
                        platform === 'linux' ? 'linux-x64' :
                        platform === 'win32' ? 'win32-x64' : platform;

    const zipFileName = `allow2automate-agent-${platformArch}-v${version}.zip`;
    const zipPath = path.join(tempDir, zipFileName);

    // Create ZIP bundle
    await this.createInstallerBundle(installerPath, configPath, zipPath);

    // Clean up temp config file
    fs.unlinkSync(configPath);

    console.log(`[AgentUpdateService] Bundle created: ${zipPath}`);

    return {
      zipPath: zipPath,
      zipFileName: zipFileName,
      version: version,
      platform: platform,
      installerName: path.basename(installerPath)
    };

  } catch (error) {
    console.error('[AgentUpdateService] Error creating installer bundle:', error);
    throw error;
  }
}
```

---

### 3. Remove Registration Code Generation

**File:** `/mnt/ai/automate/automate/app/services/AgentService.js`

**Delete or comment out methods (lines 166-192):**

```javascript
// Registration code methods - DEPRECATED
// The agent uses mDNS discovery and pairing instead of registration codes
// These methods are kept for backwards compatibility but are no longer used

/*
async generateRegistrationCode(childId) {
  // DEPRECATED - not used by agent
  // Agent discovery uses mDNS and pairing flow instead
  return null;
}

async validateRegistrationCode(code) {
  // DEPRECATED - not used by agent
  return null;
}
*/
```

---

### 4. Update UI (Remove Registration Code Display)

**File:** Renderer process component (wherever installer download UI is)

**Before:**
```javascript
<Dialog>
  <Select platform />
  <Select child />
  <Checkbox advancedMode />

  {/* REMOVE THIS: */}
  <div>Registration Code: {code}</div>

  <Button download />
</Dialog>
```

**After:**
```javascript
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
    <Label>Assign to Child (Optional)</Label>
    <Select value={childId} onChange={setChildId}>
      <option value="">None - Assign later</option>
      {children.map(child => (
        <option key={child.id} value={child.id}>
          {child.name}
        </option>
      ))}
    </Select>
    <HelpText>
      Pre-assign this agent to a specific child.
      You can change this later in the agent settings.
    </HelpText>
  </FormGroup>

  <FormGroup>
    <Label>
      <Checkbox checked={advancedMode} onChange={setAdvancedMode} />
      Advanced: Use fixed IP address
    </Label>
    <HelpText>
      For networks where mDNS/Bonjour doesn't work.
      Hardcodes this server's IP in the agent config.
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
        ⚠️ The agent will only connect to {serverIp}:{serverPort}.
        If this IP changes, update the agent config manually.
      </Alert>
    </>
  )}

  <Button onClick={handleDownload} primary>
    Download Installer
  </Button>
</Dialog>
```

---

## Simplified Config File Structure

**Generated `allow2automate-agent-config.json`:**

```json
{
  "parentApiUrl": "http://192.168.1.100:8080",
  "apiPort": 8443,
  "checkInterval": 30000,
  "logLevel": "info",
  "enableMDNS": true,
  "autoUpdate": true,
  "preAssignedChildId": "child-uuid-here",
  "configPath": "/Library/Application Support/Allow2/agent/config.json",
  "logPath": "/Library/Logs/Allow2/agent/"
}
```

**No registration code!** ✅

---

## Updated User Flow

### 1. Download Dialog (Simplified)

```
┌────────────────────────────────────────┐
│  Download Agent Installer              │
├────────────────────────────────────────┤
│  Platform: ● macOS  ○ Linux  ○ Windows │
│                                        │
│  Assign to Child (Optional):           │
│  [John's Computer        ▾]            │
│                                        │
│  □ Advanced: Use fixed IP address      │
│                                        │
│  [Download Installer]                  │
└────────────────────────────────────────┘
```

### 2. Save Dialog

```
┌────────────────────────────────────────┐
│  Save Agent Installer                  │
├────────────────────────────────────────┤
│  Save As:                              │
│  allow2automate-agent-darwin-x64-v1.2.1.zip│
│                                        │
│  Where: [Downloads ▾]                  │
│                                        │
│  [Cancel]              [Save]          │
└────────────────────────────────────────┘
```

### 3. Success Message (Simplified)

```
┌────────────────────────────────────────┐
│  ℹ️  Agent Installer Ready             │
│  Installer saved successfully          │
├────────────────────────────────────────┤
│  ✅ Saved to:                          │
│  ~/Downloads/allow2automate-agent-...  │
│                                        │
│  📦 Contents:                          │
│    • Agent installer (1.2.1)          │
│    • Configuration file               │
│                                        │
│  📊 Size: 45.2 MB                      │
│  🌐 Server: http://192.168.1.100:8080 │
│                                        │
│  📋 Installation:                      │
│    1. Save installer                   │
│    2. Transfer to target machine       │
│    3. Run installer                    │
│                                        │
│  🔍 Standard: Auto-discovery via mDNS  │
│                                        │
│  The installer will automatically      │
│  detect and validate the configuration │
│  when you extract and run it.          │
│                                        │
│  [OK]  [Show in Folder]  [Copy Path]  │
└────────────────────────────────────────┘
```

---

## Summary of Changes

### ❌ Removed
- Registration code generation
- Registration code validation (broken SQL)
- Registration code display in UI
- Registration code from config file
- Complex 4-step instructions

### ✅ Added
- Simplified 3-step instructions
- Optional child pre-assignment (stored in config)
- Cleaner config structure
- Better user messaging

### 🔧 How Pairing Works (Without Registration)

1. **Agent starts** → Advertises via mDNS with hostname + agentId
2. **Main app scans** → Discovers agent on local network
3. **User pairs in UI** → Main app sends pairing request to agent
4. **Agent accepts** → Saves parentApiUrl + authToken to config
5. **Policy sync begins** → Agent polls parent for policies

**No registration code needed!** The mDNS discovery + pairing flow is already fully implemented in the agent.

---

## Implementation Checklist

### Code Changes (2-3 hours)
- [ ] Update `main-agent-integration.js` IPC handler
- [ ] Update `generateAgentConfig()` in AgentUpdateService
- [ ] Update `exportInstallerBundle()` in AgentUpdateService
- [ ] Remove/deprecate registration code methods in AgentService
- [ ] Update UI component to remove registration display
- [ ] Update success dialog messages

### Testing (1 hour)
- [ ] Test installer download with child assignment
- [ ] Test installer download without child assignment
- [ ] Test advanced mode with fixed IP
- [ ] Verify config file doesn't contain registration code
- [ ] Test agent pairing flow after installation
- [ ] Verify pre-assigned child is recognized

### Documentation (30 mins)
- [ ] Update user documentation
- [ ] Update installation guide
- [ ] Add note about deprecated registration codes

**Total Estimated Time: 3.5-4.5 hours**

---

## Migration Path

### Backwards Compatibility
- Old installers with registration codes: Still work (code is ignored by agent)
- New installers without registration codes: Work immediately
- No breaking changes to agent code

### Database Cleanup (Optional)
```sql
-- Optional: Remove unused registration_codes table
-- DROP TABLE IF EXISTS registration_codes;

-- Or just leave it (doesn't hurt anything)
```

---

This simplified implementation removes all the dead code, simplifies the user experience, and makes the installation process much clearer!
