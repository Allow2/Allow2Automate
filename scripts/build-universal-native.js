#!/usr/bin/env node
/**
 * build-universal-native.js
 *
 * Ensures native modules (like better-sqlite3) are universal binaries
 * containing both x64 and arm64 architectures for macOS universal builds.
 *
 * Strategy:
 * 1. Check if native modules are already universal
 * 2. Try to download prebuilt binaries for both architectures
 * 3. If that fails, use @electron/rebuild for both architectures
 * 4. Merge with lipo to create universal binaries
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const NATIVE_MODULES = ['better-sqlite3'];
const NODE_MODULES_PATH = path.join(__dirname, '..', 'node_modules');

/**
 * Execute a command and return stdout
 */
function exec(cmd, options = {}) {
    const quiet = options.quiet;
    if (!quiet) console.log(`  $ ${cmd}`);
    try {
        return execSync(cmd, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            maxBuffer: 50 * 1024 * 1024, // 50MB buffer
            ...options
        }).trim();
    } catch (err) {
        if (options.ignoreError) {
            return err.stdout?.trim() || '';
        }
        throw err;
    }
}

/**
 * Check if a binary is a universal (fat) binary
 */
function isUniversalBinary(filePath) {
    try {
        const output = exec(`lipo -info "${filePath}"`, { ignoreError: true, quiet: true });
        return output.includes('x86_64') && output.includes('arm64');
    } catch {
        return false;
    }
}

/**
 * Get architecture of a binary
 */
function getBinaryArch(filePath) {
    try {
        const output = exec(`lipo -info "${filePath}"`, { ignoreError: true, quiet: true });
        const archs = [];
        if (output.includes('x86_64')) archs.push('x64');
        if (output.includes('arm64')) archs.push('arm64');
        return archs;
    } catch {
        return [];
    }
}

/**
 * Find all .node files in a module
 */
function findNodeFiles(modulePath) {
    const nodeFiles = [];

    function searchDir(dir) {
        if (!fs.existsSync(dir)) return;

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    searchDir(fullPath);
                } else if (entry.isFile() && entry.name.endsWith('.node')) {
                    nodeFiles.push(fullPath);
                }
            }
        } catch (err) {
            // Ignore permission errors
        }
    }

    searchDir(modulePath);
    return nodeFiles;
}

/**
 * Get the Electron version from package.json
 */
function getElectronVersion() {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const electronVersion = pkg.devDependencies?.electron || pkg.dependencies?.electron;
    if (!electronVersion) {
        throw new Error('Could not find Electron version in package.json');
    }
    // Remove semver prefix and get just the major version for ABI compatibility
    return electronVersion.replace(/^[\^~>=<]*/g, '').split('.')[0] + '.0.0';
}

/**
 * Try to download prebuilt binary for a specific architecture using prebuild-install
 */
async function downloadPrebuildForArch(moduleName, arch, electronVersion) {
    const moduleDir = path.join(NODE_MODULES_PATH, moduleName);
    const tempDir = path.join(os.tmpdir(), `prebuild-${moduleName}-${arch}-${Date.now()}`);

    fs.mkdirSync(tempDir, { recursive: true });

    // Copy module to temp dir for isolated prebuild
    fs.cpSync(moduleDir, tempDir, { recursive: true });

    try {
        console.log(`  Downloading prebuilt ${moduleName} for ${arch}...`);

        // Use prebuild-install directly
        const cmd = [
            'npx', 'prebuild-install',
            '--arch', arch,
            '--platform', 'darwin',
            '--runtime', 'electron',
            '--target', electronVersion,
            '--tag-prefix', 'v',
            '--verbose'
        ].join(' ');

        exec(cmd, { cwd: tempDir, timeout: 120000 });

        // Find the downloaded .node files
        const nodeFiles = findNodeFiles(tempDir);
        const savedFiles = {};

        for (const nodeFile of nodeFiles) {
            const relativePath = path.relative(tempDir, nodeFile);
            savedFiles[relativePath] = nodeFile;
            const archs = getBinaryArch(nodeFile);
            console.log(`    Found ${path.basename(nodeFile)} (${archs.join(', ')})`);
        }

        if (Object.keys(savedFiles).length === 0) {
            throw new Error('No .node files found after prebuild');
        }

        return { tempDir, files: savedFiles };
    } catch (err) {
        console.log(`  Prebuild download failed: ${err.message}`);
        fs.rmSync(tempDir, { recursive: true, force: true });
        return null;
    }
}

/**
 * Rebuild a native module for a specific architecture using @electron/rebuild
 */
async function rebuildForArch(moduleName, arch, electronVersion) {
    const moduleDir = path.join(NODE_MODULES_PATH, moduleName);
    const tempDir = path.join(os.tmpdir(), `rebuild-${moduleName}-${arch}-${Date.now()}`);

    fs.mkdirSync(tempDir, { recursive: true });

    // Copy module to temp dir
    fs.cpSync(moduleDir, tempDir, { recursive: true });

    try {
        console.log(`  Rebuilding ${moduleName} for ${arch}...`);

        // Set arch environment for cross-compilation
        const env = { ...process.env };
        if (arch === 'x64' && process.arch === 'arm64') {
            // Running on ARM64, building for x64 - need Rosetta
            env.npm_config_arch = 'x64';
            env.npm_config_target_arch = 'x64';
        } else if (arch === 'arm64' && process.arch === 'x64') {
            env.npm_config_arch = 'arm64';
            env.npm_config_target_arch = 'arm64';
        }

        const cmd = [
            'npx', '@electron/rebuild',
            '--arch', arch,
            '--platform', 'darwin',
            '--electron-version', electronVersion,
            '--force',
            '--only', moduleName
        ].join(' ');

        exec(cmd, { cwd: tempDir, env, timeout: 300000 });

        // Find the built .node files
        const nodeFiles = findNodeFiles(tempDir);
        const savedFiles = {};

        for (const nodeFile of nodeFiles) {
            const relativePath = path.relative(tempDir, nodeFile);
            savedFiles[relativePath] = nodeFile;
            const archs = getBinaryArch(nodeFile);
            console.log(`    Built ${path.basename(nodeFile)} (${archs.join(', ')})`);
        }

        if (Object.keys(savedFiles).length === 0) {
            throw new Error('No .node files found after rebuild');
        }

        return { tempDir, files: savedFiles };
    } catch (err) {
        console.log(`  Rebuild failed: ${err.message}`);
        fs.rmSync(tempDir, { recursive: true, force: true });
        return null;
    }
}

/**
 * Get native module binary for a specific architecture
 */
async function getBinaryForArch(moduleName, arch, electronVersion) {
    // Try prebuild first (faster)
    let result = await downloadPrebuildForArch(moduleName, arch, electronVersion);

    if (!result) {
        // Fall back to rebuild
        result = await rebuildForArch(moduleName, arch, electronVersion);
    }

    return result;
}

/**
 * Merge two architecture binaries into a universal binary using lipo
 */
function createUniversalBinary(x64Path, arm64Path, outputPath) {
    console.log(`  Creating universal binary: ${path.basename(outputPath)}`);

    // Backup original if it exists
    if (fs.existsSync(outputPath)) {
        fs.copyFileSync(outputPath, outputPath + '.bak');
    }

    try {
        // Ensure output directory exists
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });

        // Create universal binary with lipo
        exec(`lipo -create "${x64Path}" "${arm64Path}" -output "${outputPath}"`, { quiet: true });

        // Verify the result
        const archs = getBinaryArch(outputPath);
        if (archs.includes('x64') && archs.includes('arm64')) {
            console.log(`    ✅ Universal binary created (x64 + arm64)`);
            // Remove backup
            if (fs.existsSync(outputPath + '.bak')) {
                fs.unlinkSync(outputPath + '.bak');
            }
            return true;
        } else {
            throw new Error(`Universal binary has wrong archs: ${archs.join(', ')}`);
        }
    } catch (err) {
        console.log(`    ❌ Failed: ${err.message}`);
        // Restore backup
        if (fs.existsSync(outputPath + '.bak')) {
            fs.copyFileSync(outputPath + '.bak', outputPath);
            fs.unlinkSync(outputPath + '.bak');
        }
        return false;
    }
}

/**
 * Main function to build universal native modules
 */
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     Building Universal Native Modules for macOS          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // Check if we're on macOS
    if (process.platform !== 'darwin') {
        console.log('ℹ️  Not on macOS, skipping universal binary creation.');
        console.log('   Native modules will use the current platform architecture.\n');
        return;
    }

    console.log(`Platform: macOS ${os.release()}`);
    console.log(`Host arch: ${process.arch}`);

    // Check if lipo is available
    try {
        exec('which lipo', { quiet: true });
    } catch {
        console.error('❌ Error: lipo command not found. This script requires Xcode Command Line Tools.');
        process.exit(1);
    }

    const electronVersion = getElectronVersion();
    console.log(`Electron version: ${electronVersion}\n`);

    let hasErrors = false;

    for (const moduleName of NATIVE_MODULES) {
        console.log(`\n┌─ Processing: ${moduleName}`);
        console.log('│');

        const moduleDir = path.join(NODE_MODULES_PATH, moduleName);
        if (!fs.existsSync(moduleDir)) {
            console.log('│  ⚠️  Module not found, skipping');
            console.log('└─────────────────────────────────────\n');
            continue;
        }

        // Check current state of .node files
        const currentNodeFiles = findNodeFiles(moduleDir);
        if (currentNodeFiles.length === 0) {
            console.log('│  ⚠️  No .node files found, skipping');
            console.log('└─────────────────────────────────────\n');
            continue;
        }

        // Check if already universal
        let needsRebuild = false;
        for (const nodeFile of currentNodeFiles) {
            const archs = getBinaryArch(nodeFile);
            const isUniversal = archs.includes('x64') && archs.includes('arm64');
            const status = isUniversal ? '✅' : '⚠️';
            console.log(`│  ${status} ${path.basename(nodeFile)}: ${archs.join(' + ') || 'unknown'}`);
            if (!isUniversal) needsRebuild = true;
        }

        if (!needsRebuild) {
            console.log('│');
            console.log('│  ✅ Already universal, no action needed');
            console.log('└─────────────────────────────────────\n');
            continue;
        }

        console.log('│');
        console.log('│  Building for both architectures...');

        // Get binaries for both architectures
        const x64Build = await getBinaryForArch(moduleName, 'x64', electronVersion);
        const arm64Build = await getBinaryForArch(moduleName, 'arm64', electronVersion);

        if (!x64Build && !arm64Build) {
            console.log('│');
            console.log('│  ❌ Failed to build for any architecture');
            console.log('│     The packaged app will only work on the current architecture');
            console.log('└─────────────────────────────────────\n');
            hasErrors = true;
            continue;
        }

        if (!x64Build || !arm64Build) {
            const missing = !x64Build ? 'x64' : 'arm64';
            const have = !x64Build ? 'arm64' : 'x64';
            console.log('│');
            console.log(`│  ⚠️  Could not build for ${missing}, keeping ${have} only`);
            // Clean up
            if (x64Build?.tempDir) fs.rmSync(x64Build.tempDir, { recursive: true, force: true });
            if (arm64Build?.tempDir) fs.rmSync(arm64Build.tempDir, { recursive: true, force: true });
            console.log('└─────────────────────────────────────\n');
            hasErrors = true;
            continue;
        }

        // Merge the binaries
        console.log('│');
        console.log('│  Merging into universal binaries...');
        let success = true;

        for (const relativePath of Object.keys(x64Build.files)) {
            const x64Path = x64Build.files[relativePath];
            const arm64Path = arm64Build.files[relativePath];
            const outputPath = path.join(moduleDir, relativePath);

            if (!arm64Path || !fs.existsSync(arm64Path)) {
                console.log(`│  ⚠️  No arm64 version of ${path.basename(relativePath)}`);
                continue;
            }

            if (!createUniversalBinary(x64Path, arm64Path, outputPath)) {
                success = false;
            }
        }

        // Clean up temp directories
        fs.rmSync(x64Build.tempDir, { recursive: true, force: true });
        fs.rmSync(arm64Build.tempDir, { recursive: true, force: true });

        console.log('│');
        if (success) {
            console.log('│  ✅ Successfully created universal binaries');
        } else {
            console.log('│  ⚠️  Some binaries may have issues');
            hasErrors = true;
        }
        console.log('└─────────────────────────────────────\n');
    }

    console.log('╔══════════════════════════════════════════════════════════╗');
    if (hasErrors) {
        console.log('║  ⚠️  Completed with warnings                             ║');
        console.log('║     Some native modules may not work on all Macs         ║');
    } else {
        console.log('║  ✅ Universal Native Modules Complete                     ║');
        console.log('║     Native modules will work on Intel and Apple Silicon  ║');
    }
    console.log('╚══════════════════════════════════════════════════════════╝\n');
}

// Run if called directly
if (require.main === module) {
    main().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { main, NATIVE_MODULES };
