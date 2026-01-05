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
    this.installerCache = new Map(); // version -> { platform -> { path, checksum } }
    this.cacheDir = path.join(app.getPath('userData'), 'agent-installers');
  }

  /**
   * Start the update service
   */
  async start() {
    console.log('[AgentUpdateService] Starting...');

    // Ensure cache directory exists
    await this.ensureCacheDirectory();

    // Load cached installers
    await this.loadCachedInstallers();

    // Check for updates immediately
    await this.checkForUpdates();

    // Check for updates every 6 hours
    this.updateCheckInterval = setInterval(async () => {
      await this.checkForUpdates();
    }, 6 * 60 * 60 * 1000);

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
   */
  async exportInstaller(version, platform, destinationPath, serverUrl, registrationCode) {
    try {
      const versionCache = this.installerCache.get(version);
      if (!versionCache || !versionCache[platform]) {
        throw new Error('Installer not found');
      }

      const installer = versionCache[platform];
      const fileName = `allow2automate-agent-${version}-${platform}.${installer.ext}`;
      const destFile = path.join(destinationPath, fileName);

      // Copy installer file
      fs.copyFileSync(installer.path, destFile);

      // Generate configuration file (optional - only if serverUrl provided)
      let configFile = null;
      if (serverUrl) {
        const configFileName = 'allow2automate-agent-config.json';
        configFile = path.join(destinationPath, configFileName);

        const config = this.generateAgentConfig(serverUrl, registrationCode, platform);
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');

        console.log(`[AgentUpdateService] Generated config file at ${configFile}`);
      }

      console.log(`[AgentUpdateService] Exported installer to ${destFile}`);
      return { installerPath: destFile, configPath: configFile };
    } catch (error) {
      console.error('[AgentUpdateService] Error exporting installer:', error);
      throw error;
    }
  }

  /**
   * Generate agent configuration file
   * @param {string} serverUrl - Parent server URL
   * @param {string} registrationCode - Optional registration code (for backward compatibility)
   * @param {string} platform - Platform (win32, darwin, linux)
   */
  generateAgentConfig(serverUrl, registrationCode, platform) {
    const config = {
      parentApiUrl: serverUrl,
      apiPort: 8443,
      checkInterval: 30000,
      logLevel: 'info',
      enableMDNS: true,
      autoUpdate: true
    };

    // Add registration code only if provided (backward compatibility)
    if (registrationCode) {
      config.registrationCode = registrationCode;
    }

    // Add platform-specific paths
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
   * Stop the update service
   */
  stop() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
    console.log('[AgentUpdateService] Stopped');
  }
}
