#!/usr/bin/env node
/**
 * Bundle Agent Installer Script
 *
 * This script packages the allow2automate-agent for distribution with the main app.
 * It creates platform-specific installers that can be downloaded by users.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AGENT_SOURCE = path.join(__dirname, '../../allow2automate-agent');
const INSTALLER_DEST = path.join(__dirname, '../resources/agent-installers');
const VERSION = '1.0.0';

console.log('=== Allow2 Agent Installer Bundler ===');
console.log(`Agent source: ${AGENT_SOURCE}`);
console.log(`Installer destination: ${INSTALLER_DEST}`);
console.log(`Version: ${VERSION}\n`);

// Ensure destination directory exists
if (!fs.existsSync(INSTALLER_DEST)) {
  fs.mkdirSync(INSTALLER_DEST, { recursive: true });
  console.log(`Created directory: ${INSTALLER_DEST}`);
}

// Check if agent source exists
if (!fs.existsSync(AGENT_SOURCE)) {
  console.error(`ERROR: Agent source not found at ${AGENT_SOURCE}`);
  console.error('Please ensure allow2automate-agent is cloned at ~/ai/automate/allow2automate-agent');
  process.exit(1);
}

/**
 * Build installer for a specific platform
 */
function buildInstaller(platform) {
  console.log(`\n--- Building ${platform} installer ---`);

  try {
    const cwd = AGENT_SOURCE;

    switch (platform) {
      case 'windows':
        console.log('Building Windows MSI installer...');
        execSync('npm run build:windows', { cwd, stdio: 'inherit' });

        // Copy installer to destination
        const winInstaller = path.join(cwd, 'dist', `allow2automate-agent-${VERSION}.msi`);
        if (fs.existsSync(winInstaller)) {
          const dest = path.join(INSTALLER_DEST, `allow2automate-agent-${VERSION}-win32.msi`);
          fs.copyFileSync(winInstaller, dest);
          console.log(`✓ Windows installer bundled: ${dest}`);
        } else {
          console.warn(`⚠ Windows installer not found at ${winInstaller}`);
        }
        break;

      case 'macos':
        console.log('Building macOS PKG installer...');
        execSync('npm run build:macos', { cwd, stdio: 'inherit' });

        // Copy installer to destination
        const macInstaller = path.join(cwd, 'dist', `allow2automate-agent-${VERSION}.pkg`);
        if (fs.existsSync(macInstaller)) {
          const dest = path.join(INSTALLER_DEST, `allow2automate-agent-${VERSION}-darwin.pkg`);
          fs.copyFileSync(macInstaller, dest);
          console.log(`✓ macOS installer bundled: ${dest}`);
        } else {
          console.warn(`⚠ macOS installer not found at ${macInstaller}`);
        }
        break;

      case 'linux':
        console.log('Building Linux DEB installer...');
        execSync('npm run build:linux', { cwd, stdio: 'inherit' });

        // Copy installer to destination
        const linuxInstaller = path.join(cwd, 'dist', `allow2automate-agent_${VERSION}_amd64.deb`);
        if (fs.existsSync(linuxInstaller)) {
          const dest = path.join(INSTALLER_DEST, `allow2automate-agent-${VERSION}-linux.deb`);
          fs.copyFileSync(linuxInstaller, dest);
          console.log(`✓ Linux installer bundled: ${dest}`);
        } else {
          console.warn(`⚠ Linux installer not found at ${linuxInstaller}`);
        }
        break;

      default:
        console.error(`Unknown platform: ${platform}`);
        return false;
    }

    return true;
  } catch (error) {
    console.error(`Error building ${platform} installer:`, error.message);
    return false;
  }
}

/**
 * Create a manifest file with installer metadata
 */
function createManifest() {
  const manifest = {
    version: VERSION,
    timestamp: new Date().toISOString(),
    installers: {}
  };

  // Check what installers exist
  const files = fs.readdirSync(INSTALLER_DEST);

  files.forEach(file => {
    if (file.startsWith('allow2automate-agent')) {
      const platform = file.includes('win32') ? 'win32' :
                      file.includes('darwin') ? 'darwin' :
                      file.includes('linux') ? 'linux' : null;

      if (platform) {
        const filePath = path.join(INSTALLER_DEST, file);
        const stats = fs.statSync(filePath);

        manifest.installers[platform] = {
          filename: file,
          size: stats.size,
          created: stats.birthtime.toISOString()
        };
      }
    }
  });

  const manifestPath = path.join(INSTALLER_DEST, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n✓ Created manifest: ${manifestPath}`);

  return manifest;
}

/**
 * Main execution
 */
async function main() {
  const platform = process.argv[2] || process.platform;

  console.log(`Building for platform: ${platform}\n`);

  if (platform === 'all') {
    // Build for all platforms
    console.log('Building installers for all platforms...\n');
    buildInstaller('windows');
    buildInstaller('macos');
    buildInstaller('linux');
  } else {
    // Build for specific platform
    const platformMap = {
      'win32': 'windows',
      'darwin': 'macos',
      'linux': 'linux'
    };

    const buildPlatform = platformMap[platform] || platform;
    buildInstaller(buildPlatform);
  }

  // Create manifest
  const manifest = createManifest();

  console.log('\n=== Bundle Summary ===');
  console.log(`Version: ${manifest.version}`);
  console.log(`Installers created: ${Object.keys(manifest.installers).length}`);
  Object.entries(manifest.installers).forEach(([platform, info]) => {
    console.log(`  - ${platform}: ${info.filename} (${Math.round(info.size / 1024)} KB)`);
  });

  console.log('\n✓ Agent installer bundling complete!');
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { buildInstaller, createManifest };
