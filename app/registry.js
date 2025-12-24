/**
 * Plugin Registry Loader
 *
 * Handles loading and managing plugin metadata from the central registry.
 * Supports both production mode (registry-based) and development mode (local fallback).
 * Supports namespace-based folder structure (@allow2/, @thirdparty/, etc.)
 */

import path from 'path';
import fs from 'fs';

/**
 * Registry loader class for managing plugin discovery
 */
class RegistryLoader {
    constructor(options = {}) {
        this.registryPath = options.registryPath || path.join(__dirname, '../../registry/plugins.json');
        this.registryDir = path.dirname(this.registryPath);
        this.pluginsDir = path.join(this.registryDir, 'plugins');
        this.developmentMode = options.developmentMode || process.env.NODE_ENV === 'development';
        this.cache = null;
        this.cacheTimestamp = null;
        this.cacheTTL = options.cacheTTL || 60000; // 1 minute cache
        this.pluginFileCache = {}; // Cache for individual plugin files
    }

    /**
     * Load plugins from registry with namespace support
     * @returns {Promise<Object>} Plugin registry data
     */
    async loadRegistry() {
        try {
            // Check cache first
            if (this.cache && this.cacheTimestamp && (Date.now() - this.cacheTimestamp < this.cacheTTL)) {
                console.log('[Registry] Using cached registry data');
                return this.cache;
            }

            // Check if registry file exists
            if (!fs.existsSync(this.registryPath)) {
                console.warn(`[Registry] Registry file not found at ${this.registryPath}`);

                if (this.developmentMode) {
                    console.log('[Registry] Development mode: using fallback data');
                    return this.getFallbackRegistry();
                }

                throw new Error(`Registry file not found: ${this.registryPath}`);
            }

            // Load and parse master registry
            const rawData = fs.readFileSync(this.registryPath, 'utf8');
            const registry = JSON.parse(rawData);

            // Validate registry structure
            if (!registry.plugins || !Array.isArray(registry.plugins)) {
                throw new Error('Invalid registry format: missing plugins array');
            }

            // Load additional plugins from namespace directories
            const namespacedPlugins = await this.loadNamespacedPlugins();

            // Merge namespaced plugins with master registry
            // Namespace plugins override master registry if same ID exists
            const mergedPlugins = this.mergePlugins(registry.plugins, namespacedPlugins);
            registry.plugins = mergedPlugins;

            // Update cache
            this.cache = registry;
            this.cacheTimestamp = Date.now();

            console.log(`[Registry] Loaded ${registry.plugins.length} plugins (${namespacedPlugins.length} from namespaces)`);
            return registry;

        } catch (error) {
            console.error('[Registry] Error loading registry:', error);

            if (this.developmentMode) {
                console.log('[Registry] Development mode: using fallback data');
                return this.getFallbackRegistry();
            }

            throw error;
        }
    }

    /**
     * Load plugins from namespace subdirectories
     * @returns {Promise<Array>} Array of plugin objects from namespace folders
     */
    async loadNamespacedPlugins() {
        const plugins = [];

        try {
            // Check if plugins directory exists
            if (!fs.existsSync(this.pluginsDir)) {
                console.log('[Registry] No plugins directory found, skipping namespace scan');
                return plugins;
            }

            // Get all namespace directories (starting with @)
            const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });
            const namespaces = entries.filter(entry =>
                entry.isDirectory() && entry.name.startsWith('@')
            );

            console.log(`[Registry] Found ${namespaces.length} namespace directories`);

            // Load plugins from each namespace
            for (const namespace of namespaces) {
                const namespacePath = path.join(this.pluginsDir, namespace.name);
                const namespacePlugins = await this.loadNamespaceDirectory(namespace.name, namespacePath);
                plugins.push(...namespacePlugins);
            }

        } catch (error) {
            console.warn('[Registry] Error loading namespaced plugins:', error.message);
            // Don't fail completely, just return what we have
        }

        return plugins;
    }

    /**
     * Load all plugin files from a namespace directory
     * @param {string} namespace - Namespace name (e.g., '@allow2')
     * @param {string} namespacePath - Full path to namespace directory
     * @returns {Promise<Array>} Array of plugin objects
     */
    async loadNamespaceDirectory(namespace, namespacePath) {
        const plugins = [];

        try {
            const files = fs.readdirSync(namespacePath);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            console.log(`[Registry] Loading ${jsonFiles.length} plugins from ${namespace}`);

            for (const file of jsonFiles) {
                try {
                    const plugin = await this.loadPluginFile(namespace, file);
                    if (plugin) {
                        // Validate namespace matches
                        const expectedNamespace = this.extractNamespace(plugin.name);
                        if (expectedNamespace && expectedNamespace !== namespace) {
                            console.warn(`[Registry] Namespace mismatch: ${plugin.name} in ${namespace} folder`);
                        }
                        plugins.push(plugin);
                    }
                } catch (error) {
                    console.warn(`[Registry] Error loading ${namespace}/${file}:`, error.message);
                }
            }

        } catch (error) {
            console.warn(`[Registry] Error reading namespace directory ${namespace}:`, error.message);
        }

        return plugins;
    }

    /**
     * Load a single plugin file from namespace directory
     * @param {string} namespace - Namespace name
     * @param {string} filename - Plugin filename
     * @returns {Promise<Object|null>} Plugin object or null
     */
    async loadPluginFile(namespace, filename) {
        const filePath = path.join(this.pluginsDir, namespace, filename);

        try {
            const rawData = fs.readFileSync(filePath, 'utf8');
            const plugin = JSON.parse(rawData);

            // Validate required fields
            if (!plugin.id || !plugin.name || !plugin.version) {
                console.warn(`[Registry] Invalid plugin file ${namespace}/${filename}: missing required fields`);
                return null;
            }

            // Add metadata about file location
            plugin.pluginFile = `${namespace}/${filename}`;
            plugin.namespace = namespace;

            // Cache the plugin
            const cacheKey = `${namespace}/${plugin.id}`;
            this.pluginFileCache[cacheKey] = plugin;

            return plugin;

        } catch (error) {
            console.warn(`[Registry] Error loading plugin file ${filePath}:`, error.message);
            return null;
        }
    }

    /**
     * Load a specific plugin by namespace identifier
     * @param {string} pluginIdentifier - Full plugin name (e.g., '@allow2/allow2automate-wemo')
     * @returns {Promise<Object|null>} Plugin object or null
     */
    async loadPlugin(pluginIdentifier) {
        try {
            // Check cache first
            const registry = await this.loadRegistry();

            // Find in loaded plugins
            const plugin = registry.plugins.find(p =>
                p.name === pluginIdentifier ||
                p.id === pluginIdentifier ||
                p.package === pluginIdentifier
            );

            if (plugin) {
                return plugin;
            }

            // Try to load directly from namespace if not in cache
            const namespace = this.extractNamespace(pluginIdentifier);
            const pluginName = this.extractPluginName(pluginIdentifier);

            if (namespace && pluginName) {
                const filename = `${pluginName}.json`;
                return await this.loadPluginFile(namespace, filename);
            }

            return null;

        } catch (error) {
            console.error(`[Registry] Error loading plugin ${pluginIdentifier}:`, error);
            return null;
        }
    }

    /**
     * Merge plugins from different sources
     * Namespace plugins override master registry plugins with same ID
     * @param {Array} masterPlugins - Plugins from master registry
     * @param {Array} namespacePlugins - Plugins from namespace directories
     * @returns {Array} Merged plugin array
     */
    mergePlugins(masterPlugins, namespacePlugins) {
        const pluginMap = new Map();

        // Add master plugins first
        for (const plugin of masterPlugins) {
            pluginMap.set(plugin.id, plugin);
        }

        // Override with namespace plugins
        for (const plugin of namespacePlugins) {
            const existing = pluginMap.get(plugin.id);
            if (existing) {
                console.log(`[Registry] Overriding ${plugin.id} with namespace version`);
            }
            pluginMap.set(plugin.id, plugin);
        }

        return Array.from(pluginMap.values());
    }

    /**
     * Extract namespace from plugin name
     * @param {string} pluginName - Plugin name (e.g., '@allow2/allow2automate-wemo')
     * @returns {string|null} Namespace or null
     */
    extractNamespace(pluginName) {
        if (!pluginName) return null;
        const match = pluginName.match(/^(@[^/]+)\//);
        return match ? match[1] : null;
    }

    /**
     * Extract plugin name without namespace
     * @param {string} fullName - Full plugin name
     * @returns {string} Plugin name without namespace
     */
    extractPluginName(fullName) {
        if (!fullName) return fullName;
        const namespace = this.extractNamespace(fullName);
        if (namespace) {
            return fullName.substring(namespace.length + 1);
        }
        return fullName;
    }

    /**
     * Scan for orphaned plugin files
     * Returns plugins in namespace directories that aren't in master registry
     * @returns {Promise<Array>} Array of orphaned plugin info
     */
    async findOrphanedPlugins() {
        const orphans = [];

        try {
            const registry = await this.loadRegistry();
            const masterPluginIds = new Set(registry.plugins.map(p => p.id));

            const namespacedPlugins = await this.loadNamespacedPlugins();

            for (const plugin of namespacedPlugins) {
                if (!masterPluginIds.has(plugin.id)) {
                    orphans.push({
                        id: plugin.id,
                        name: plugin.name,
                        file: plugin.pluginFile,
                        namespace: plugin.namespace
                    });
                }
            }

            if (orphans.length > 0) {
                console.warn(`[Registry] Found ${orphans.length} orphaned plugin files`);
            }

        } catch (error) {
            console.error('[Registry] Error finding orphaned plugins:', error);
        }

        return orphans;
    }

    /**
     * Get plugin library in the format expected by existing code
     * @returns {Promise<Object>} Plugin library object
     */
    async getLibrary() {
        try {
            const registry = await this.loadRegistry();

            // Transform registry format to legacy library format
            const library = {};

            registry.plugins.forEach(plugin => {
                const packageName = plugin.package || plugin.name;
                library[packageName] = {
                    name: packageName,
                    shortName: plugin.name,
                    publisher: plugin.publisher || 'unknown',
                    releases: {
                        latest: plugin.version || '1.0.0'
                    },
                    description: plugin.description || '',
                    main: plugin.main || './index.js',
                    repository: plugin.repository || {
                        type: 'git',
                        url: plugin.github || ''
                    },
                    keywords: plugin.keywords || [],
                    // Additional registry metadata
                    category: plugin.category || 'general',
                    verified: plugin.verified || false,
                    downloads: plugin.downloads || 0,
                    rating: plugin.rating || 0
                };
            });

            return library;

        } catch (error) {
            console.error('[Registry] Error getting library:', error);
            throw error;
        }
    }

    /**
     * Search plugins by criteria
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Array>} Filtered plugins
     */
    async searchPlugins(criteria = {}) {
        try {
            const registry = await this.loadRegistry();
            let plugins = [...registry.plugins];

            // Filter by category
            if (criteria.category) {
                plugins = plugins.filter(p => p.category === criteria.category);
            }

            // Filter by keyword
            if (criteria.keyword) {
                plugins = plugins.filter(p =>
                    p.keywords && p.keywords.includes(criteria.keyword)
                );
            }

            // Filter by publisher
            if (criteria.publisher) {
                plugins = plugins.filter(p => p.publisher === criteria.publisher);
            }

            // Filter by verified status
            if (criteria.verified !== undefined) {
                plugins = plugins.filter(p => p.verified === criteria.verified);
            }

            // Sort results
            if (criteria.sort === 'downloads') {
                plugins.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
            } else if (criteria.sort === 'rating') {
                plugins.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            } else if (criteria.sort === 'name') {
                plugins.sort((a, b) => a.name.localeCompare(b.name));
            }

            return plugins;

        } catch (error) {
            console.error('[Registry] Error searching plugins:', error);
            throw error;
        }
    }

    /**
     * Get plugin details by name
     * @param {string} pluginName - Plugin name
     * @returns {Promise<Object|null>} Plugin details or null
     */
    async getPlugin(pluginName) {
        try {
            const registry = await this.loadRegistry();
            return registry.plugins.find(p =>
                p.name === pluginName || p.package === pluginName
            ) || null;

        } catch (error) {
            console.error('[Registry] Error getting plugin:', error);
            throw error;
        }
    }

    /**
     * Reload registry data (bypass cache)
     * @returns {Promise<Object>} Fresh registry data
     */
    async reloadRegistry() {
        this.cache = null;
        this.cacheTimestamp = null;
        this.pluginFileCache = {};
        return this.loadRegistry();
    }

    /**
     * Fallback registry for development mode
     * Returns hardcoded plugin data when registry is unavailable
     * @returns {Object} Fallback registry
     */
    getFallbackRegistry() {
        return {
            metadata: {
                version: '1.0.0',
                lastUpdated: new Date().toISOString(),
                totalPlugins: 4
            },
            plugins: [
                {
                    name: 'battle.net',
                    package: '@allow2/allow2automate-battle.net',
                    version: '0.0.2',
                    description: 'Enable Allow2Automate management of Battle.Net parental controls',
                    publisher: 'allow2',
                    category: 'gaming',
                    keywords: ['allow2automate', 'battle.net', 'wow', 'world of warcraft'],
                    repository: {
                        type: 'git',
                        url: 'https://github.com/Allow2/allow2automate-battle.net'
                    },
                    main: './dist/index.js',
                    verified: true,
                    downloads: 1500,
                    rating: 4.5
                },
                {
                    name: 'ssh',
                    package: '@allow2/allow2automate-ssh',
                    version: '0.0.2',
                    description: 'Enable Allow2Automate the ability to use ssh to configure devices',
                    publisher: 'allow2',
                    category: 'connectivity',
                    keywords: ['allow2automate', 'allow2', 'ssh'],
                    repository: {
                        type: 'git',
                        url: 'https://github.com/Allow2/allow2automate-ssh'
                    },
                    main: './dist/index.js',
                    verified: true,
                    downloads: 800,
                    rating: 4.2
                },
                {
                    name: 'wemo',
                    package: '@allow2/allow2automate-wemo',
                    version: '0.0.4',
                    description: 'Enable Allow2Automate the ability to control wemo devices',
                    publisher: 'allow2',
                    category: 'iot',
                    keywords: ['allow2automate', 'allow2', 'wemo'],
                    repository: {
                        type: 'git',
                        url: 'https://github.com/Allow2/allow2automate-wemo'
                    },
                    main: './dist/index.js',
                    verified: true,
                    downloads: 1200,
                    rating: 4.7
                },
                {
                    name: 'safefamily',
                    package: 'mcafee-safefamily',
                    version: '1.0.0',
                    description: 'Enable Allow2Automate management of McAfee Safe Family parental controls',
                    publisher: 'mcafee',
                    category: 'parental-control',
                    keywords: ['allow2automate', 'mcafee', 'safefamily'],
                    repository: {
                        type: 'git',
                        url: 'https://github.com/McAfee/allow2automate-safefamily'
                    },
                    main: './index.js',
                    verified: false,
                    downloads: 500,
                    rating: 3.8
                }
            ]
        };
    }

    /**
     * Validate plugin entry
     * @param {Object} plugin - Plugin object
     * @returns {boolean} Is valid
     */
    validatePlugin(plugin) {
        const required = ['name', 'version', 'description', 'publisher'];
        return required.every(field => plugin.hasOwnProperty(field) && plugin[field]);
    }
}

/**
 * Create and export registry loader instance
 */
export function createRegistryLoader(options) {
    return new RegistryLoader(options);
}

/**
 * Default export for backward compatibility
 */
export default RegistryLoader;
