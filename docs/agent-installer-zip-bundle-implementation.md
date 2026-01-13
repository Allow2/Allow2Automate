# Agent Installer ZIP Bundle Implementation

## Architecture Confirmation

### Agent Repository (`allow2automate-agent`)
- **Pre-compiled** generic installers built by CI/CD
- **Code-signed** executables and packages
- **Published** to GitHub Releases
- **NOT rebuilt** per user (single binary for all installations)

### Main App (`automate`)
- **Downloads** pre-built installer from GitHub (caches locally)
- **Generates** config file dynamically (unique per user/server/child)
- **Bundles** installer + config into single ZIP file
- **Shows save dialog** for user to choose location

---

## Implementation

### 1. Update AgentUpdateService - Add ZIP Bundling

**File:** `/mnt/ai/automate/automate/app/services/AgentUpdateService.js`

**Add after line 606 (end of generateAgentConfig method):**

```javascript
/**
 * Create ZIP bundle with installer and config file
 * @param {string} installerPath - Path to installer file
 * @param {string} configPath - Path to config file
 * @param {string} outputPath - Path for output ZIP file
 * @returns {Promise<string>} Path to created ZIP file
 */
async createInstallerBundle(installerPath, configPath, outputPath) {
  try {
    console.log('[AgentUpdateService] Creating installer bundle...');

    const archiver = require('archiver');
    const fs = require('fs');
    const path = require('path');

    return new Promise((resolve, reject) => {
      // Create write stream for ZIP file
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Listen for completion
      output.on('close', () => {
        console.log(`[AgentUpdateService] Bundle created: ${archive.pointer()} bytes`);
        resolve(outputPath);
      });

      // Listen for errors
      archive.on('error', (err) => {
        console.error('[AgentUpdateService] Error creating bundle:', err);
        reject(err);
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('[AgentUpdateService] Archive warning:', err);
        } else {
          reject(err);
        }
      });

      // Pipe archive to output file
      archive.pipe(output);

      // Add installer to ZIP (at root level)
      const installerName = path.basename(installerPath);
      console.log(`[AgentUpdateService] Adding installer: ${installerName}`);
      archive.file(installerPath, { name: installerName });

      // Add config to ZIP (at root level)
      console.log('[AgentUpdateService] Adding config: allow2automate-agent-config.json');
      archive.file(configPath, { name: 'allow2automate-agent-config.json' });

      // Finalize the archive
      archive.finalize();
    });
  } catch (error) {
    console.error('[AgentUpdateService] Error creating installer bundle:', error);
    throw error;
  }
}

/**
 * Export installer bundle as ZIP (installer + config)
 * This is the main method called by the IPC handler
 */
async exportInstallerBundle(version, platform, serverUrl, registrationCode, advancedMode = false) {
  try {
    console.log(`[AgentUpdateService] Creating installer bundle for ${platform} v${version}...`);

    // Create temp directory for staging
    const tempDir = path.join(this.app.getPath('temp'), 'allow2-installer-staging');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Get installer file
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
      console.log(`[AgentUpdateService] Installer not cached, downloading from GitHub...`);

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

      // Download to cache
      const fileName = installerAsset.name;
      const cachePath = path.join(this.cacheDir, fileName);

      console.log(`[AgentUpdateService] Downloading from ${installerAsset.url}...`);
      await this.downloadFile(installerAsset.url, cachePath);

      // Calculate checksum and update cache
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

    // Generate config file in temp directory
    const configPath = path.join(tempDir, 'allow2automate-agent-config.json');
    const config = this.generateAgentConfig(serverUrl, registrationCode, platform, advancedMode);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

    console.log(`[AgentUpdateService] Config generated: ${configPath}`);

    // Determine ZIP filename
    // Format: allow2automate-agent-{platform}-{arch}-v{version}.zip
    const platformArch = platform === 'darwin' ? 'darwin-x64' :
                        platform === 'linux' ? 'linux-x64' :
                        platform === 'win32' ? 'win32-x64' : platform;

    const zipFileName = `allow2automate-agent-${platformArch}-v${version}.zip`;

    // Create ZIP in temp directory (will be moved by save dialog)
    const zipPath = path.join(tempDir, zipFileName);

    await this.createInstallerBundle(installerPath, configPath, zipPath);

    // Clean up temp config file (ZIP has a copy)
    fs.unlinkSync(configPath);

    console.log(`[AgentUpdateService] Installer bundle created: ${zipPath}`);

    return {
      zipPath: zipPath,
      zipFileName: zipFileName,
      version: version,
      platform: platform,
      installerName: path.basename(installerPath),
      configIncluded: true
    };

  } catch (error) {
    console.error('[AgentUpdateService] Error creating installer bundle:', error);
    throw error;
  }
}
```

---

### 2. Update Main App IPC Handler - Add Save Dialog

**File:** `/mnt/ai/automate/automate/app/main-agent-integration.js`

**Replace the `agents:download-installer` handler (lines 268-325) with:**

```javascript
// Download installer bundle with save dialog
ipcMain.handle('agents:download-installer', async (event, { platform, childId, advancedMode, customIp, customPort }) => {
  try {
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

    // Create installer bundle (ZIP with installer + config)
    console.log('[AgentIntegration] Creating installer bundle...');
    const bundle = await agentUpdateService.exportInstallerBundle(
      platformInfo.version,
      platform,
      serverUrl,
      registrationCode,
      advancedMode
    );

    // Show save dialog
    const saveResult = await dialog.showSaveDialog({
      title: 'Save Agent Installer Bundle',
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

      // Clean up temp bundle
      fs.unlinkSync(bundle.zipPath);

      return {
        success: false,
        cancelled: true,
        message: 'Save cancelled by user'
      };
    }

    // Move bundle from temp location to chosen location
    const finalPath = saveResult.filePath;
    fs.copyFileSync(bundle.zipPath, finalPath);
    fs.unlinkSync(bundle.zipPath); // Clean up temp file

    console.log(`[AgentIntegration] Installer bundle saved to: ${finalPath}`);

    // Calculate file size for display
    const stats = fs.statSync(finalPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    // Show success dialog
    const messageResult = await dialog.showMessageBox({
      type: 'info',
      title: 'Installer Bundle Created',
      message: 'Agent Installer Ready!',
      detail:
        `✅ Installer bundle saved to:\n${finalPath}\n\n` +
        `📦 Package Contents:\n` +
        `  • ${bundle.installerName}\n` +
        `  • allow2automate-agent-config.json\n\n` +
        `📊 Bundle Size: ${fileSizeMB} MB\n` +
        `🔧 Version: ${bundle.version}\n` +
        `🌐 Server: ${serverUrl}\n\n` +
        `📋 Installation Instructions:\n` +
        `1. Copy ZIP file to target device\n` +
        `2. Extract ZIP (creates both files in same folder)\n` +
        `3. Run installer\n` +
        `4. Installer will auto-detect config file\n\n` +
        (advancedMode ?
          `⚙️ Advanced Mode: Fixed IP configuration\n` +
          `   mDNS discovery disabled\n\n` :
          `🔍 Standard Mode: mDNS auto-discovery enabled\n\n`) +
        `The installer requires the config file to be in the\n` +
        `same folder. Extracting the ZIP ensures this.`,
      buttons: ['OK', 'Show in Folder', 'Copy Path'],
      defaultId: 0,
      cancelId: 0
    });

    // Handle button clicks
    if (messageResult.response === 1) {
      // Show in Folder
      require('electron').shell.showItemInFolder(finalPath);
    } else if (messageResult.response === 2) {
      // Copy Path to clipboard
      const { clipboard } = require('electron');
      clipboard.writeText(finalPath);
    }

    return {
      success: true,
      bundlePath: finalPath,
      bundleFileName: path.basename(finalPath),
      serverUrl: serverUrl,
      registrationCode: registrationCode,
      version: bundle.version,
      platform: platform,
      advancedMode: advancedMode,
      fileSize: stats.size,
      installerName: bundle.installerName
    };

  } catch (error) {
    console.error('[IPC] Error creating installer bundle:', error);

    // Show error dialog
    await dialog.showMessageBox({
      type: 'error',
      title: 'Download Failed',
      message: 'Failed to create installer bundle',
      detail: error.message,
      buttons: ['OK']
    });

    return {
      success: false,
      error: error.message
    };
  }
});
```

**Add helper function at top of file (after line 56):**

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
```

---

### 3. Add archiver Package Dependency

**File:** `/mnt/ai/automate/automate/package.json`

**Add to dependencies:**

```json
{
  "dependencies": {
    "archiver": "^6.0.1"
  }
}
```

**Install:**

```bash
cd /mnt/ai/automate/automate
npm install archiver
```

---

### 4. Update Pre-Install Scripts (No Changes Needed!)

The pre-install scripts **already search same directory**, so when user extracts ZIP:

```
~/Desktop/
├── allow2automate-agent-darwin-x64-v1.2.1.pkg
└── allow2automate-agent-config.json
```

The existing pre-install validation will find the config automatically! ✅

**Existing macOS Distribution XML (already correct):**

```javascript
// distribution.xml - lines 35-40
var installerPath = system.localizedString('PACKAGE_PATH');
var installerDir = installerPath.substring(0, installerPath.lastIndexOf('/'));
var configPath = installerDir + '/allow2automate-agent-config.json';

if (!system.files.fileExistsAtPath(configPath)) {
  // Show error...
}
```

**Existing Linux preinst script (already correct):**

```bash
# debian/preinst - lines 30-38
find_config() {
  local locations=(
    "/tmp/allow2automate-agent-config.json"
    "$(dirname "$0")/allow2automate-agent-config.json"  # ← Finds it!
    "$(pwd)/allow2automate-agent-config.json"
    "$HOME/Downloads/allow2automate-agent-config.json"
  )
}
```

---

## User Flow Example

### 1. User Clicks "Download Installer" in Main App

```
┌────────────────────────────────────────┐
│  Download Agent Installer              │
├────────────────────────────────────────┤
│  Platform: ● macOS  ○ Linux  ○ Windows │
│                                        │
│  Assign to Child: [John's Computer ▾] │
│                                        │
│  □ Advanced: Use fixed IP address      │
│                                        │
│  [Download Installer]                  │
└────────────────────────────────────────┘
```

### 2. Main App Shows Save Dialog

```
┌────────────────────────────────────────────────────┐
│  Save Agent Installer Bundle                       │
├────────────────────────────────────────────────────┤
│  Save As: allow2automate-agent-darwin-x64-v1.2.1.zip│
│                                                    │
│  Where:   [Downloads ▾]                            │
│           /Users/andrew/Downloads                  │
│                                                    │
│  Tags:    [              ] [+]                     │
│                                                    │
│           [Cancel]                 [Save]          │
└────────────────────────────────────────────────────┘
```

### 3. Main App Shows Success Message

```
┌────────────────────────────────────────────────────┐
│  ℹ️  Installer Bundle Created                      │
│  Agent Installer Ready!                            │
├────────────────────────────────────────────────────┤
│  ✅ Installer bundle saved to:                     │
│  /Users/andrew/Downloads/                          │
│  allow2automate-agent-darwin-x64-v1.2.1.zip        │
│                                                    │
│  📦 Package Contents:                              │
│    • allow2automate-agent-darwin-x64-v1.2.1.pkg   │
│    • allow2automate-agent-config.json             │
│                                                    │
│  📊 Bundle Size: 45.2 MB                           │
│  🔧 Version: 1.2.1                                 │
│  🌐 Server: http://192.168.1.100:8080             │
│                                                    │
│  📋 Installation Instructions:                     │
│  1. Copy ZIP file to target device                │
│  2. Extract ZIP (creates both files in folder)    │
│  3. Run installer                                 │
│  4. Installer will auto-detect config file        │
│                                                    │
│  🔍 Standard Mode: mDNS auto-discovery enabled    │
│                                                    │
│  The installer requires the config file to be in  │
│  the same folder. Extracting the ZIP ensures this.│
│                                                    │
│  [OK]  [Show in Folder]  [Copy Path]              │
└────────────────────────────────────────────────────┘
```

### 4. User Transfers ZIP to Target Device

```bash
# Option A: Email
# User emails the single ZIP file

# Option B: USB drive
# User copies ZIP to USB, plugs into target

# Option C: AirDrop/Network share
# User sends ZIP over network
```

### 5. User Extracts ZIP on Target Device

```bash
# macOS Finder: Double-click ZIP
# Result:
~/Desktop/
├── allow2automate-agent-darwin-x64-v1.2.1.pkg
└── allow2automate-agent-config.json

# Linux command line:
$ unzip allow2automate-agent-linux-x64-v1.2.1.zip
Archive:  allow2automate-agent-linux-x64-v1.2.1.zip
  inflating: allow2automate-agent-linux-x64-v1.2.1.deb
  inflating: allow2automate-agent-config.json
```

### 6. User Runs Installer

```bash
# macOS: Double-click PKG
# Pre-install script finds config in same folder ✅

# Linux:
$ sudo dpkg -i allow2automate-agent-linux-x64-v1.2.1.deb
Found configuration file: ./allow2automate-agent-config.json ✅
Configuration validated successfully
```

---

## Benefits Summary

### Single ZIP File ✅
- **One file to manage** - no risk of separating installer from config
- **Email-friendly** - single attachment
- **Network transfer** - simpler for remote deployments
- **Guarantees co-location** - unzip always creates both files together

### Save Dialog ✅
- **User control** - choose exact save location
- **Clear confirmation** - user sees where file is saved
- **Standard UX** - consistent with all desktop apps
- **No surprise downloads** - user explicitly chooses location

### Pre-Install Validation (Already Implemented) ✅
- **Auto-detection** - finds config in same folder
- **Validation** - checks JSON syntax and required fields
- **User confirmation** - shows config contents before install
- **Fail-safe** - won't install without valid config

---

## File Structure Comparison

### Before (Two Separate Files):
```
~/Downloads/
├── allow2automate-agent-darwin-x64-v1.2.1.pkg    ← Easy to lose
└── allow2automate-agent-config.json              ← Easy to lose
```

**Problems:**
- User might email just the PKG
- Files could be in different folders
- Config might be deleted accidentally

### After (Single ZIP Bundle):
```
~/Downloads/
└── allow2automate-agent-darwin-x64-v1.2.1.zip
    ├── allow2automate-agent-darwin-x64-v1.2.1.pkg
    └── allow2automate-agent-config.json
```

**Benefits:**
- Single file - impossible to separate
- Unzip creates correct structure
- Pre-install always finds config

---

## Implementation Checklist

### Phase 1: Core Changes (2-3 hours)
- [ ] Add `archiver` dependency to package.json
- [ ] Implement `createInstallerBundle()` in AgentUpdateService
- [ ] Implement `exportInstallerBundle()` in AgentUpdateService
- [ ] Add `getPreferredIPAddress()` helper function
- [ ] Update `agents:download-installer` IPC handler
- [ ] Update success/error dialog messages

### Phase 2: Testing (1-2 hours)
- [ ] Test ZIP creation (verify contents)
- [ ] Test save dialog (cancel, save, different locations)
- [ ] Test ZIP extraction on each platform
- [ ] Test pre-install finds config from extracted ZIP
- [ ] Test file permissions in ZIP
- [ ] Test large installer files (streaming)

### Phase 3: Edge Cases (1 hour)
- [ ] Handle disk full during ZIP creation
- [ ] Handle save to read-only location
- [ ] Handle network drive saves
- [ ] Handle filename conflicts
- [ ] Handle cancelled save dialog

**Total Estimated Time: 4-6 hours**

---

## Migration Notes

### Backwards Compatibility
The new ZIP approach is **fully compatible** with existing pre-install scripts because:

1. Pre-install scripts **already check same directory**
2. Extracting ZIP creates **exact same structure** as manual copy
3. No changes needed to agent installer code

### Gradual Rollout
1. Deploy updated main app first
2. Existing agent installers continue to work
3. New downloads use ZIP format
4. Users can still manually download installer + config separately if needed

---

## Summary

This implementation provides:

✅ **Single file download** (ZIP bundle)
✅ **User-controlled save location** (save dialog)
✅ **Guaranteed co-location** (unzip creates both files)
✅ **Existing validation works** (no pre-install changes needed)
✅ **Better UX** (standard desktop app behavior)
✅ **Email/transfer friendly** (one file to send)
✅ **Fail-safe installation** (config always found)

The architecture is confirmed and the implementation is straightforward!
