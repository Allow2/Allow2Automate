#!/usr/bin/env node

/**
 * Verification script for shared dependency configuration
 *
 * This script verifies that the host application is properly configured
 * to share React, Material-UI, and other dependencies with plugins.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Shared Dependency Configuration\n');

const errors = [];
const warnings = [];
const successes = [];

// Helper to check if file contains pattern
function fileContains(filePath, pattern, description) {
    if (!fs.existsSync(filePath)) {
        errors.push(`File not found: ${filePath}`);
        return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (pattern.test(content)) {
        successes.push(`✅ ${description}`);
        return true;
    } else {
        errors.push(`❌ ${description} - Pattern not found in ${filePath}`);
        return false;
    }
}

// Helper to check if file does NOT contain pattern
function fileDoesNotContain(filePath, pattern, description) {
    if (!fs.existsSync(filePath)) {
        errors.push(`File not found: ${filePath}`);
        return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (!pattern.test(content)) {
        successes.push(`✅ ${description}`);
        return true;
    } else {
        warnings.push(`⚠️  ${description} - Found in ${filePath}`);
        return false;
    }
}

// Check 1: Verify main.js has Module.globalPaths configuration
console.log('📋 Checking main.js configuration...');
fileContains(
    path.join(__dirname, '../app/main.js'),
    /Module\.globalPaths/,
    'main.js configures Module.globalPaths'
);
fileContains(
    path.join(__dirname, '../app/main.js'),
    /require\.resolve\('react'\)/,
    'main.js resolves React path'
);
fileContains(
    path.join(__dirname, '../app/main.js'),
    /require\.resolve\('@material-ui\/core'\)/,
    'main.js resolves Material-UI path'
);

// Check 2: Verify preload.js has Module.globalPaths configuration
console.log('\n📋 Checking preload.js configuration...');
fileContains(
    path.join(__dirname, '../app/preload.js'),
    /Module\.globalPaths/,
    'preload.js configures Module.globalPaths'
);
fileContains(
    path.join(__dirname, '../app/preload.js'),
    /try.*catch/s,
    'preload.js has error handling'
);

// Check 3: Verify plugins.js has Module.wrap configuration
console.log('\n📋 Checking plugins.js configuration...');
fileContains(
    path.join(__dirname, '../app/plugins.js'),
    /Module\.wrap\s*=/,
    'plugins.js configures Module.wrap'
);
fileContains(
    path.join(__dirname, '../app/plugins.js'),
    /module\.paths\.push/,
    'plugins.js injects module paths'
);

// Check 4: Verify Plugin.js has Module.wrap configuration
console.log('\n📋 Checking Plugin.js component...');
fileContains(
    path.join(__dirname, '../app/components/Plugin.js'),
    /Module\.wrap\s*=/,
    'Plugin.js configures Module.wrap'
);

// Check 5: Verify MarketplacePage.js does NOT have --legacy-peer-deps in npm command
console.log('\n📋 Checking MarketplacePage.js...');
const marketplacePagePath = path.join(__dirname, '../app/containers/MarketplacePage.js');
if (fs.existsSync(marketplacePagePath)) {
    const content = fs.readFileSync(marketplacePagePath, 'utf8');
    // Check for --legacy-peer-deps in actual npm command (not in comments)
    const npmCommandMatch = content.match(/npm\s+install[^;]*--legacy-peer-deps/);
    if (!npmCommandMatch) {
        successes.push('✅ MarketplacePage.js npm install does not use --legacy-peer-deps flag');
    } else {
        errors.push('❌ MarketplacePage.js npm install still uses --legacy-peer-deps flag');
    }
    // Verify npm install command exists
    if (/npm\s+install\s+--prefix/.test(content)) {
        successes.push('✅ MarketplacePage.js has npm install command configured');
    }
} else {
    errors.push('❌ MarketplacePage.js not found');
}

// Check 6: Verify shared dependencies are installed
console.log('\n📦 Checking installed dependencies...');
const packageJsonPath = path.join(__dirname, '../package.json');
if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    const requiredDeps = [
        'react',
        'react-dom',
        '@material-ui/core',
        '@material-ui/icons',
        'redux',
        'react-redux'
    ];

    requiredDeps.forEach(dep => {
        if (deps[dep]) {
            successes.push(`✅ ${dep} v${deps[dep]} is installed`);
        } else {
            errors.push(`❌ ${dep} is not in package.json dependencies`);
        }
    });
} else {
    errors.push('❌ package.json not found');
}

// Check 7: Verify node_modules exist
console.log('\n📁 Checking node_modules...');
const nodeModulesPath = path.join(__dirname, '../node_modules');
if (fs.existsSync(nodeModulesPath)) {
    const requiredModules = [
        'react',
        'react-dom',
        '@material-ui/core',
        '@material-ui/icons',
        'redux',
        'react-redux'
    ];

    requiredModules.forEach(mod => {
        const modPath = path.join(nodeModulesPath, mod);
        if (fs.existsSync(modPath)) {
            successes.push(`✅ ${mod} module exists in node_modules`);
        } else {
            errors.push(`❌ ${mod} module not found in node_modules`);
        }
    });
} else {
    errors.push('❌ node_modules directory not found - run npm install');
}

// Check 8: Verify documentation exists
console.log('\n📚 Checking documentation...');
const docsToCheck = [
    '../docs/PLUGIN_SHARED_DEPENDENCIES.md',
    '../docs/SHARED_DEPENDENCIES_IMPLEMENTATION_SUMMARY.md'
];

docsToCheck.forEach(docPath => {
    const fullPath = path.join(__dirname, docPath);
    if (fs.existsSync(fullPath)) {
        successes.push(`✅ Documentation exists: ${path.basename(docPath)}`);
    } else {
        warnings.push(`⚠️  Documentation missing: ${path.basename(docPath)}`);
    }
});

// Print summary
console.log('\n' + '='.repeat(60));
console.log('📊 VERIFICATION SUMMARY');
console.log('='.repeat(60));

console.log(`\n✅ Successes: ${successes.length}`);
successes.forEach(msg => console.log(msg));

if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${warnings.length}`);
    warnings.forEach(msg => console.log(msg));
}

if (errors.length > 0) {
    console.log(`\n❌ Errors: ${errors.length}`);
    errors.forEach(msg => console.log(msg));
    console.log('\n❌ Verification FAILED - Please fix the errors above');
    process.exit(1);
} else {
    console.log('\n✅ ✅ ✅ All checks passed! Shared dependency configuration is correct.');
    console.log('\n📝 Next steps:');
    console.log('   1. Build the application: npm run private:compile');
    console.log('   2. Test with a plugin installation');
    console.log('   3. Verify console logs show module path configuration');
    console.log('   4. Check that plugins can load React/Material-UI components');
    process.exit(0);
}
