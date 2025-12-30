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

      // In a real implementation, this would use Octokit to check GitHub releases
      // For now, we'll use a mock implementation

      // const octokit = new Octokit();
      // const { data: releases } = await octokit.repos.listReleases({
      //   owner: 'Allow2',
      //   repo: 'allow2automate-agent'
      // });

      // const latestRelease = releases.find(r => !r.prerelease && !r.draft);
      // if (latestRelease && latestRelease.tag_name > this.currentVersion) {
      //   console.log(`[AgentUpdateService] New version available: ${latestRelease.tag_name}`);
      //   await this.downloadRelease(latestRelease);
      // }

      console.log('[AgentUpdateService] No updates available');
    } catch (error) {
      console.error('[AgentUpdateService] Error checking for updates:', error);
    }
  }

  /**
   * Download a release from GitHub
   */
  async downloadRelease(release) {
    // This would download installers for all platforms
    // For now, this is a placeholder
    console.log(`[AgentUpdateService] Would download release: ${release.tag_name}`);
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
  async exportInstaller(version, platform, destinationPath) {
    try {
      const versionCache = this.installerCache.get(version);
      if (!versionCache || !versionCache[platform]) {
        throw new Error('Installer not found');
      }

      const installer = versionCache[platform];
      const fileName = `allow2automate-agent-${version}-${platform}.${installer.ext}`;
      const destFile = path.join(destinationPath, fileName);

      fs.copyFileSync(installer.path, destFile);

      console.log(`[AgentUpdateService] Exported installer to ${destFile}`);
      return destFile;
    } catch (error) {
      console.error('[AgentUpdateService] Error exporting installer:', error);
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
