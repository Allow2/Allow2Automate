/**
 * Plugin Registry Loader
 *
 * Handles loading and managing plugin metadata from the central registry.
 * Fetches from GitHub with electron-settings caching and fallback support.
 * Supports both production mode (registry-based) and development mode (local fallback).
 * Supports namespace-based folder structure (@allow2/, @thirdparty/, etc.)
 * Includes compliance validation for plugin dependencies (peerDependencies vs dependencies).
 */

import path from 'path';
import fs from 'fs';
import request from 'request';
import settings from 'electron-settings';

/**
 * Validate plugin compliance with dependency rules
 * Checks if React and Material-UI are properly declared in peerDependencies
 * @param {Object} plugin - Plugin metadata object
 * @returns {Object} Validation result with compliance status and issues
 */
function validatePluginCompliance(plugin) {
    const issues = [];
    const warnings = [];

    // Check if plugin has package info
    if (!plugin.dependencies && !plugin.peerDependencies) {
        warnings.push('No dependency information available - unable to validate');
        return {
            compliant: null, // Unknown compliance status
            issues: [],
            warnings: warnings
        };
    }

    // Check if React is in dependencies (should be in peerDependencies)
    if (plugin.dependencies && plugin.dependencies['react']) {
        issues.push('React should be in peerDependencies, not dependencies');
    }

    // Check if React DOM is in dependencies (should be in peerDependencies)
    if (plugin.dependencies && plugin.dependencies['react-dom']) {
        issues.push('react-dom should be in peerDependencies, not dependencies');
    }

    // Check if Material-UI v4 is in dependencies (should be in peerDependencies)
    if (plugin.dependencies && plugin.dependencies['@material-ui/core']) {
        issues.push('@material-ui/core should be in peerDependencies, not dependencies');
    }

    // Check if Material-UI v5 is in dependencies (should be in peerDependencies)
    if (plugin.dependencies && plugin.dependencies['@mui/material']) {
        issues.push('@mui/material should be in peerDependencies, not dependencies');
    }

    // Check if Material-UI icons are in dependencies (should be in peerDependencies)
    if (plugin.dependencies && plugin.dependencies['@material-ui/icons']) {
        issues.push('@material-ui/icons should be in peerDependencies, not dependencies');
    }

    if (plugin.dependencies && plugin.dependencies['@mui/icons-material']) {
        issues.push('@mui/icons-material should be in peerDependencies, not dependencies');
    }

    // Check if peerDependencies exist for React-based plugins
    if (!plugin.peerDependencies || !plugin.peerDependencies['react']) {
        // Only warn if plugin seems React-based (has React in dependencies or keywords)
        const isReactPlugin =
            (plugin.dependencies && plugin.dependencies['react']) ||
            (plugin.keywords && plugin.keywords.some(k => k.toLowerCase().includes('react')));

        if (isReactPlugin) {
            warnings.push('Missing React in peerDependencies - plugin may not be React-based');
        }
    }

    // Check for Redux in dependencies (should typically be in peerDependencies for plugins)
    if (plugin.dependencies && plugin.dependencies['redux']) {
        warnings.push('Redux in dependencies - consider using peerDependencies if plugin extends host Redux store');
    }

    if (plugin.dependencies && plugin.dependencies['react-redux']) {
        warnings.push('react-redux in dependencies - consider using peerDependencies for consistency');
    }

    return {
        compliant: issues.length === 0,
        issues: issues,
        warnings: warnings
    };
}

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
        this.cacheTTL = options.cacheTTL || 3600000; // 1 hour cache (was 1 minute)
        this.pluginFileCache = {}; // Cache for individual plugin files

        // GitHub registry configuration - hardcoded to official registry
        this.githubUrl = 'https://raw.githubusercontent.com/Allow2/allow2automate-registry/master/plugins.json';
        this.requestTimeout = 10000; // 10 second timeout
        this.cacheKey = 'registry.plugins';
        this.cacheTimestampKey = 'registry.timestamp';
        this.cacheVersionKey = 'registry.version';
    }

    /**
     * Fetch registry from GitHub with retry logic
     * @param {number} retryCount - Current retry attempt (internal use)
     * @returns {Promise<Object>} Registry data from GitHub
     */
    async fetchFromGitHub(retryCount = 0) {
        const maxRetries = 3;
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s

        return new Promise((resolve, reject) => {
            console.log('[Registry] ========== FETCHING FROM GITHUB ==========');
            console.log('[Registry] URL:', this.githubUrl);
            console.log('[Registry] Timeout:', this.requestTimeout, 'ms');
            if (retryCount > 0) {
                console.log(`[Registry] Retry attempt ${retryCount}/${maxRetries}`);
            }

            const options = {
                url: this.githubUrl,
                timeout: this.requestTimeout,
                headers: {
                    'User-Agent': 'Allow2Automate/2.0.0',
                    'Cache-Control': 'no-cache'
                }
            };

            const startTime = Date.now();

            request(options, async (error, response, body) => {
                const duration = Date.now() - startTime;
                console.log('[Registry] Request completed in', duration, 'ms');

                if (error) {
                    console.error('[Registry] ❌ GitHub fetch error:', error.message);
                    console.error('[Registry] Error code:', error.code);

                    // Retry on network errors
                    if (retryCount < maxRetries && (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || error.code === 'ECONNRESET')) {
                        console.log(`[Registry] ⏳ Retrying in ${retryDelay}ms...`);
                        setTimeout(async () => {
                            try {
                                const result = await this.fetchFromGitHub(retryCount + 1);
                                resolve(result);
                            } catch (retryError) {
                                reject(retryError);
                            }
                        }, retryDelay);
                        return;
                    }

                    console.error('[Registry] Error details:', error);
                    return reject(new Error(`GitHub fetch failed after ${retryCount + 1} attempts: ${error.message}`));
                }

                console.log('[Registry] Response status:', response.statusCode);

                if (response.statusCode !== 200) {
                    console.error(`[Registry] ❌ GitHub HTTP error: ${response.statusCode}`);
                    console.error('[Registry] Response body:', body ? body.substring(0, 200) : 'empty');

                    // Retry on 5xx errors
                    if (retryCount < maxRetries && response.statusCode >= 500) {
                        console.log(`[Registry] ⏳ Server error, retrying in ${retryDelay}ms...`);
                        setTimeout(async () => {
                            try {
                                const result = await this.fetchFromGitHub(retryCount + 1);
                                resolve(result);
                            } catch (retryError) {
                                reject(retryError);
                            }
                        }, retryDelay);
                        return;
                    }

                    return reject(new Error(`GitHub HTTP error: ${response.statusCode}`));
                }

                console.log('[Registry] Body length:', body ? body.length : 0, 'bytes');

                try {
                    const registry = JSON.parse(body);
                    console.log('[Registry] ✅ JSON parsed successfully');

                    // Validate registry structure
                    if (!registry.plugins || !Array.isArray(registry.plugins)) {
                        console.error('[Registry] ❌ Invalid registry format: missing plugins array');
                        console.error('[Registry] Registry keys:', Object.keys(registry));
                        throw new Error('Invalid registry format: missing plugins array');
                    }

                    console.log(`[Registry] ✅ Successfully fetched ${registry.plugins.length} plugins from GitHub`);
                    console.log('[Registry] ========================================');
                    resolve(registry);
                } catch (parseError) {
                    console.error('[Registry] ❌ JSON parse error:', parseError.message);
                    console.error('[Registry] Parse error stack:', parseError.stack);
                    reject(new Error(`Invalid JSON from GitHub: ${parseError.message}`));
                }
            });
        });
    }

    /**
     * Get cached registry from electron-settings
     * @returns {Object|null} Cached registry data or null
     */
    getCachedRegistry() {
        try {
            const cachedData = settings.getSync(this.cacheKey);
            const cachedTimestamp = settings.getSync(this.cacheTimestampKey);

            if (cachedData && cachedTimestamp) {
                console.log('[Registry] Found cached registry data');
                return {
                    data: cachedData,
                    timestamp: cachedTimestamp
                };
            }

            console.log('[Registry] No cached registry data found');
            return null;
        } catch (error) {
            console.warn('[Registry] Error reading cache:', error.message);
            return null;
        }
    }

    /**
     * Save registry to electron-settings cache
     * @param {Object} registryData - Registry data to cache
     */
    setCachedRegistry(registryData) {
        try {
            const timestamp = Date.now();
            settings.setSync(this.cacheKey, registryData);
            settings.setSync(this.cacheTimestampKey, timestamp);

            // Store version if available
            if (registryData.metadata && registryData.metadata.version) {
                settings.setSync(this.cacheVersionKey, registryData.metadata.version);
            }

            console.log('[Registry] Cached registry data');
        } catch (error) {
            console.warn('[Registry] Error saving to cache:', error.message);
        }
    }

    /**
     * Check if cached registry is stale
     * @returns {boolean} True if cache needs refresh
     */
    isCacheStale() {
        try {
            const cachedTimestamp = settings.getSync(this.cacheTimestampKey);

            if (!cachedTimestamp) {
                return true;
            }

            const age = Date.now() - cachedTimestamp;
            const isStale = age > this.cacheTTL;

            if (isStale) {
                console.log(`[Registry] Cache is stale (age: ${Math.round(age / 60000)} minutes)`);
            }

            return isStale;
        } catch (error) {
            console.warn('[Registry] Error checking cache staleness:', error.message);
            return true;
        }
    }

    /**
     * Get registry with smart GitHub fetch and cache fallback
     * @returns {Promise<Object>} Registry data
     */
    async getRegistry() {
        console.log('[Registry] ========== GET REGISTRY START (NO CACHE) ==========');

        try {
            // Always fetch fresh from GitHub - no caching
            console.log('[Registry] 🌐 Fetching fresh data from GitHub (cache disabled)...');
            const registry = await this.fetchFromGitHub();
            console.log('[Registry] ✅ GitHub fetch successful');
            console.log('[Registry] Plugins loaded:', registry.plugins ? registry.plugins.length : 'N/A');
            return registry;
        } catch (error) {
            console.error('[Registry] ❌ GitHub fetch failed:', error.message);
            console.error('[Registry] ❌ No cache fallback - registry must be loaded from GitHub');
            throw new Error(`Failed to load plugin registry: ${error.message}. Please check your internet connection.`);
        } finally {
            console.log('[Registry] ========== GET REGISTRY END ==========');
        }
    }

    /**
     * Load plugins from registry with namespace support
     * @returns {Promise<Object>} Plugin registry data
     */
    async loadRegistry() {
        try {
            // Always fetch fresh data from GitHub - no caching
            console.log('[Registry] Fetching fresh registry from GitHub (no cache)');
            const registry = await this.getRegistry();

            // Validate registry structure
            if (!registry.plugins || !Array.isArray(registry.plugins)) {
                throw new Error('Invalid registry format: missing plugins array');
            }

            // Load additional plugins from namespace directories (local only)
            const namespacedPlugins = await this.loadNamespacedPlugins();

            // Merge namespaced plugins with master registry
            // Namespace plugins override master registry if same ID exists
            const mergedPlugins = this.mergePlugins(registry.plugins, namespacedPlugins);
            registry.plugins = mergedPlugins;

            console.log(`[Registry] Loaded ${registry.plugins.length} plugins (${namespacedPlugins.length} from namespaces)`);
            return registry;

        } catch (error) {
            console.error('[Registry] Error loading registry:', error);
            console.error('[Registry] ❌ No fallback data available');
            throw new Error(`Failed to load plugin registry: ${error.message}`);
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

            // Load package.json for compliance validation if available
            await this.enrichPluginWithPackageInfo(plugin);

            // Validate plugin compliance
            const validation = validatePluginCompliance(plugin);
            plugin.compliance = {
                compliant: validation.compliant,
                validationErrors: validation.issues,
                validationWarnings: validation.warnings,
                lastChecked: new Date().toISOString()
            };

            // Log compliance issues
            if (!validation.compliant && validation.issues.length > 0) {
                console.warn(`[Registry] ⚠️ Plugin ${plugin.name} has compliance issues:`, validation.issues);
            }

            if (validation.warnings.length > 0) {
                console.log(`[Registry] ℹ️ Plugin ${plugin.name} compliance warnings:`, validation.warnings);
            }

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
     * Enrich plugin metadata with package.json information
     * Attempts to load package.json from the plugin's installation directory
     * @param {Object} plugin - Plugin object to enrich
     * @returns {Promise<void>}
     */
    async enrichPluginWithPackageInfo(plugin) {
        try {
            const packageName = plugin.package || plugin.name;

            // Extract plugin directory name from package name
            // e.g., "@allow2/allow2automate-battle.net" -> "allow2automate-battle.net"
            const pluginDirName = packageName.replace(/^@[^/]+\//, '');

            const possiblePaths = [
                // Try plugins directory first (sibling to automate app)
                path.join(__dirname, '..', '..', 'plugins', pluginDirName, 'package.json'),
                // Try from process.cwd()
                path.join(process.cwd(), '..', 'plugins', pluginDirName, 'package.json'),
                // Try node_modules as fallback (for installed plugins)
                path.join(process.cwd(), 'node_modules', packageName, 'package.json'),
                path.join(__dirname, '..', 'node_modules', packageName, 'package.json'),
                path.join(__dirname, '..', '..', 'node_modules', packageName, 'package.json')
            ];

            for (const pkgPath of possiblePaths) {
                if (fs.existsSync(pkgPath)) {
                    const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

                    // Add dependency information to plugin metadata
                    plugin.dependencies = pkgData.dependencies || {};
                    plugin.peerDependencies = pkgData.peerDependencies || {};
                    plugin.devDependencies = pkgData.devDependencies || {};
                    plugin.packageJsonPath = pkgPath;

                    console.log(`[Registry] ✅ Loaded package.json for ${packageName} from ${pkgPath}`);
                    return;
                }
            }

            console.log(`[Registry] ℹ️ No package.json found for ${packageName} - skipping dependency validation`);
            console.log(`[Registry] Searched paths:`, possiblePaths);

        } catch (error) {
            console.warn(`[Registry] Error loading package.json for ${plugin.name}:`, error.message);
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
     * OPTIMIZED: Uses stale-while-revalidate pattern for instant loads
     * @returns {Promise<Object>} Plugin library object with cache metadata
     */
    async getLibrary() {
        console.log('[Registry] ========== GET LIBRARY START (ALWAYS FRESH) ==========');
        const startTime = Date.now();

        try {
            // Always load fresh data from GitHub - no cache
            console.log('[Registry] Loading fresh registry data from GitHub...');
            const registry = await this.loadRegistry();
            const duration = Date.now() - startTime;
            console.log(`[Registry] Registry loaded in ${duration}ms, plugins:`, registry.plugins ? registry.plugins.length : 'N/A');

            // Transform to library format
            const library = this.transformRegistryToLibrary(registry);
            library._fromCache = false;
            library._cacheTimestamp = null;

            console.log(`[Registry] ✅ Library ready in ${duration}ms`);
            console.log('[Registry] ========== GET LIBRARY END ==========');
            return library;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[Registry] ❌ Error getting library (${duration}ms):`, error.message);
            console.error('[Registry] Error stack:', error.stack);
            throw error;
        }
    }

    /**
     * Transform registry format to legacy library format
     * @param {Object} registry - Registry data
     * @returns {Object} Library object
     */
    transformRegistryToLibrary(registry) {
        const library = {};
        let compliantCount = 0;
        let nonCompliantCount = 0;
        let unknownCount = 0;

        registry.plugins.forEach((plugin, index) => {
            const packageName = plugin.package || plugin.name;

            // Track compliance stats
            if (plugin.compliance) {
                if (plugin.compliance.compliant === true) {
                    compliantCount++;
                } else if (plugin.compliance.compliant === false) {
                    nonCompliantCount++;
                } else {
                    unknownCount++;
                }
            }

            library[packageName] = {
                name: packageName,
                shortName: plugin.shortName || plugin.name,
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
                installation: plugin.installation || {
                    install_url: plugin.github || (plugin.repository ? plugin.repository.url : '')
                },
                keywords: plugin.keywords || [],
                // Additional registry metadata
                category: plugin.category || 'general',
                verified: plugin.verified || false,
                downloads: plugin.downloads || 0,
                rating: plugin.rating || 0,
                // Compliance metadata
                compliance: plugin.compliance || {
                    compliant: null,
                    validationErrors: [],
                    validationWarnings: ['No compliance check performed'],
                    lastChecked: null
                }
            };
        });

        console.log('[Registry] ✅ Library created with', Object.keys(library).length, 'plugins');
        console.log('[Registry] Compliance summary:');
        console.log(`[Registry]   - Compliant: ${compliantCount}`);
        console.log(`[Registry]   - Non-compliant: ${nonCompliantCount}`);
        console.log(`[Registry]   - Unknown: ${unknownCount}`);

        return library;
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
     * Get compliance report for all plugins
     * @returns {Promise<Object>} Compliance report with statistics and details
     */
    async getComplianceReport() {
        try {
            const registry = await this.loadRegistry();
            const report = {
                summary: {
                    total: registry.plugins.length,
                    compliant: 0,
                    nonCompliant: 0,
                    unknown: 0
                },
                compliantPlugins: [],
                nonCompliantPlugins: [],
                unknownPlugins: []
            };

            registry.plugins.forEach(plugin => {
                const entry = {
                    name: plugin.name,
                    package: plugin.package || plugin.name,
                    version: plugin.version,
                    compliance: plugin.compliance
                };

                if (plugin.compliance) {
                    if (plugin.compliance.compliant === true) {
                        report.summary.compliant++;
                        report.compliantPlugins.push(entry);
                    } else if (plugin.compliance.compliant === false) {
                        report.summary.nonCompliant++;
                        report.nonCompliantPlugins.push(entry);
                    } else {
                        report.summary.unknown++;
                        report.unknownPlugins.push(entry);
                    }
                } else {
                    report.summary.unknown++;
                    report.unknownPlugins.push(entry);
                }
            });

            return report;

        } catch (error) {
            console.error('[Registry] Error generating compliance report:', error);
            throw error;
        }
    }

    /**
     * Get non-compliant plugins with details
     * @returns {Promise<Array>} Array of non-compliant plugins with issues
     */
    async getNonCompliantPlugins() {
        try {
            const registry = await this.loadRegistry();
            return registry.plugins.filter(plugin =>
                plugin.compliance && plugin.compliance.compliant === false
            ).map(plugin => ({
                name: plugin.name,
                package: plugin.package || plugin.name,
                version: plugin.version,
                issues: plugin.compliance.validationErrors,
                warnings: plugin.compliance.validationWarnings,
                packageJsonPath: plugin.packageJsonPath
            }));

        } catch (error) {
            console.error('[Registry] Error getting non-compliant plugins:', error);
            throw error;
        }
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
