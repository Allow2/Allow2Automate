import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * AgentUpdateService - Manages auto-updates for network monitoring agents
 *
 * Features:
 * - Checks GitHub releases for new agent versions
 * - Downloads and caches installer files
 * - Serves installers to agents via HTTPS
 * - Verifies checksums before serving
 */
export default class AgentUpdateService {
  constructor(agentService, app) {
    this.agentService = agentService;
    this.app = app;
    this.currentVersion = process.env.BUNDLED_AGENT_VERSION || '1.0.0';
    this.updateCheckInterval = null;
    this.versionCheckInterval = null;
    this.installerCache = new Map(); // version -> { platform -> { path, checksum } }
    this.uninstallScriptCache = new Map(); // platform -> { path, version }
    this.releases = []; // All release metadata
    this.latestVersions = {}; // { platform -> { version, checksum, uninstallUrl } }
    this.cacheDir = path.join(app.getPath('userData'), 'agent-installers');
  }

  /**
   * Start the update service
   */
  async start() {
    console.log('[AgentUpdateService] Starting...');

    // Ensure cache directory exists
    await this.ensureCacheDirectory();

    // Load cached installers and uninstall scripts
    await this.loadCachedInstallers();
    await this.loadCachedUninstallScripts();

    // Check for latest versions immediately
    await this.checkLatestVersions();

    // Check for latest versions every 24 hours
    this.versionCheckInterval = setInterval(async () => {
      await this.checkLatestVersions();
    }, 24 * 60 * 60 * 1000);

    console.log('[AgentUpdateService] Started successfully');
  }

  /**
   * Ensure cache directory exists
   */
  async ensureCacheDirectory() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Clean up temp staging directory on startup
    await this.cleanupTempStaging();
  }

  /**
   * Clean up temporary staging directory
   * Removes old bundle files (DMG, ZIP) that are no longer needed
   * Also unmounts any orphaned DMG volumes on macOS
   */
  async cleanupTempStaging() {
    try {
      // On macOS, also clean up orphaned DMG mounts
      if (process.platform === 'darwin') {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        try {
          // Find all mounted volumes matching our naming pattern
          const volumes = fs.readdirSync('/Volumes').filter(v =>
            v.startsWith('Allow2 Automate Agent')
          );

          for (const volume of volumes) {
            const volumePath = `/Volumes/${volume}`;
            try {
              console.log(`[AgentUpdateService] Unmounting orphaned DMG on startup: ${volumePath}`);
              await execAsync(`hdiutil detach "${volumePath}" -force`);
            } catch (e) {
              // Ignore - might not be a DMG or already unmounted
            }
          }
        } catch (e) {
          // Ignore - /Volumes might not be readable
        }
      }

      const tempDir = path.join(this.app.getPath('temp'), 'allow2-installer-staging');
      if (!fs.existsSync(tempDir)) {
        return;
      }

      const files = fs.readdirSync(tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        try {
          const stat = fs.statSync(filePath);
          const age = now - stat.mtimeMs;

          // Remove files older than 24 hours, or any dmg-staging directories
          if (age > maxAge || file.startsWith('dmg-staging-')) {
            if (stat.isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
            console.log(`[AgentUpdateService] Cleaned up old temp file: ${file}`);
          }
        } catch (e) {
          // Ignore errors for individual files
        }
      }
    } catch (error) {
      console.warn('[AgentUpdateService] Error cleaning up temp staging:', error.message);
    }
  }

  /**
   * Clean up old bundle files (DMG/ZIP) for a specific platform before creating new ones
   * @param {string} tempDir - The staging directory
   * @param {string} platform - Platform to clean up (darwin, linux, win32)
   */
  async cleanupOldBundles(tempDir, platform) {
    try {
      if (!fs.existsSync(tempDir)) {
        return;
      }

      const files = fs.readdirSync(tempDir);
      const platformArch = platform === 'darwin' ? 'darwin-universal' :
                          platform === 'linux' ? 'linux-x64' :
                          platform === 'win32' ? 'win32-x64' : platform;

      // Pattern to match bundle files for this platform
      const bundlePattern = new RegExp(`^allow2automate-agent-${platformArch}-v.*\\.(dmg|zip)$`);

      for (const file of files) {
        if (bundlePattern.test(file)) {
          const filePath = path.join(tempDir, file);
          try {
            fs.unlinkSync(filePath);
            console.log(`[AgentUpdateService] Cleaned up old bundle: ${file}`);
          } catch (e) {
            // Ignore errors
          }
        }
      }
    } catch (error) {
      console.warn('[AgentUpdateService] Error cleaning up old bundles:', error.message);
    }
  }

  /**
   * Clean up old cached installers, keeping only the latest version per platform
   */
  async pruneInstallerCache() {
    try {
      // Group cached versions by platform
      const platformVersions = {};

      for (const [version, platforms] of this.installerCache.entries()) {
        for (const platform of Object.keys(platforms)) {
          if (!platformVersions[platform]) {
            platformVersions[platform] = [];
          }
          platformVersions[platform].push({ version, ...platforms[platform] });
        }
      }

      // Sort versions and keep only the latest for each platform
      for (const [platform, versions] of Object.entries(platformVersions)) {
        // Sort by version (semver-like comparison)
        versions.sort((a, b) => {
          const aParts = a.version.split('.').map(Number);
          const bParts = b.version.split('.').map(Number);
          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aVal = aParts[i] || 0;
            const bVal = bParts[i] || 0;
            if (aVal !== bVal) return bVal - aVal; // Descending
          }
          return 0;
        });

        // Keep only the latest version, delete the rest
        for (let i = 1; i < versions.length; i++) {
          const oldVersion = versions[i];
          try {
            if (fs.existsSync(oldVersion.path)) {
              fs.unlinkSync(oldVersion.path);
              console.log(`[AgentUpdateService] Pruned old installer: ${path.basename(oldVersion.path)}`);
            }

            // Remove from cache
            const versionCache = this.installerCache.get(oldVersion.version);
            if (versionCache) {
              delete versionCache[platform];
              if (Object.keys(versionCache).length === 0) {
                this.installerCache.delete(oldVersion.version);
              }
            }
          } catch (e) {
            console.warn(`[AgentUpdateService] Failed to prune ${oldVersion.path}:`, e.message);
          }
        }
      }
    } catch (error) {
      console.warn('[AgentUpdateService] Error pruning installer cache:', error.message);
    }
  }

  /**
   * Load cached installers from disk
   */
  async loadCachedInstallers() {
    try {
      const files = fs.readdirSync(this.cacheDir);

      for (const file of files) {
        // Match installer files: allow2automate-agent-VERSION-PLATFORM.EXT
        // Also match GitHub release format: allow2automate-agent-darwin-universal-vVERSION.pkg
        let match = file.match(/^allow2automate-agent-(.+)-(win32|darwin|linux)\.(exe|dmg|deb|pkg|msi|rpm)$/);

        // Try alternate GitHub release naming pattern
        if (!match) {
          match = file.match(/^allow2automate-agent-(darwin|linux|win)-(?:universal|x64|amd64)-v?(.+)\.(pkg|deb|rpm|exe|msi)$/);
          if (match) {
            // Swap platform and version for alternate pattern
            const [, platformPart, version, ext] = match;
            const platform = platformPart === 'darwin' ? 'darwin' : platformPart === 'linux' ? 'linux' : 'win32';
            match = [null, version, platform, ext];
          }
        }

        if (match) {
          const [, version, platform, ext] = match;
          const filePath = path.join(this.cacheDir, file);
          const checksum = await this.calculateChecksum(filePath);

          if (!this.installerCache.has(version)) {
            this.installerCache.set(version, {});
          }

          this.installerCache.get(version)[platform] = {
            path: filePath,
            checksum,
            ext
          };
        }
      }

      console.log(`[AgentUpdateService] Loaded ${this.installerCache.size} versions from cache`);

      // Prune old versions, keeping only the latest per platform
      await this.pruneInstallerCache();
    } catch (error) {
      console.error('[AgentUpdateService] Error loading cached installers:', error);
    }
  }

  /**
   * Load cached uninstall scripts from disk
   */
  async loadCachedUninstallScripts() {
    try {
      const files = fs.readdirSync(this.cacheDir);

      for (const file of files) {
        const match = file.match(/^uninstall-(win32|darwin|linux)-(.+)\.(bat|sh)$/);
        if (match) {
          const [, platform, version, ext] = match;
          const filePath = path.join(this.cacheDir, file);

          this.uninstallScriptCache.set(platform, {
            path: filePath,
            version,
            ext
          });
        }
      }

      console.log(`[AgentUpdateService] Loaded ${this.uninstallScriptCache.size} uninstall scripts from cache`);
    } catch (error) {
      console.error('[AgentUpdateService] Error loading cached uninstall scripts:', error);
    }
  }

  /**
   * Check for latest agent versions on GitHub
   * This fetches all releases and determines the latest version per platform
   */
  async checkLatestVersions() {
    try {
      console.log('[AgentUpdateService] Checking for latest agent versions...');

      const https = require('https');

      // Fetch all releases from GitHub API
      const options = {
        hostname: 'api.github.com',
        path: '/repos/Allow2/allow2automate-agent/releases',
        method: 'GET',
        headers: {
          'User-Agent': 'Allow2Automate-UpdateService',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const releasesData = await new Promise((resolve, reject) => {
        https.get(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(error);
            }
          });
        }).on('error', reject);
      });

      if (!releasesData || releasesData.length === 0) {
        console.log('[AgentUpdateService] No releases found');
        return this.latestVersions;
      }

      // Platform mapping for asset detection
      const platformMap = {
        'win32': { extensions: ['.msi', '.exe'], assetPattern: /windows|win32|win/i, uninstallExt: '.bat' },
        'darwin': { extensions: ['.pkg', '.dmg'], assetPattern: /macos|darwin|osx/i, uninstallExt: '.sh' },
        'linux': { extensions: ['.deb', '.rpm', '.AppImage'], assetPattern: /linux/i, uninstallExt: '.sh' }
      };

      // Pattern to match the universal Linux install script (versioned)
      const linuxScriptPattern = /^install-allow2-agent-v.*\.sh$/;

      // Store all releases
      this.releases = releasesData.map(release => {
        const version = release.tag_name.replace(/^v/, '');
        const assets = [];

        // Find installer assets for each platform
        for (const [platform, config] of Object.entries(platformMap)) {
          const installerAsset = release.assets.find(a =>
            config.assetPattern.test(a.name) &&
            config.extensions.some(ext => a.name.endsWith(ext)) &&
            !a.name.includes('uninstall')
          );

          if (installerAsset) {
            const ext = config.extensions.find(e => installerAsset.name.endsWith(e)) || config.extensions[0];
            assets.push({
              name: installerAsset.name,
              url: installerAsset.browser_download_url,
              platform,
              type: 'installer',
              ext: ext.replace('.', '')
            });
          }

          // Find uninstall script asset
          const uninstallAsset = release.assets.find(a =>
            a.name.includes('uninstall') &&
            config.assetPattern.test(a.name) &&
            a.name.endsWith(config.uninstallExt)
          );

          if (uninstallAsset) {
            assets.push({
              name: uninstallAsset.name,
              url: uninstallAsset.browser_download_url,
              platform,
              type: 'uninstall',
              ext: config.uninstallExt.replace('.', '')
            });
          }
        }

        // Find Linux universal install script (versioned)
        const scriptAsset = release.assets.find(a =>
          linuxScriptPattern.test(a.name)
        );

        if (scriptAsset) {
          assets.push({
            name: scriptAsset.name,
            url: scriptAsset.browser_download_url,
            platform: 'linux',
            type: 'script',
            ext: 'sh'
          });
        }

        return {
          version,
          tag: release.tag_name,
          assets,
          publishedAt: release.published_at
        };
      });

      // Determine latest version for each platform
      for (const [platform] of Object.entries(platformMap)) {
        // Find the latest release that has an installer for this platform
        const latestRelease = this.releases.find(r =>
          r.assets.some(a => a.platform === platform && a.type === 'installer')
        );

        if (latestRelease) {
          const installerAsset = latestRelease.assets.find(a =>
            a.platform === platform && a.type === 'installer'
          );
          const uninstallAsset = latestRelease.assets.find(a =>
            a.platform === platform && a.type === 'uninstall'
          );

          // Try to get checksum from cached installer if available
          let checksum = null;
          const cachedVersion = this.installerCache.get(latestRelease.version);
          if (cachedVersion && cachedVersion[platform]) {
            checksum = cachedVersion[platform].checksum;
          }

          this.latestVersions[platform] = {
            version: latestRelease.version,
            installerUrl: installerAsset.url,
            installerName: installerAsset.name,
            installerExt: installerAsset.ext,
            checksum,
            uninstallUrl: uninstallAsset ? uninstallAsset.url : null,
            uninstallName: uninstallAsset ? uninstallAsset.name : null
          };

          // For Linux, also include the universal install script info
          if (platform === 'linux') {
            const scriptAsset = latestRelease.assets.find(a =>
              a.platform === 'linux' && a.type === 'script'
            );
            if (scriptAsset) {
              this.latestVersions[platform].scriptUrl = scriptAsset.url;
              this.latestVersions[platform].scriptName = scriptAsset.name;
              // Checksum will be calculated when script is downloaded/cached
              this.latestVersions[platform].scriptChecksum = null;
            }
          }
        }
      }

      // If we have a Linux script, try to download and calculate checksum
      if (this.latestVersions.linux && this.latestVersions.linux.scriptUrl) {
        try {
          const scriptChecksum = await this.downloadAndCacheLinuxScript(
            this.latestVersions.linux.scriptUrl,
            this.latestVersions.linux.scriptName,
            this.latestVersions.linux.version
          );
          this.latestVersions.linux.scriptChecksum = scriptChecksum;
        } catch (err) {
          console.warn('[AgentUpdateService] Could not cache Linux script:', err.message);
        }
      }

      console.log('[AgentUpdateService] Latest versions:', this.latestVersions);
      return this.latestVersions;

    } catch (error) {
      console.error('[AgentUpdateService] Error checking for latest versions:', error);
      throw error;
    }
  }

  /**
   * Check for new agent updates on GitHub
   */
  async checkForUpdates() {
    try {
      console.log('[AgentUpdateService] Checking for agent updates...');

      const https = require('https');

      // Fetch latest release from GitHub API
      const options = {
        hostname: 'api.github.com',
        path: '/repos/Allow2/allow2automate-agent/releases/latest',
        method: 'GET',
        headers: {
          'User-Agent': 'Allow2Automate-UpdateService',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const releaseData = await new Promise((resolve, reject) => {
        https.get(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(error);
            }
          });
        }).on('error', reject);
      });

      if (!releaseData || !releaseData.tag_name) {
        console.log('[AgentUpdateService] No releases found');
        return;
      }

      const latestVersion = releaseData.tag_name.replace(/^v/, '');

      if (latestVersion > this.currentVersion) {
        console.log(`[AgentUpdateService] New version available: ${latestVersion}`);
        await this.downloadRelease(releaseData);
      } else {
        console.log('[AgentUpdateService] No updates available');
      }
    } catch (error) {
      console.error('[AgentUpdateService] Error checking for updates:', error);
    }
  }

  /**
   * Download a release from GitHub
   */
  async downloadRelease(release) {
    try {
      console.log(`[AgentUpdateService] Downloading release: ${release.tag_name}`);

      const https = require('https');
      const version = release.tag_name.replace(/^v/, '');

      // Platform mapping for asset detection
      const platformMap = {
        'win32': { extensions: ['.msi', '.exe'], assetPattern: /windows|win32|win/i },
        'darwin': { extensions: ['.pkg', '.dmg'], assetPattern: /macos|darwin|osx/i },
        'linux': { extensions: ['.deb', '.rpm', '.AppImage'], assetPattern: /linux/i }
      };

      for (const [platform, config] of Object.entries(platformMap)) {
        // Find matching asset
        const asset = release.assets.find(a =>
          config.assetPattern.test(a.name) &&
          config.extensions.some(ext => a.name.endsWith(ext))
        );

        if (!asset) {
          console.log(`[AgentUpdateService] No ${platform} installer found in release`);
          continue;
        }

        // Determine file extension
        const ext = config.extensions.find(e => asset.name.endsWith(e)) || config.extensions[0];
        const fileName = `allow2automate-agent-${version}-${platform}${ext}`;
        const filePath = path.join(this.cacheDir, fileName);

        // Download the file
        console.log(`[AgentUpdateService] Downloading ${platform} installer...`);
        await this.downloadFile(asset.browser_download_url, filePath);

        // Calculate checksum
        const checksum = await this.calculateChecksum(filePath);

        // Store in cache
        if (!this.installerCache.has(version)) {
          this.installerCache.set(version, {});
        }

        this.installerCache.get(version)[platform] = {
          path: filePath,
          checksum,
          ext: ext.replace('.', '')
        };

        console.log(`[AgentUpdateService] Downloaded ${platform} installer successfully`);
      }

      // Update current version
      this.currentVersion = version;
      console.log(`[AgentUpdateService] Release ${version} downloaded successfully`);

    } catch (error) {
      console.error('[AgentUpdateService] Error downloading release:', error);
      throw error;
    }
  }

  /**
   * Download a file from URL
   */
  async downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const file = fs.createWriteStream(destination);

      https.get(url, {
        headers: { 'User-Agent': 'Allow2Automate-UpdateService' }
      }, (response) => {
        // Handle redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          return this.downloadFile(response.headers.location, destination)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          fs.unlink(destination, () => {});
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (err) => {
          fs.unlink(destination, () => {});
          reject(err);
        });
      }).on('error', (err) => {
        fs.unlink(destination, () => {});
        reject(err);
      });
    });
  }

  /**
   * Download and cache Linux universal install script
   * @param {string} url - Download URL for the script
   * @param {string} fileName - Script filename
   * @param {string} version - Version number
   * @returns {Promise<string>} SHA256 checksum of the script
   */
  async downloadAndCacheLinuxScript(url, fileName, version) {
    try {
      const cachePath = path.join(this.cacheDir, fileName);

      // Check if already cached with matching version
      if (fs.existsSync(cachePath)) {
        // Verify it's current by checking filename contains version
        if (fileName.includes(version) || fileName.includes(`v${version}`)) {
          const checksum = await this.calculateChecksum(cachePath);
          console.log(`[AgentUpdateService] Using cached Linux script: ${fileName}`);
          return checksum;
        }
      }

      // Download the script
      console.log(`[AgentUpdateService] Downloading Linux install script: ${fileName}`);
      await this.downloadFile(url, cachePath);

      // Calculate checksum
      const checksum = await this.calculateChecksum(cachePath);
      console.log(`[AgentUpdateService] Linux script cached with checksum: ${checksum.substring(0, 16)}...`);

      return checksum;
    } catch (error) {
      console.error('[AgentUpdateService] Error caching Linux script:', error);
      throw error;
    }
  }

  /**
   * Get cached Linux install script path
   * @param {string} version - Version to get
   * @returns {string|null} Path to cached script or null
   */
  getCachedLinuxScript(version) {
    const linux = this.latestVersions.linux;
    if (!linux || !linux.scriptName) return null;

    const cachePath = path.join(this.cacheDir, linux.scriptName);
    if (fs.existsSync(cachePath)) {
      return cachePath;
    }
    return null;
  }

  /**
   * Export Linux install script to destination
   * @param {string} destinationPath - Destination directory
   * @returns {Promise<Object>} Script info
   */
  async exportLinuxScript(destinationPath) {
    try {
      const linux = this.latestVersions.linux;
      if (!linux || !linux.scriptUrl) {
        throw new Error('No Linux install script available');
      }

      // Ensure we have it cached
      if (!linux.scriptChecksum) {
        linux.scriptChecksum = await this.downloadAndCacheLinuxScript(
          linux.scriptUrl,
          linux.scriptName,
          linux.version
        );
      }

      const cachePath = path.join(this.cacheDir, linux.scriptName);
      const destPath = path.join(destinationPath, linux.scriptName);

      // Copy to destination
      fs.copyFileSync(cachePath, destPath);

      // Make executable
      fs.chmodSync(destPath, 0o755);

      console.log(`[AgentUpdateService] Exported Linux script to ${destPath}`);

      return {
        scriptPath: destPath,
        scriptName: linux.scriptName,
        version: linux.version,
        checksum: linux.scriptChecksum
      };
    } catch (error) {
      console.error('[AgentUpdateService] Error exporting Linux script:', error);
      throw error;
    }
  }

  /**
   * Serve installer file to an agent
   */
  async serveInstaller(agentId, version, platform, response) {
    try {
      const versionCache = this.installerCache.get(version);
      if (!versionCache || !versionCache[platform]) {
        response.status(404).json({ error: 'Installer not found' });
        return;
      }

      const installer = versionCache[platform];

      // Verify checksum
      const currentChecksum = await this.calculateChecksum(installer.path);
      if (currentChecksum !== installer.checksum) {
        console.error('[AgentUpdateService] Checksum mismatch for installer');
        response.status(500).json({ error: 'Installer verification failed' });
        return;
      }

      // Serve the file
      response.setHeader('Content-Type', 'application/octet-stream');
      response.setHeader('Content-Disposition', `attachment; filename="allow2automate-agent-${version}-${platform}.${installer.ext}"`);
      response.setHeader('X-Checksum-SHA256', installer.checksum);

      const fileStream = fs.createReadStream(installer.path);
      fileStream.pipe(response);

      console.log(`[AgentUpdateService] Serving installer to agent ${agentId}: v${version} ${platform}`);
    } catch (error) {
      console.error('[AgentUpdateService] Error serving installer:', error);
      response.status(500).json({ error: 'Error serving installer' });
    }
  }

  /**
   * Calculate SHA256 checksum of a file
   */
  async calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Get available disk space for a given path
   * @param {string} dirPath - Directory path to check
   * @returns {Promise<number>} Available space in bytes
   */
  async getAvailableDiskSpace(dirPath) {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      if (process.platform === 'darwin' || process.platform === 'linux') {
        // Use df command on Unix-like systems
        const { stdout } = await execAsync(`df -k "${dirPath}" | tail -1 | awk '{print $4}'`);
        const availableKB = parseInt(stdout.trim(), 10);
        return availableKB * 1024; // Convert KB to bytes
      } else if (process.platform === 'win32') {
        // Use wmic on Windows
        const driveLetter = path.parse(dirPath).root.charAt(0);
        const { stdout } = await execAsync(`wmic logicaldisk where "DeviceID='${driveLetter}:'" get FreeSpace /format:value`);
        const match = stdout.match(/FreeSpace=(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      }

      // Fallback: return a large number to skip the check
      return Number.MAX_SAFE_INTEGER;
    } catch (error) {
      console.warn('[AgentUpdateService] Could not check disk space:', error.message);
      // Return a large number to skip the check on error
      return Number.MAX_SAFE_INTEGER;
    }
  }

  /**
   * Get available installer versions
   */
  getAvailableVersions() {
    const versions = [];

    for (const [version, platforms] of this.installerCache.entries()) {
      versions.push({
        version,
        platforms: Object.keys(platforms)
      });
    }

    return versions;
  }

  /**
   * Export installer to a local directory (e.g., Downloads)
   * Downloads from GitHub if not cached
   */
  async exportInstaller(version, platform, destinationPath, serverUrl, registrationCode) {
    try {
      let installer;
      let fileName;
      let destFile;

      // Check if installer is cached
      const versionCache = this.installerCache.get(version);
      if (versionCache && versionCache[platform]) {
        // Use cached installer
        installer = versionCache[platform];
        fileName = `allow2automate-agent-${version}-${platform}.${installer.ext}`;
        destFile = path.join(destinationPath, fileName);
        fs.copyFileSync(installer.path, destFile);
        console.log(`[AgentUpdateService] Exported cached installer to ${destFile}`);
      } else {
        // Download from GitHub
        console.log(`[AgentUpdateService] Installer not cached, downloading from GitHub...`);

        // Find the release for this version
        const release = this.releases.find(r => r.version === version);
        if (!release) {
          throw new Error(`Release version ${version} not found`);
        }

        // Find the installer asset for this platform
        const installerAsset = release.assets.find(a =>
          a.platform === platform && a.type === 'installer'
        );
        if (!installerAsset) {
          throw new Error(`No installer found for ${platform} in version ${version}`);
        }

        // Download the installer
        fileName = installerAsset.name;
        const cachePath = path.join(this.cacheDir, fileName);
        destFile = path.join(destinationPath, fileName);

        console.log(`[AgentUpdateService] Downloading from ${installerAsset.url}...`);
        await this.downloadFile(installerAsset.url, cachePath);

        // Calculate checksum
        const checksum = await this.calculateChecksum(cachePath);

        // Update cache
        if (!this.installerCache.has(version)) {
          this.installerCache.set(version, {});
        }
        this.installerCache.get(version)[platform] = {
          path: cachePath,
          checksum,
          ext: installerAsset.ext
        };

        // Update latestVersions checksum if this is the latest version
        if (this.latestVersions[platform] && this.latestVersions[platform].version === version) {
          this.latestVersions[platform].checksum = checksum;
        }

        // Copy to destination
        fs.copyFileSync(cachePath, destFile);
        console.log(`[AgentUpdateService] Downloaded and exported installer to ${destFile}`);
      }

      // Generate configuration file (optional - only if serverUrl provided)
      let configFile = null;
      if (serverUrl) {
        const configFileName = 'allow2automate-agent-config.json';
        configFile = path.join(destinationPath, configFileName);

        const config = await this.generateAgentConfig(serverUrl, registrationCode, platform);
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');

        console.log(`[AgentUpdateService] Generated config file at ${configFile}`);
      }

      return { installerPath: destFile, configPath: configFile, version };
    } catch (error) {
      console.error('[AgentUpdateService] Error exporting installer:', error);
      throw error;
    }
  }

  /**
   * Generate agent configuration file with cryptographic trust fields
   * @param {string} serverUrl - Parent server URL (e.g., "http://192.168.1.100:8080")
   * @param {string} childId - Optional child ID for pre-assignment
   * @param {string} platform - Platform (win32, darwin, linux)
   * @param {boolean} advancedMode - Use fixed IP (disable mDNS)
   * @returns {Promise<Object>} Agent configuration object
   */
  async generateAgentConfig(serverUrl, childId, platform, advancedMode = false) {
    // Parse serverUrl to extract host and port
    let host = '127.0.0.1';
    let port = 8080;

    if (serverUrl) {
      try {
        const url = new URL(serverUrl);
        host = url.hostname;
        port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 8080);
      } catch (e) {
        // If URL parsing fails, try to extract host/port manually
        const match = serverUrl.match(/^(?:https?:\/\/)?([^:\/]+)(?::(\d+))?/);
        if (match) {
          host = match[1];
          port = parseInt(match[2]) || 8080;
        }
      }
    }

    // Get parent UUID from global services (REQUIRED)
    let hostUuid = null;
    const uuidManager = global.services && global.services.uuid;
    if (uuidManager) {
      hostUuid = uuidManager.getUUID();
    }
    if (!hostUuid) {
      throw new Error('Cannot generate agent config: Parent UUID not available. Ensure the agent service is fully initialized.');
    }

    // Get public key from global services (REQUIRED)
    let publicKey = null;
    const keypairManager = global.services && global.services.keypair;
    if (keypairManager) {
      try {
        publicKey = await keypairManager.getPublicKey();
      } catch (e) {
        throw new Error(`Cannot generate agent config: Failed to get public key: ${e.message}`);
      }
    }
    if (!publicKey) {
      throw new Error('Cannot generate agent config: Public key not available. Ensure the keypair service is initialized.');
    }
    if (!publicKey.includes('-----BEGIN PUBLIC KEY-----')) {
      throw new Error('Cannot generate agent config: Invalid public key format. Expected PEM-encoded public key.');
    }

    const config = {
      // Parent server host (IP or hostname)
      host,

      // Parent server port
      port,

      // Parent's UUID for mDNS discovery
      host_uuid: hostUuid,

      // Parent's public key for cryptographic verification
      public_key: publicKey,

      // Policy sync interval in milliseconds (default: 30 seconds)
      checkInterval: 30000,

      // Log level: 'error', 'warn', 'info', 'debug'
      logLevel: 'info',

      // Enable mDNS/Bonjour discovery (disable if using fixed IP)
      enableMDNS: !advancedMode,

      // Enable automatic updates
      autoUpdate: true
    };

    // Add child ID if provided (for optional pre-assignment)
    if (childId) {
      config.preAssignedChildId = childId;
    }

    // Platform-specific paths (for reference)
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
   * Unmount orphaned DMG volumes that match a name pattern
   * @param {string} volumeNamePattern - Pattern to match volume names
   */
  async unmountOrphanedDMGs(volumeNamePattern) {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      const fs = require('fs');

      // Find all mounted volumes matching the pattern (including temp mounts)
      const volumes = fs.readdirSync('/Volumes').filter(v =>
        v.startsWith(volumeNamePattern) || v === volumeNamePattern ||
        v === `${volumeNamePattern}-temp`
      );

      for (const volume of volumes) {
        const volumePath = `/Volumes/${volume}`;
        try {
          console.log(`[AgentUpdateService] Unmounting orphaned DMG: ${volumePath}`);
          await execAsync(`hdiutil detach "${volumePath}" -force`);
          console.log(`[AgentUpdateService] Successfully unmounted: ${volumePath}`);
        } catch (e) {
          // Volume might already be unmounted or busy
          console.warn(`[AgentUpdateService] Could not unmount ${volumePath}: ${e.message}`);
        }
      }

      // Also clean up any orphaned sparse images in temp directory
      const tempDir = this.app.getPath('temp');
      const stagingDir = path.join(tempDir, 'allow2-installer-staging');
      if (fs.existsSync(stagingDir)) {
        const files = fs.readdirSync(stagingDir);
        for (const file of files) {
          if (file.endsWith('.sparseimage')) {
            try {
              fs.unlinkSync(path.join(stagingDir, file));
              console.log(`[AgentUpdateService] Cleaned up orphaned sparse image: ${file}`);
            } catch (e) { /* ignore */ }
          }
        }
      }
    } catch (error) {
      // Ignore errors - /Volumes might not exist or be readable
      console.warn('[AgentUpdateService] Error checking for orphaned DMGs:', error.message);
    }
  }

  /**
   * Create DMG bundle with installer and config file (macOS only)
   * @param {string} installerPath - Path to PKG installer file
   * @param {string} configPath - Path to config file
   * @param {string} outputPath - Path for output DMG file
   * @param {string} volumeName - Name for the mounted volume
   * @returns {Promise<string>} Path to created DMG file
   */
  async createDMGBundle(installerPath, configPath, outputPath, volumeName = 'Allow2 Automate Agent') {
    try {
      console.log('[AgentUpdateService] Creating DMG bundle...');

      // DMG creation only works on macOS
      if (process.platform !== 'darwin') {
        console.log('[AgentUpdateService] Not on macOS, falling back to ZIP bundle');
        const zipPath = outputPath.replace(/\.dmg$/i, '.zip');
        return await this.createInstallerBundle(installerPath, configPath, zipPath);
      }

      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      const fsPromises = require('fs').promises;
      const fs = require('fs');
      const path = require('path');

      // CRITICAL: Clean up any orphaned DMG mounts from previous failed attempts
      // These consume virtual disk space and cause "No space left on device" errors
      console.log('[AgentUpdateService] Checking for orphaned DMG mounts...');
      await this.unmountOrphanedDMGs(volumeName);

      // Check available disk space before proceeding
      const installerSize = fs.statSync(installerPath).size;
      const requiredSpace = installerSize * 3; // Need 3x installer size (staging + DMG creation overhead)
      const availableSpace = await this.getAvailableDiskSpace(path.dirname(outputPath));

      if (availableSpace < requiredSpace) {
        console.warn(`[AgentUpdateService] Low disk space: ${Math.round(availableSpace / 1024 / 1024)}MB available, ${Math.round(requiredSpace / 1024 / 1024)}MB required`);

        // Try to clean up temp staging to free space
        await this.cleanupTempStaging();

        // Check again
        const newAvailableSpace = await this.getAvailableDiskSpace(path.dirname(outputPath));
        if (newAvailableSpace < requiredSpace) {
          throw new Error(`Insufficient disk space: ${Math.round(newAvailableSpace / 1024 / 1024)}MB available, ${Math.round(requiredSpace / 1024 / 1024)}MB required. Please free up disk space and try again.`);
        }
      }

      // Create staging directory
      const stagingDir = path.join(path.dirname(outputPath), 'dmg-staging-' + Date.now());
      await fsPromises.mkdir(stagingDir, { recursive: true });

      try {
        // Copy installer to staging
        const installerName = path.basename(installerPath);
        await fsPromises.copyFile(installerPath, path.join(stagingDir, installerName));
        console.log(`[AgentUpdateService] Added installer: ${installerName}`);

        // Copy config to staging
        await fsPromises.copyFile(configPath, path.join(stagingDir, 'allow2automate-agent-config.json'));
        console.log('[AgentUpdateService] Added config: allow2automate-agent-config.json');

        // Create README file
        const readmeContent = `Allow2 Automate Agent Installer
================================

Installation Instructions:
1. Double-click the PKG file (${installerName}) to start installation
2. The configuration file (allow2automate-agent-config.json) will be
   automatically detected from this mounted volume during installation

The installer will:
- Install the Allow2 Automate Agent service
- Configure it to connect to your parent device
- Start the agent automatically

After installation, the agent will appear in your parent's device list
within a few minutes.

For support, visit: https://allow2.com/support
`;
        await fsPromises.writeFile(path.join(stagingDir, 'README.txt'), readmeContent);

        // Remove existing DMG if present
        try {
          await fsPromises.unlink(outputPath);
        } catch (e) {
          // File doesn't exist, that's fine
        }

        // Calculate required size with generous padding
        // hdiutil's auto-sizing often fails, so we calculate manually
        let totalSize = 0;
        const stagingFiles = await fsPromises.readdir(stagingDir);
        for (const file of stagingFiles) {
          const fileStat = await fsPromises.stat(path.join(stagingDir, file));
          totalSize += fileStat.size;
        }
        // Add 50% padding for filesystem overhead, minimum 50MB
        const sizeInMB = Math.max(50, Math.ceil((totalSize * 1.5) / (1024 * 1024)));
        console.log(`[AgentUpdateService] Content size: ${Math.round(totalSize / 1024 / 1024)}MB, allocating ${sizeInMB}MB for DMG`);

        // Two-step DMG creation for reliability:
        // 1. Create a sparse image with explicit size
        // 2. Mount it and copy files
        // 3. Unmount and convert to compressed DMG
        const sparseImagePath = outputPath.replace(/\.dmg$/i, '.sparseimage');

        try {
          // Step 1: Create sparse disk image with explicit size
          console.log('[AgentUpdateService] Creating sparse image...');
          await execAsync(`hdiutil create -size ${sizeInMB}m -fs HFS+ -volname "${volumeName}" -type SPARSE "${sparseImagePath}"`);

          // Step 2: Mount the sparse image
          console.log('[AgentUpdateService] Mounting sparse image...');
          const mountResult = await execAsync(`hdiutil attach "${sparseImagePath}" -mountpoint "/Volumes/${volumeName}-temp"`);
          const mountPoint = `/Volumes/${volumeName}-temp`;

          try {
            // Step 3: Copy files to mounted volume
            console.log('[AgentUpdateService] Copying files to image...');
            for (const file of stagingFiles) {
              await fsPromises.copyFile(
                path.join(stagingDir, file),
                path.join(mountPoint, file)
              );
            }

            // Step 4: Unmount
            console.log('[AgentUpdateService] Unmounting image...');
            await execAsync(`hdiutil detach "${mountPoint}"`);

          } catch (copyError) {
            // Make sure to unmount on error
            try {
              await execAsync(`hdiutil detach "${mountPoint}" -force`);
            } catch (e) { /* ignore */ }
            throw copyError;
          }

          // Step 5: Convert sparse image to compressed DMG
          console.log('[AgentUpdateService] Converting to compressed DMG...');
          await execAsync(`hdiutil convert "${sparseImagePath}" -format UDZO -o "${outputPath}"`);

          console.log(`[AgentUpdateService] DMG created: ${outputPath}`);

        } finally {
          // Clean up sparse image
          try {
            await fsPromises.unlink(sparseImagePath);
          } catch (e) { /* ignore */ }
        }

        return outputPath;

      } finally {
        // Clean up staging directory
        try {
          await fsPromises.rm(stagingDir, { recursive: true, force: true });
        } catch (e) {
          // Ignore cleanup errors
        }
      }

    } catch (error) {
      console.error('[AgentUpdateService] Error creating DMG bundle:', error);
      throw error;
    }
  }

  /**
   * Export installer bundle as ZIP (installer + config)
   * @param {string} version - Version to export
   * @param {string} platform - Platform (darwin, linux, win32)
   * @param {string} serverUrl - Parent server URL
   * @param {string} childId - Optional child ID for pre-assignment
   * @param {boolean} advancedMode - Use fixed IP mode
   * @param {Function} onProgress - Optional progress callback (progress: number, stage: string) => void
   * @returns {Promise<Object>} Bundle information
   */
  async exportInstallerBundle(version, platform, serverUrl, childId = null, advancedMode = false, onProgress = null) {
    // Helper to report progress
    const reportProgress = (progress, stage) => {
      if (onProgress) {
        onProgress(progress, stage);
      }
    };

    try {
      console.log(`[AgentUpdateService] Creating installer bundle for ${platform} v${version}...`);
      reportProgress(20, 'Preparing...');

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
        reportProgress(50, 'Using cached installer...');
      } else {
        // Download from GitHub
        console.log(`[AgentUpdateService] Downloading installer from GitHub...`);
        reportProgress(25, 'Downloading from GitHub...');

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

        reportProgress(30, 'Downloading installer...');
        await this.downloadFile(installerAsset.url, cachePath);
        reportProgress(50, 'Download complete...');

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

        // Prune old versions to save disk space
        await this.pruneInstallerCache();

        installerPath = cachePath;
        installerExt = installerAsset.ext;
      }

      // Clean up any old bundle files for this platform before creating new ones
      await this.cleanupOldBundles(tempDir, platform);

      // Generate config file (NO registration code)
      reportProgress(55, 'Generating configuration...');
      const configPath = path.join(tempDir, 'allow2automate-agent-config.json');
      const config = await this.generateAgentConfig(serverUrl, childId, platform, advancedMode);
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

      console.log(`[AgentUpdateService] Config generated: ${configPath}`);
      reportProgress(60, 'Configuration ready...');

      // Determine bundle filename and type
      const platformArch = platform === 'darwin' ? 'darwin-universal' :
                          platform === 'linux' ? 'linux-x64' :
                          platform === 'win32' ? 'win32-x64' : platform;

      let bundlePath;
      let bundleFileName;

      // For macOS target, create DMG if we're running on macOS (hdiutil available)
      // Otherwise fall back to ZIP
      if (platform === 'darwin' && process.platform === 'darwin') {
        bundleFileName = `allow2automate-agent-${platformArch}-v${version}.dmg`;
        bundlePath = path.join(tempDir, bundleFileName);

        // Create DMG bundle
        reportProgress(65, 'Creating DMG bundle...');
        await this.createDMGBundle(installerPath, configPath, bundlePath);
      } else {
        bundleFileName = `allow2automate-agent-${platformArch}-v${version}.zip`;
        bundlePath = path.join(tempDir, bundleFileName);

        // Create ZIP bundle
        reportProgress(65, 'Creating ZIP bundle...');
        await this.createInstallerBundle(installerPath, configPath, bundlePath);
      }

      reportProgress(80, 'Bundle ready...');

      // Clean up temp config file
      await fs.promises.unlink(configPath).catch(() => {});

      console.log(`[AgentUpdateService] Bundle created: ${bundlePath}`);

      return {
        bundlePath: bundlePath,
        bundleFileName: bundleFileName,
        // Keep legacy zipPath/zipFileName for backward compatibility
        zipPath: bundlePath,
        zipFileName: bundleFileName,
        version: version,
        platform: platform,
        installerName: path.basename(installerPath),
        bundleType: bundleFileName.endsWith('.dmg') ? 'dmg' : 'zip'
      };

    } catch (error) {
      console.error('[AgentUpdateService] Error creating installer bundle:', error);
      throw error;
    }
  }

  /**
   * Download installer directly from GitHub (for latest version)
   */
  async downloadFromGitHub(platform, destinationPath, serverUrl, registrationCode) {
    try {
      console.log(`[AgentUpdateService] Downloading latest installer for ${platform}...`);

      const https = require('https');

      // Fetch latest release from GitHub API
      const options = {
        hostname: 'api.github.com',
        path: '/repos/Allow2/allow2automate-agent/releases/latest',
        method: 'GET',
        headers: {
          'User-Agent': 'Allow2Automate-UpdateService',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const releaseData = await new Promise((resolve, reject) => {
        https.get(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(error);
            }
          });
        }).on('error', reject);
      });

      if (!releaseData || !releaseData.assets) {
        throw new Error('No releases found on GitHub');
      }

      // Platform mapping for asset detection
      const platformMap = {
        'win32': { extensions: ['.msi', '.exe'], assetPattern: /windows|win32|win/i },
        'darwin': { extensions: ['.pkg', '.dmg'], assetPattern: /macos|darwin|osx/i },
        'linux': { extensions: ['.deb', '.rpm', '.AppImage'], assetPattern: /linux/i }
      };

      const config = platformMap[platform];
      if (!config) {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      // Find matching asset
      const asset = releaseData.assets.find(a =>
        config.assetPattern.test(a.name) &&
        config.extensions.some(ext => a.name.endsWith(ext))
      );

      if (!asset) {
        throw new Error(`No installer found for ${platform} in latest release`);
      }

      // Determine file extension
      const ext = config.extensions.find(e => asset.name.endsWith(e)) || config.extensions[0];
      const version = releaseData.tag_name.replace(/^v/, '');
      const fileName = `allow2automate-agent-${version}-${platform}${ext}`;
      const filePath = path.join(destinationPath, fileName);

      // Download the file
      console.log(`[AgentUpdateService] Downloading from ${asset.browser_download_url}...`);
      await this.downloadFile(asset.browser_download_url, filePath);

      // Generate configuration file
      let configFile = null;
      if (serverUrl && registrationCode) {
        const configFileName = 'allow2automate-agent-config.json';
        configFile = path.join(destinationPath, configFileName);

        const agentConfig = await this.generateAgentConfig(serverUrl, registrationCode, platform);
        fs.writeFileSync(configFile, JSON.stringify(agentConfig, null, 2), 'utf8');

        console.log(`[AgentUpdateService] Generated config file at ${configFile}`);
      }

      return { installerPath: filePath, configPath: configFile, version };

    } catch (error) {
      console.error('[AgentUpdateService] Error downloading from GitHub:', error);
      throw error;
    }
  }

  /**
   * Download uninstall script for a platform
   * @param {string} platform - Platform (win32, darwin, linux)
   * @param {string} destinationPath - Destination directory
   */
  async downloadUninstallScript(platform, destinationPath) {
    try {
      console.log(`[AgentUpdateService] Downloading uninstall script for ${platform}...`);

      // Check if we have latest version info for this platform
      const platformInfo = this.latestVersions[platform];
      if (!platformInfo || !platformInfo.uninstallUrl) {
        throw new Error(`No uninstall script available for ${platform}`);
      }

      // Check if we have it cached and it's the right version
      const cached = this.uninstallScriptCache.get(platform);
      if (cached && cached.version === platformInfo.version) {
        const destFile = path.join(destinationPath, path.basename(cached.path));
        fs.copyFileSync(cached.path, destFile);
        console.log(`[AgentUpdateService] Exported cached uninstall script to ${destFile}`);
        return { scriptPath: destFile, version: platformInfo.version };
      }

      // Download from GitHub
      const ext = platform === 'win32' ? '.bat' : '.sh';
      const fileName = `uninstall-${platform}-${platformInfo.version}${ext}`;
      const cachePath = path.join(this.cacheDir, fileName);
      const destFile = path.join(destinationPath, fileName);

      console.log(`[AgentUpdateService] Downloading from ${platformInfo.uninstallUrl}...`);
      await this.downloadFile(platformInfo.uninstallUrl, cachePath);

      // Copy to destination
      fs.copyFileSync(cachePath, destFile);

      // Update cache
      this.uninstallScriptCache.set(platform, {
        path: cachePath,
        version: platformInfo.version,
        ext: ext.replace('.', '')
      });

      console.log(`[AgentUpdateService] Downloaded uninstall script to ${destFile}`);
      return { scriptPath: destFile, version: platformInfo.version };

    } catch (error) {
      console.error('[AgentUpdateService] Error downloading uninstall script:', error);
      throw error;
    }
  }

  /**
   * Get latest versions info (for UI display)
   */
  getLatestVersions() {
    return this.latestVersions;
  }

  /**
   * Perform full cleanup of temp files and old cache items
   * Can be called manually when disk space is low
   * @returns {Promise<Object>} Cleanup results
   */
  async performCleanup() {
    const results = {
      tempFilesRemoved: 0,
      cacheItemsRemoved: 0,
      dmgsUnmounted: 0,
      bytesFreed: 0
    };

    try {
      console.log('[AgentUpdateService] Performing full cleanup...');

      // Get initial disk space
      const tempDir = path.join(this.app.getPath('temp'), 'allow2-installer-staging');
      const initialSpace = await this.getAvailableDiskSpace(this.cacheDir);

      // On macOS, unmount any orphaned DMG volumes first
      if (process.platform === 'darwin') {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        try {
          const volumes = fs.readdirSync('/Volumes').filter(v =>
            v.startsWith('Allow2 Automate Agent')
          );

          for (const volume of volumes) {
            const volumePath = `/Volumes/${volume}`;
            try {
              console.log(`[AgentUpdateService] Unmounting orphaned DMG: ${volumePath}`);
              await execAsync(`hdiutil detach "${volumePath}" -force`);
              results.dmgsUnmounted++;
            } catch (e) {
              // Ignore - might not be a DMG or already unmounted
            }
          }
        } catch (e) {
          // Ignore - /Volumes might not be readable
        }
      }

      // Clean up temp staging directory
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          const filePath = path.join(tempDir, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
            results.tempFilesRemoved++;
            console.log(`[AgentUpdateService] Removed temp file: ${file}`);
          } catch (e) {
            // Ignore errors
          }
        }
      }

      // Prune installer cache (keeps only latest per platform)
      const beforeCacheSize = this.installerCache.size;
      await this.pruneInstallerCache();
      results.cacheItemsRemoved = Math.max(0, beforeCacheSize - this.installerCache.size);

      // Calculate bytes freed
      const finalSpace = await this.getAvailableDiskSpace(this.cacheDir);
      results.bytesFreed = Math.max(0, finalSpace - initialSpace);

      console.log(`[AgentUpdateService] Cleanup complete: ${results.tempFilesRemoved} temp files, ${results.cacheItemsRemoved} cache items, ${results.dmgsUnmounted} DMGs unmounted, ${Math.round(results.bytesFreed / 1024 / 1024)}MB freed`);

      return results;
    } catch (error) {
      console.error('[AgentUpdateService] Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Stop the update service
   */
  stop() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
    if (this.versionCheckInterval) {
      clearInterval(this.versionCheckInterval);
      this.versionCheckInterval = null;
    }
    console.log('[AgentUpdateService] Stopped');
  }
}
