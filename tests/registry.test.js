/**
 * Registry Integration Tests
 *
 * Tests for the plugin registry loader and integration
 */

const { expect } = require('chai');
const path = require('path');
const fs = require('fs');

// Import registry loader
const RegistryLoader = require('../app/registry').default;
const { createRegistryLoader } = require('../app/registry');

describe('Registry Loader', function() {
    let loader;

    beforeEach(function() {
        loader = createRegistryLoader({
            developmentMode: true,
            cacheTTL: 1000
        });
    });

    describe('Initialization', function() {
        it('should create a registry loader instance', function() {
            expect(loader).to.be.instanceOf(RegistryLoader);
        });

        it('should have default configuration', function() {
            expect(loader.developmentMode).to.equal(true);
            expect(loader.cacheTTL).to.equal(1000);
        });
    });

    describe('Fallback Registry', function() {
        it('should return fallback data in development mode', async function() {
            const registry = await loader.loadRegistry();
            expect(registry).to.have.property('metadata');
            expect(registry).to.have.property('plugins');
            expect(registry.plugins).to.be.an('array');
        });

        it('should include expected plugins in fallback', async function() {
            const registry = await loader.loadRegistry();
            const pluginNames = registry.plugins.map(p => p.name);
            expect(pluginNames).to.include('battle.net');
            expect(pluginNames).to.include('ssh');
            expect(pluginNames).to.include('wemo');
            expect(pluginNames).to.include('safefamily');
        });

        it('should have valid plugin structure', async function() {
            const registry = await loader.loadRegistry();
            const plugin = registry.plugins[0];
            expect(plugin).to.have.property('name');
            expect(plugin).to.have.property('version');
            expect(plugin).to.have.property('description');
            expect(plugin).to.have.property('publisher');
        });
    });

    describe('Library Format', function() {
        it('should transform registry to library format', async function() {
            const library = await loader.getLibrary();
            expect(library).to.be.an('object');
            expect(Object.keys(library).length).to.be.greaterThan(0);
        });

        it('should have backward compatible structure', async function() {
            const library = await loader.getLibrary();
            const pluginKey = Object.keys(library)[0];
            const plugin = library[pluginKey];

            expect(plugin).to.have.property('name');
            expect(plugin).to.have.property('shortName');
            expect(plugin).to.have.property('publisher');
            expect(plugin).to.have.property('releases');
            expect(plugin.releases).to.have.property('latest');
            expect(plugin).to.have.property('description');
        });
    });

    describe('Search Functionality', function() {
        it('should search by category', async function() {
            const results = await loader.searchPlugins({ category: 'gaming' });
            expect(results).to.be.an('array');
            results.forEach(plugin => {
                expect(plugin.category).to.equal('gaming');
            });
        });

        it('should search by publisher', async function() {
            const results = await loader.searchPlugins({ publisher: 'allow2' });
            expect(results).to.be.an('array');
            results.forEach(plugin => {
                expect(plugin.publisher).to.equal('allow2');
            });
        });

        it('should search by keyword', async function() {
            const results = await loader.searchPlugins({ keyword: 'allow2automate' });
            expect(results).to.be.an('array');
            results.forEach(plugin => {
                expect(plugin.keywords).to.include('allow2automate');
            });
        });

        it('should filter verified plugins', async function() {
            const results = await loader.searchPlugins({ verified: true });
            expect(results).to.be.an('array');
            results.forEach(plugin => {
                expect(plugin.verified).to.equal(true);
            });
        });

        it('should sort by downloads', async function() {
            const results = await loader.searchPlugins({ sort: 'downloads' });
            expect(results).to.be.an('array');

            for (let i = 1; i < results.length; i++) {
                const prev = results[i - 1].downloads || 0;
                const curr = results[i].downloads || 0;
                expect(prev).to.be.at.least(curr);
            }
        });

        it('should sort by rating', async function() {
            const results = await loader.searchPlugins({ sort: 'rating' });
            expect(results).to.be.an('array');

            for (let i = 1; i < results.length; i++) {
                const prev = results[i - 1].rating || 0;
                const curr = results[i].rating || 0;
                expect(prev).to.be.at.least(curr);
            }
        });

        it('should sort by name', async function() {
            const results = await loader.searchPlugins({ sort: 'name' });
            expect(results).to.be.an('array');

            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].name.localeCompare(results[i].name)).to.be.at.most(0);
            }
        });
    });

    describe('Plugin Details', function() {
        it('should get plugin by name', async function() {
            const plugin = await loader.getPlugin('battle.net');
            expect(plugin).to.be.an('object');
            expect(plugin.name).to.equal('battle.net');
        });

        it('should get plugin by package name', async function() {
            const plugin = await loader.getPlugin('allow2automate-battle.net');
            expect(plugin).to.be.an('object');
            expect(plugin.package).to.equal('allow2automate-battle.net');
        });

        it('should return null for non-existent plugin', async function() {
            const plugin = await loader.getPlugin('non-existent-plugin');
            expect(plugin).to.be.null;
        });
    });

    describe('Caching', function() {
        it('should cache registry data', async function() {
            await loader.loadRegistry();
            expect(loader.cache).to.not.be.null;
            expect(loader.cacheTimestamp).to.not.be.null;
        });

        it('should use cached data within TTL', async function() {
            const first = await loader.loadRegistry();
            const second = await loader.loadRegistry();
            expect(first).to.deep.equal(second);
        });

        it('should reload when cache expires', async function() {
            this.timeout(3000);

            await loader.loadRegistry();
            const firstTimestamp = loader.cacheTimestamp;

            // Wait for cache to expire
            await new Promise(resolve => setTimeout(resolve, 1100));

            await loader.loadRegistry();
            const secondTimestamp = loader.cacheTimestamp;

            expect(secondTimestamp).to.be.greaterThan(firstTimestamp);
        });

        it('should bypass cache on manual reload', async function() {
            await loader.loadRegistry();
            const firstTimestamp = loader.cacheTimestamp;

            await loader.reloadRegistry();
            const secondTimestamp = loader.cacheTimestamp;

            expect(secondTimestamp).to.be.greaterThan(firstTimestamp);
        });
    });

    describe('Validation', function() {
        it('should validate valid plugin', function() {
            const validPlugin = {
                name: 'test',
                version: '1.0.0',
                description: 'Test plugin',
                publisher: 'tester'
            };
            expect(loader.validatePlugin(validPlugin)).to.be.true;
        });

        it('should reject plugin missing required fields', function() {
            const invalidPlugin = {
                name: 'test',
                version: '1.0.0'
                // Missing description and publisher
            };
            expect(loader.validatePlugin(invalidPlugin)).to.be.false;
        });
    });
});

describe('Plugin Manager Integration', function() {
    // Note: These tests would require mocking the app, store, and actions
    // This is a placeholder for integration tests

    it('should integrate with existing plugin manager', function() {
        // TODO: Test plugins.getLibrary() with registry loader
        // TODO: Test searchRegistry() method
        // TODO: Test getPluginDetails() method
        // TODO: Test reloadRegistry() method
    });
});
