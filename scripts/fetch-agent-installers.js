#!/usr/bin/env node

/**
 * Fetch Agent Installers Script
 *
 * Downloads the latest allow2automate-agent installers from GitHub releases
 * and bundles them with the main application for offline installation.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_REPO = 'Allow2/allow2automate-agent';
const AGENT_RESOURCES_DIR = path.join(__dirname, '..', 'resources', 'agents');

/**
 * Fetch latest release from GitHub
 */
async function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'Allow2Automate-Build-Script',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          resolve(release);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Download a file from URL
 */
async function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);

    https.get(url, {
      headers: { 'User-Agent': 'Allow2Automate-Build-Script' }
    }, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        return downloadFile(response.headers.location, destination)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destination, () => {});
      reject(err);
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log('[Agent Installers] Fetching latest agent installers...');

  try {
    // Create resources directory if it doesn't exist
    if (!fs.existsSync(AGENT_RESOURCES_DIR)) {
      fs.mkdirSync(AGENT_RESOURCES_DIR, { recursive: true });
    }

    // Fetch latest release
    console.log('[Agent Installers] Checking GitHub for latest release...');
    const release = await fetchLatestRelease();

    if (!release || !release.assets) {
      console.log('[Agent Installers] No releases found or repository not available');
      console.log('[Agent Installers] Skipping agent installer download');
      return;
    }

    console.log(`[Agent Installers] Found release: ${release.tag_name}`);

    // Download each platform installer
    const platforms = {
      'win32': '.exe',
      'darwin': '.dmg',
      'linux': '.deb'
    };

    for (const [platform, extension] of Object.entries(platforms)) {
      const asset = release.assets.find(a =>
        a.name.includes(platform) && a.name.endsWith(extension)
      );

      if (asset) {
        const destination = path.join(
          AGENT_RESOURCES_DIR,
          `allow2automate-agent-${release.tag_name}-${platform}${extension}`
        );

        console.log(`[Agent Installers] Downloading ${platform} installer...`);
        await downloadFile(asset.browser_download_url, destination);
        console.log(`[Agent Installers] ✓ Downloaded ${platform} installer`);
      } else {
        console.log(`[Agent Installers] ⚠ No ${platform} installer found in release`);
      }
    }

    // Update package.json with bundled version
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.bundledAgentVersion = release.tag_name;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log('[Agent Installers] ✓ Agent installers fetched successfully');
    console.log(`[Agent Installers] Bundled version: ${release.tag_name}`);

  } catch (error) {
    console.error('[Agent Installers] Error fetching installers:', error.message);
    console.log('[Agent Installers] Continuing build without agent installers');
    // Don't fail the build if installers can't be downloaded
  }
}

main();
