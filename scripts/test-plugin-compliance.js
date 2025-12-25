#!/usr/bin/env node
/**
 * Plugin Compliance Validation Test Script
 *
 * This script demonstrates the plugin compliance validation system.
 * It loads the registry and generates a compliance report.
 *
 * Note: Run 'npm run private:compile' first to build the app
 */

const path = require('path');
const RegistryLoader = require('../build/registry.js').default;

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

async function testComplianceValidation() {
    console.log(colorize('\n═══════════════════════════════════════════════════', 'cyan'));
    console.log(colorize('  Plugin Compliance Validation Test', 'bright'));
    console.log(colorize('═══════════════════════════════════════════════════\n', 'cyan'));

    try {
        // Create registry loader
        const registry = new RegistryLoader({
            developmentMode: true, // Use fallback data for testing
            cacheTTL: 3600000
        });

        console.log(colorize('📦 Loading plugin registry...', 'blue'));
        const library = await registry.getLibrary();
        console.log(colorize(`✓ Loaded ${Object.keys(library).length} plugins\n`, 'green'));

        // Get compliance report
        console.log(colorize('🔍 Generating compliance report...', 'blue'));
        const report = await registry.getComplianceReport();

        // Display summary
        console.log(colorize('\n📊 COMPLIANCE SUMMARY', 'bright'));
        console.log(colorize('═════════════════════════════════════\n', 'cyan'));
        console.log(`Total plugins:        ${report.summary.total}`);
        console.log(colorize(`✓ Compliant:         ${report.summary.compliant}`, 'green'));
        console.log(colorize(`✗ Non-compliant:     ${report.summary.nonCompliant}`, 'red'));
        console.log(colorize(`? Unknown:           ${report.summary.unknown}`, 'yellow'));

        // Display non-compliant plugins
        if (report.nonCompliantPlugins.length > 0) {
            console.log(colorize('\n\n⚠️  NON-COMPLIANT PLUGINS', 'bright'));
            console.log(colorize('═════════════════════════════════════\n', 'red'));

            report.nonCompliantPlugins.forEach((plugin, index) => {
                console.log(colorize(`${index + 1}. ${plugin.name}`, 'bright'));
                console.log(`   Package: ${plugin.package}`);
                console.log(`   Version: ${plugin.version}`);

                if (plugin.compliance.validationErrors.length > 0) {
                    console.log(colorize('\n   Issues:', 'red'));
                    plugin.compliance.validationErrors.forEach(error => {
                        console.log(colorize(`   ✗ ${error}`, 'red'));
                    });
                }

                if (plugin.compliance.validationWarnings.length > 0) {
                    console.log(colorize('\n   Warnings:', 'yellow'));
                    plugin.compliance.validationWarnings.forEach(warning => {
                        console.log(colorize(`   ⚠ ${warning}`, 'yellow'));
                    });
                }

                console.log('');
            });
        }

        // Display compliant plugins
        if (report.compliantPlugins.length > 0) {
            console.log(colorize('\n✓ COMPLIANT PLUGINS', 'bright'));
            console.log(colorize('═════════════════════════════════════\n', 'green'));

            report.compliantPlugins.forEach((plugin, index) => {
                console.log(colorize(`${index + 1}. ${plugin.name}`, 'green'));
                console.log(`   Package: ${plugin.package}`);
                console.log(`   Version: ${plugin.version}`);
                console.log('');
            });
        }

        // Display unknown plugins
        if (report.unknownPlugins.length > 0) {
            console.log(colorize('\n? UNKNOWN COMPLIANCE STATUS', 'bright'));
            console.log(colorize('═════════════════════════════════════\n', 'yellow'));

            report.unknownPlugins.forEach((plugin, index) => {
                console.log(colorize(`${index + 1}. ${plugin.name}`, 'yellow'));
                console.log(`   Package: ${plugin.package}`);
                console.log(`   Version: ${plugin.version}`);

                if (plugin.compliance && plugin.compliance.validationWarnings.length > 0) {
                    console.log(colorize('\n   Info:', 'yellow'));
                    plugin.compliance.validationWarnings.forEach(warning => {
                        console.log(colorize(`   ℹ ${warning}`, 'yellow'));
                    });
                }

                console.log('');
            });
        }

        // Get detailed library entry for one plugin
        console.log(colorize('\n📋 SAMPLE PLUGIN LIBRARY ENTRY', 'bright'));
        console.log(colorize('═════════════════════════════════════\n', 'cyan'));

        const samplePlugin = Object.values(library)[0];
        if (samplePlugin) {
            console.log(JSON.stringify(samplePlugin, null, 2));
        }

        console.log(colorize('\n═══════════════════════════════════════════════════', 'cyan'));
        console.log(colorize('  Test Complete', 'bright'));
        console.log(colorize('═══════════════════════════════════════════════════\n', 'cyan'));

    } catch (error) {
        console.error(colorize('\n✗ Error running compliance test:', 'red'), error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the test
testComplianceValidation();
