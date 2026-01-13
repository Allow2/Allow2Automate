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
  }

  /**
   * Load cached installers from disk
   */
  async loadCachedInstallers() {
    try {
      const files = fs.readdirSync(this.cacheDir);

      for (const file of files) {
        const match = file.match(/^allow2automate-agent-(.+)-(win32|darwin|linux)\.(exe|dmg|deb)$/);
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

        const config = this.generateAgentConfig(serverUrl, registrationCode, platform);
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
   * Generate agent configuration file
   * @param {string} serverUrl - Parent server URL
   * @param {string} childId - Optional child ID for pre-assignment
   * @param {string} platform - Platform (win32, darwin, linux)
   * @param {boolean} advancedMode - Use fixed IP (disable mDNS)
   */
  generateAgentConfig(serverUrl, childId, platform, advancedMode = false) {
    const config = {
      // Parent server URL (auto-detected or user-specified)
      parentApiUrl: serverUrl,

      // Agent API port (default: 8443)
      apiPort: 8443,

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
   * Export installer bundle as ZIP (installer + config)
   * @param {string} version - Version to export
   * @param {string} platform - Platform (darwin, linux, win32)
   * @param {string} serverUrl - Parent server URL
   * @param {string} childId - Optional child ID for pre-assignment
   * @param {boolean} advancedMode - Use fixed IP mode
   * @returns {Promise<Object>} Bundle information
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

        const agentConfig = this.generateAgentConfig(serverUrl, registrationCode, platform);
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
