import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Marketplace from '../components/Marketplace';
import actions from '../actions';

const mapStateToProps = (state, ownProps) => {
    console.log('[MarketplacePage] mapStateToProps called');
    console.log('[MarketplacePage] Full state:', state);
    console.log('[MarketplacePage] state.pluginLibrary:', state.pluginLibrary);
    console.log('[MarketplacePage] pluginLibrary type:', typeof state.pluginLibrary);
    console.log('[MarketplacePage] pluginLibrary keys:', state.pluginLibrary ? Object.keys(state.pluginLibrary) : 'null/undefined');

    // Debug: Check for dev_plugin flags
    if (state.pluginLibrary) {
        const devPlugins = Object.entries(state.pluginLibrary).filter(([k, v]) => v && typeof v === 'object' && v.dev_plugin);
        console.log('[MarketplacePage] Dev-plugins in state:', devPlugins.length);
        devPlugins.forEach(([key, plugin]) => {
            console.log('[MarketplacePage]   -', key, '(dev_plugin:', plugin.dev_plugin, ')');
        });
    }

    return {
        pluginLibrary: state.pluginLibrary,
        installedPlugins: state.installedPlugins,
        marketplace: state.marketplace,
        searchQuery: state.marketplace.searchQuery,
        categoryFilter: state.marketplace.categoryFilter,
        selectedPlugin: state.marketplace.selectedPlugin,
        isLoading: state.marketplace.isLoading,
        featuredPlugins: state.marketplace.featuredPlugins,
        installationStatus: state.marketplace.installationStatus,
        // NEW: Registry loading state
        registryLoading: state.marketplace.registryLoading,
        registryError: state.marketplace.registryError,
        isFromCache: state.marketplace.isFromCache,
        cacheTimestamp: state.marketplace.cacheTimestamp,
        // Pass through props from parent
        showCloseButton: ownProps.showCloseButton,
        onClose: ownProps.onClose
    };
};

const mapDispatchToProps = (dispatch) => {
    return bindActionCreators({
        onInstallPlugin: (pluginName, callback) => {
            return async (dispatch, getState) => {
                console.log('[MarketplacePage] Installing plugin:', pluginName);

                // Set loading state
                dispatch(actions.installPlugin(pluginName));
                dispatch(actions.setLoading(true));

                try {
                    const state = getState();
                    const plugin = state.pluginLibrary[pluginName];

                    if (!plugin) {
                        throw new Error(`Plugin ${pluginName} not found in library`);
                    }

                    console.log('[MarketplacePage] Plugin details:', plugin);
                    console.log('[MarketplacePage] Repository:', plugin.repository);

                    // Check if this is a dev-plugin - ALWAYS force reinstall
                    const isDevPlugin = plugin.dev_plugin || (plugin.installation && plugin.installation.dev_plugin);
                    if (isDevPlugin) {
                        console.log('[MarketplacePage] 🔧 Dev-plugin detected - FORCE REINSTALL from local path');

                        // For dev-plugins, we still need to run npm install to:
                        // 1. Create proper symlink/copy in node_modules
                        // 2. Install plugin's dependencies
                        // 3. Ensure plugin can be required() correctly

                        // Continue with npm install using the local file:// path
                        // DON'T return early - let the normal installation flow handle it
                    }

                    // Get installation URL from plugin metadata
                    let installUrl = plugin.installation && plugin.installation.install_url
                        ? plugin.installation.install_url
                        : plugin.repository && plugin.repository.url
                        ? plugin.repository.url
                        : null;

                    if (!installUrl) {
                        throw new Error(`No installation URL found for ${pluginName}`);
                    }

                    // Fix version tag format: repositories use "0.0.1" not "v0.0.1"
                    // Convert git+https://...#vX.X.X to git+https://...#X.X.X
                    installUrl = installUrl.replace(/#v(\d+\.\d+\.\d+)/, '#$1');

                    console.log('[MarketplacePage] Installing from:', installUrl);

                    // Use child_process to run npm install
                    const { exec } = require('child_process');
                    const { ipcRenderer } = require('electron');
                    // Get environment-aware plugin path from main process
                    const pluginsDir = ipcRenderer.sendSync('getPath', 'plugins');

                    console.log('[MarketplacePage] Plugins directory:', pluginsDir);

                    // Try installation with tag first, fallback to default branch if tag missing
                    const attemptInstall = async (url) => {
                        // For dev-plugins, always use --force to ensure fresh reinstall
                        const forceFlag = isDevPlugin ? '--force' : '';
                        const npmCommand = `npm install --legacy-peer-deps ${forceFlag} --prefix "${pluginsDir}" "${url}"`;
                        console.log('[MarketplacePage] Running:', npmCommand);

                        return new Promise((resolve, reject) => {
                            exec(npmCommand, (error, stdout, stderr) => {
                                if (error) {
                                    reject({ error, stdout, stderr });
                                    return;
                                }
                                console.log('[MarketplacePage] Install stdout:', stdout);
                                resolve(url);
                            });
                        });
                    };

                    // Try primary URL, then fallback to repo without tag
                    let actualInstallUrl;
                    try {
                        actualInstallUrl = await attemptInstall(installUrl);
                    } catch (firstError) {
                        console.warn('[MarketplacePage] ⚠️ Install with tag failed:', firstError.error.message);
                        console.warn('[MarketplacePage] stderr:', firstError.stderr);

                        // Check if error is tag-related
                        if (firstError.stderr && firstError.stderr.includes('pathspec') && firstError.stderr.includes('did not match')) {
                            // Extract base URL without tag
                            const fallbackUrl = installUrl.split('#')[0];
                            console.log('[MarketplacePage] 🔄 Retrying without tag:', fallbackUrl);

                            try {
                                actualInstallUrl = await attemptInstall(fallbackUrl);
                                console.log('[MarketplacePage] ✅ Installed from default branch');
                            } catch (secondError) {
                                console.error('[MarketplacePage] ❌ Both attempts failed');
                                throw firstError.error; // Throw original error
                            }
                        } else {
                            throw firstError.error;
                        }
                    }

                    // Validate package.json compliance AFTER installation
                    const path = require('path');
                    const fs = require('fs');

                    // Check both scoped and unscoped locations
                    const scopedPath = path.join(pluginsDir, 'node_modules', pluginName, 'package.json');
                    const unscopedName = pluginName.replace(/^@[^/]+\//, '');
                    const unscopedPath = path.join(pluginsDir, 'node_modules', unscopedName, 'package.json');

                    let installedPackageJson;
                    let actualInstalledPath;

                    if (fs.existsSync(scopedPath)) {
                        installedPackageJson = JSON.parse(fs.readFileSync(scopedPath, 'utf8'));
                        actualInstalledPath = scopedPath;
                    } else if (fs.existsSync(unscopedPath)) {
                        installedPackageJson = JSON.parse(fs.readFileSync(unscopedPath, 'utf8'));
                        actualInstalledPath = unscopedPath;
                    } else {
                        throw new Error('Plugin package.json not found after installation');
                    }

                    console.log('[MarketplacePage] Validating package.json at:', actualInstalledPath);
                    console.log('[MarketplacePage] Expected name:', pluginName);
                    console.log('[MarketplacePage] Actual name:', installedPackageJson.name);

                    // Compliance check: package name must match expected scoped name
                    if (installedPackageJson.name !== pluginName) {
                        // Uninstall the non-compliant plugin
                        const uninstallCommand = `npm uninstall --prefix "${pluginsDir}" "${installedPackageJson.name}"`;
                        console.warn('[MarketplacePage] ⚠️ Non-compliant plugin, uninstalling:', uninstallCommand);

                        exec(uninstallCommand, () => {
                            console.log('[MarketplacePage] Non-compliant plugin removed');
                        });

                        throw new Error(
                            `Plugin is not compliant. Expected package name "${pluginName}" but got "${installedPackageJson.name}". ` +
                            `The plugin repository must update their package.json to use the scoped name.`
                        );
                    }

                    console.log('[MarketplacePage] ✅ Plugin is compliant');

                    // Add to installed plugins
                    dispatch(actions.installedPluginUpdate({
                        [pluginName]: {
                            name: pluginName,
                            enabled: true,
                            installedAt: Date.now(),
                            version: plugin.releases && plugin.releases.latest,
                            installUrl: actualInstallUrl,
                            dev_plugin: isDevPlugin || false,
                            local_path: isDevPlugin ? plugin.installation.local_path : undefined
                        }
                    }));

                    // Mark as successfully installed
                    dispatch(actions.installPluginSuccess(pluginName));
                    dispatch(actions.setLoading(false));

                    console.log('[MarketplacePage] ✅ Plugin installed successfully');

                    if (callback) {
                        callback(null);
                    }
                } catch (error) {
                    console.error('[MarketplacePage] ❌ Installation failed:', error);

                    // Handle installation failure
                    dispatch(actions.installPluginFailure({
                        pluginName,
                        error: error.message
                    }));
                    dispatch(actions.setLoading(false));

                    if (callback) {
                        callback(error);
                    }
                }
            };
        },
        onRefresh: () => {
            return async (dispatch) => {
                // Reload the registry and update the store
                const { createRegistryLoader } = require('../registry');

                // CRITICAL: Must pass developmentMode to load dev-plugins
                const registryLoader = createRegistryLoader({
                    developmentMode: process.env.NODE_ENV === 'development',
                    cacheTTL: 3600000, // 1 hour cache
                    requestTimeout: 10000 // 10 second network timeout
                });

                try {
                    console.log('[MarketplacePage] 🔄 Refreshing registry...');
                    console.log('[MarketplacePage] Development mode:', process.env.NODE_ENV === 'development');

                    const library = await registryLoader.getLibrary();

                    console.log('[MarketplacePage] ✅ Registry refreshed successfully');
                    console.log('[MarketplacePage] Total plugins loaded:', Object.keys(library).filter(k => !k.startsWith('_')).length);
                    console.log('[MarketplacePage] Dev-plugins loaded:', Object.values(library).filter(p => p && p.dev_plugin).length);

                    dispatch(actions.libraryReplace(library));
                } catch (error) {
                    console.error('[MarketplacePage] ❌ Failed to refresh registry:', error);
                    throw error;
                }
            };
        },
        onUninstallPlugin: actions.uninstallPlugin,
        onSearchChange: actions.setSearchQuery,
        onCategoryChange: actions.setCategoryFilter,
        onSelectPlugin: actions.selectPlugin,
        onClearSelection: actions.clearSelectedPlugin,
        onRefreshMarketplace: actions.refreshMarketplace
    }, dispatch);
};

export default connect(mapStateToProps, mapDispatchToProps)(Marketplace);
