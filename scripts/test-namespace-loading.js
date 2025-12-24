#!/usr/bin/env node
/**
 * Test script to validate namespace-based registry loading
 * Run with: node scripts/test-namespace-loading.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRegistryLoader } from '../app/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Namespace-Based Registry Loading\n');

async function runTests() {
    const loader = createRegistryLoader({
        registryPath: path.join(__dirname, '../../../registry/plugins.json'),
        developmentMode: false,
        cacheTTL: 60000
    });

    try {
        console.log('1️⃣ Loading registry with namespace support...');
        const registry = await loader.loadRegistry();
        console.log(`   ✅ Loaded ${registry.plugins.length} plugins`);

        // Count namespaced plugins
        const namespaced = registry.plugins.filter(p => p.namespace);
        console.log(`   ✅ Found ${namespaced.length} namespaced plugins`);

        console.log('\n2️⃣ Testing loadPlugin() with namespace identifier...');
        const wemoPlugin = await loader.loadPlugin('@allow2/allow2automate-wemo');
        if (wemoPlugin) {
            console.log(`   ✅ Loaded: ${wemoPlugin.name} v${wemoPlugin.version}`);
            console.log(`   ✅ Namespace: ${wemoPlugin.namespace}`);
            console.log(`   ✅ Plugin file: ${wemoPlugin.pluginFile}`);
        } else {
            console.log('   ⚠️  Plugin not found (may not exist in namespace folder)');
        }

        console.log('\n3️⃣ Testing namespace extraction...');
        const namespace = loader.extractNamespace('@allow2/allow2automate-wemo');
        console.log(`   ✅ Extracted namespace: ${namespace}`);

        const pluginName = loader.extractPluginName('@allow2/allow2automate-wemo');
        console.log(`   ✅ Extracted plugin name: ${pluginName}`);

        console.log('\n4️⃣ Checking for orphaned plugins...');
        const orphans = await loader.findOrphanedPlugins();
        if (orphans.length > 0) {
            console.log(`   ⚠️  Found ${orphans.length} orphaned plugins:`);
            orphans.forEach(orphan => {
                console.log(`      - ${orphan.name} (${orphan.file})`);
            });
        } else {
            console.log(`   ✅ No orphaned plugins found`);
        }

        console.log('\n5️⃣ Testing plugin search with namespace plugins...');
        const iotPlugins = await loader.searchPlugins({ category: 'iot' });
        console.log(`   ✅ Found ${iotPlugins.length} IoT plugins`);
        iotPlugins.forEach(plugin => {
            console.log(`      - ${plugin.name} (${plugin.namespace || 'no namespace'})`);
        });

        console.log('\n6️⃣ Testing cache reload...');
        await loader.reloadRegistry();
        console.log(`   ✅ Registry reloaded successfully`);

        console.log('\n7️⃣ Listing all namespaces in registry...');
        if (registry.namespaces) {
            const namespaceList = Object.keys(registry.namespaces);
            console.log(`   ✅ Found ${namespaceList.length} namespace(s):`);
            namespaceList.forEach(ns => {
                const info = registry.namespaces[ns];
                console.log(`      - ${ns}: ${info.name} (${info.totalPlugins} plugins)`);
            });
        }

        console.log('\n8️⃣ Validating plugin structure...');
        const samplePlugin = registry.plugins[0];
        const requiredFields = ['id', 'name', 'version', 'description'];
        const hasRequired = requiredFields.every(field => samplePlugin[field]);
        if (hasRequired) {
            console.log(`   ✅ Sample plugin has all required fields`);
        } else {
            console.log(`   ❌ Sample plugin missing required fields`);
        }

        console.log('\n✨ All tests completed successfully!\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
