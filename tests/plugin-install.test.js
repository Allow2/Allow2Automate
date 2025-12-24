/**
 * Plugin Installation Workflow Tests
 *
 * Comprehensive tests for the complete plugin installation flow
 * Coverage: Installation actions, Redux integration, error handling
 */

const { expect } = require('chai');
const sinon = require('sinon');
const configureStore = require('redux-mock-store').default;
const thunk = require('redux-thunk').default;

// Import actions and reducers
const installedPluginActions = require('../build/actions/installedPlugins').default;
const installedPluginsReducer = require('../build/reducers/installedPlugins').default;

const mockStore = configureStore([thunk]);

describe('Plugin Installation Workflow', function() {
    let store;
    let sandbox;

    beforeEach(function() {
        sandbox = sinon.createSandbox();

        store = mockStore({
            installedPlugins: {
                'allow2automate-ssh': {
                    name: 'allow2automate-ssh',
                    enabled: true
                }
            },
            pluginLibrary: {
                'allow2automate-battle.net': {
                    name: 'allow2automate-battle.net',
                    shortName: 'battle.net',
                    description: 'Battle.net plugin',
                    version: '1.0.0'
                },
                'allow2automate-wemo': {
                    name: 'allow2automate-wemo',
                    shortName: 'wemo',
                    description: 'Wemo plugin',
                    version: '1.0.0'
                }
            }
        });
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('Installation Actions', function() {
        it('should create INSTALLED_PLUGIN_REPLACE action', function() {
            const payload = { 'test-plugin': { name: 'test-plugin' } };
            const action = installedPluginActions.installedPluginReplace(payload);

            expect(action.type).to.equal('INSTALLED_PLUGIN_REPLACE');
            expect(action.payload).to.deep.equal(payload);
        });

        it('should create INSTALLED_PLUGIN_UPDATE action', function() {
            const payload = { 'new-plugin': { name: 'new-plugin' } };
            const action = installedPluginActions.installedPluginUpdate(payload);

            expect(action.type).to.equal('INSTALLED_PLUGIN_UPDATE');
            expect(action.payload).to.deep.equal(payload);
        });

        it('should create INSTALLED_PLUGIN_REMOVE action', function() {
            const payload = { pluginName: 'test-plugin' };
            const action = installedPluginActions.installedPluginRemove(payload);

            expect(action.type).to.equal('INSTALLED_PLUGIN_REMOVE');
            expect(action.payload).to.deep.equal(payload);
        });

        it('should create SET_PLUGIN_ENABLED action', function() {
            const payload = { pluginName: 'test-plugin', isChecked: true };
            const action = installedPluginActions.setPluginEnabled(payload);

            expect(action.type).to.equal('SET_PLUGIN_ENABLED');
            expect(action.payload).to.deep.equal(payload);
        });
    });

    describe('Installation Reducer', function() {
        it('should handle INSTALLED_PLUGIN_REPLACE', function() {
            const initialState = {
                'old-plugin': { name: 'old-plugin' }
            };

            const newState = {
                'new-plugin': { name: 'new-plugin' }
            };

            const action = installedPluginActions.installedPluginReplace(newState);
            const result = installedPluginsReducer(initialState, action);

            expect(result).to.deep.equal(newState);
            expect(result).to.not.have.property('old-plugin');
        });

        it('should handle INSTALLED_PLUGIN_UPDATE by merging', function() {
            const initialState = {
                'plugin-1': { name: 'plugin-1', version: '1.0.0' }
            };

            const update = {
                'plugin-2': { name: 'plugin-2', version: '2.0.0' }
            };

            const action = installedPluginActions.installedPluginUpdate(update);
            const result = installedPluginsReducer(initialState, action);

            expect(result).to.have.property('plugin-1');
            expect(result).to.have.property('plugin-2');
            expect(Object.keys(result)).to.have.length(2);
        });

        it('should handle INSTALLED_PLUGIN_REMOVE', function() {
            const initialState = {
                'plugin-1': { name: 'plugin-1' },
                'plugin-2': { name: 'plugin-2' }
            };

            const action = installedPluginActions.installedPluginRemove({
                pluginName: 'plugin-1'
            });
            const result = installedPluginsReducer(initialState, action);

            expect(result).to.not.have.property('plugin-1');
            expect(result).to.have.property('plugin-2');
        });

        it('should not mutate original state on remove', function() {
            const initialState = {
                'plugin-1': { name: 'plugin-1' },
                'plugin-2': { name: 'plugin-2' }
            };

            const action = installedPluginActions.installedPluginRemove({
                pluginName: 'plugin-1'
            });
            const result = installedPluginsReducer(initialState, action);

            // Original state should be unchanged
            expect(initialState).to.have.property('plugin-1');
            expect(result).to.not.equal(initialState);
        });

        it('should handle SET_PLUGIN_ENABLED for enabling', function() {
            const initialState = {
                'test-plugin': {
                    name: 'test-plugin',
                    disabled: true
                }
            };

            const action = installedPluginActions.setPluginEnabled({
                pluginName: 'test-plugin',
                isChecked: true
            });
            const result = installedPluginsReducer(initialState, action);

            expect(result['test-plugin'].disabled).to.be.false;
        });

        it('should handle SET_PLUGIN_ENABLED for disabling', function() {
            const initialState = {
                'test-plugin': {
                    name: 'test-plugin',
                    disabled: false
                }
            };

            const action = installedPluginActions.setPluginEnabled({
                pluginName: 'test-plugin',
                isChecked: false
            });
            const result = installedPluginsReducer(initialState, action);

            expect(result['test-plugin'].disabled).to.be.true;
        });

        it('should not mutate original state on enable/disable', function() {
            const initialState = {
                'test-plugin': {
                    name: 'test-plugin',
                    disabled: false
                }
            };

            const action = installedPluginActions.setPluginEnabled({
                pluginName: 'test-plugin',
                isChecked: false
            });
            const result = installedPluginsReducer(initialState, action);

            expect(initialState['test-plugin'].disabled).to.be.false;
            expect(result).to.not.equal(initialState);
        });

        it('should preserve other plugin properties when enabling/disabling', function() {
            const initialState = {
                'test-plugin': {
                    name: 'test-plugin',
                    version: '1.0.0',
                    author: 'test',
                    disabled: false
                }
            };

            const action = installedPluginActions.setPluginEnabled({
                pluginName: 'test-plugin',
                isChecked: false
            });
            const result = installedPluginsReducer(initialState, action);

            expect(result['test-plugin'].version).to.equal('1.0.0');
            expect(result['test-plugin'].author).to.equal('test');
            expect(result['test-plugin'].name).to.equal('test-plugin');
        });
    });

    describe('Installation Flow Integration', function() {
        it('should add plugin to installed list', function() {
            const action = installedPluginActions.installedPluginUpdate({
                'allow2automate-wemo': {
                    name: 'allow2automate-wemo',
                    enabled: true
                }
            });

            store.dispatch(action);
            const actions = store.getActions();

            expect(actions).to.have.length(1);
            expect(actions[0].type).to.equal('INSTALLED_PLUGIN_UPDATE');
        });

        it('should handle multiple plugin installations', function() {
            store.dispatch(installedPluginActions.installedPluginUpdate({
                'plugin-1': { name: 'plugin-1' }
            }));

            store.dispatch(installedPluginActions.installedPluginUpdate({
                'plugin-2': { name: 'plugin-2' }
            }));

            const actions = store.getActions();
            expect(actions).to.have.length(2);
        });

        it('should remove plugin from installed list', function() {
            const action = installedPluginActions.installedPluginRemove({
                pluginName: 'allow2automate-ssh'
            });

            store.dispatch(action);
            const actions = store.getActions();

            expect(actions).to.have.length(1);
            expect(actions[0].type).to.equal('INSTALLED_PLUGIN_REMOVE');
        });
    });

    describe('Error Scenarios', function() {
        it('should handle removing non-existent plugin gracefully', function() {
            const initialState = {
                'plugin-1': { name: 'plugin-1' }
            };

            const action = installedPluginActions.installedPluginRemove({
                pluginName: 'non-existent'
            });
            const result = installedPluginsReducer(initialState, action);

            // Should return state unchanged
            expect(result).to.have.property('plugin-1');
            expect(Object.keys(result)).to.have.length(1);
        });

        it('should handle enabling non-existent plugin', function() {
            const initialState = {
                'plugin-1': { name: 'plugin-1' }
            };

            const action = installedPluginActions.setPluginEnabled({
                pluginName: 'non-existent',
                isChecked: true
            });

            // Should not throw
            expect(() => {
                installedPluginsReducer(initialState, action);
            }).to.not.throw();
        });

        it('should handle empty state', function() {
            const initialState = {};

            const action = installedPluginActions.installedPluginUpdate({
                'new-plugin': { name: 'new-plugin' }
            });
            const result = installedPluginsReducer(initialState, action);

            expect(result).to.have.property('new-plugin');
        });

        it('should handle undefined state', function() {
            const action = installedPluginActions.installedPluginUpdate({
                'new-plugin': { name: 'new-plugin' }
            });
            const result = installedPluginsReducer(undefined, action);

            expect(result).to.have.property('new-plugin');
        });
    });

    describe('State Immutability', function() {
        it('should not mutate state on INSTALLED_PLUGIN_UPDATE', function() {
            const initialState = {
                'plugin-1': { name: 'plugin-1' }
            };
            const stateCopy = JSON.parse(JSON.stringify(initialState));

            const action = installedPluginActions.installedPluginUpdate({
                'plugin-2': { name: 'plugin-2' }
            });
            installedPluginsReducer(initialState, action);

            expect(initialState).to.deep.equal(stateCopy);
        });

        it('should return new object reference', function() {
            const initialState = {
                'plugin-1': { name: 'plugin-1' }
            };

            const action = installedPluginActions.installedPluginUpdate({
                'plugin-2': { name: 'plugin-2' }
            });
            const result = installedPluginsReducer(initialState, action);

            expect(result).to.not.equal(initialState);
        });

        it('should create new plugin objects when updating', function() {
            const initialState = {
                'plugin-1': { name: 'plugin-1', disabled: false }
            };

            const action = installedPluginActions.setPluginEnabled({
                pluginName: 'plugin-1',
                isChecked: false
            });
            const result = installedPluginsReducer(initialState, action);

            expect(result['plugin-1']).to.not.equal(initialState['plugin-1']);
        });
    });

    describe('Complex Installation Scenarios', function() {
        it('should handle batch installation', function() {
            const batch = {
                'plugin-1': { name: 'plugin-1', version: '1.0.0' },
                'plugin-2': { name: 'plugin-2', version: '2.0.0' },
                'plugin-3': { name: 'plugin-3', version: '3.0.0' }
            };

            const action = installedPluginActions.installedPluginUpdate(batch);
            const result = installedPluginsReducer({}, action);

            expect(Object.keys(result)).to.have.length(3);
            expect(result).to.have.all.keys('plugin-1', 'plugin-2', 'plugin-3');
        });

        it('should merge new installations with existing', function() {
            const initialState = {
                'existing-1': { name: 'existing-1' },
                'existing-2': { name: 'existing-2' }
            };

            const newPlugins = {
                'new-1': { name: 'new-1' },
                'new-2': { name: 'new-2' }
            };

            const action = installedPluginActions.installedPluginUpdate(newPlugins);
            const result = installedPluginsReducer(initialState, action);

            expect(Object.keys(result)).to.have.length(4);
            expect(result).to.include.all.keys('existing-1', 'existing-2', 'new-1', 'new-2');
        });

        it('should handle reinstallation (update existing)', function() {
            const initialState = {
                'plugin-1': { name: 'plugin-1', version: '1.0.0' }
            };

            const update = {
                'plugin-1': { name: 'plugin-1', version: '2.0.0' }
            };

            const action = installedPluginActions.installedPluginUpdate(update);
            const result = installedPluginsReducer(initialState, action);

            expect(result['plugin-1'].version).to.equal('2.0.0');
        });

        it('should handle install then enable workflow', function() {
            let state = {};

            // Install
            const installAction = installedPluginActions.installedPluginUpdate({
                'new-plugin': { name: 'new-plugin', disabled: true }
            });
            state = installedPluginsReducer(state, installAction);

            // Enable
            const enableAction = installedPluginActions.setPluginEnabled({
                pluginName: 'new-plugin',
                isChecked: true
            });
            state = installedPluginsReducer(state, enableAction);

            expect(state['new-plugin'].disabled).to.be.false;
        });

        it('should handle install, disable, then remove workflow', function() {
            let state = {
                'test-plugin': { name: 'test-plugin', disabled: false }
            };

            // Disable
            const disableAction = installedPluginActions.setPluginEnabled({
                pluginName: 'test-plugin',
                isChecked: false
            });
            state = installedPluginsReducer(state, disableAction);
            expect(state['test-plugin'].disabled).to.be.true;

            // Remove
            const removeAction = installedPluginActions.installedPluginRemove({
                pluginName: 'test-plugin'
            });
            state = installedPluginsReducer(state, removeAction);
            expect(state).to.not.have.property('test-plugin');
        });
    });

    describe('Plugin State Validation', function() {
        it('should preserve plugin metadata during enable/disable', function() {
            const initialState = {
                'plugin-1': {
                    name: 'plugin-1',
                    version: '1.0.0',
                    author: 'Test Author',
                    description: 'Test Description',
                    disabled: false,
                    customField: 'custom value'
                }
            };

            const action = installedPluginActions.setPluginEnabled({
                pluginName: 'plugin-1',
                isChecked: false
            });
            const result = installedPluginsReducer(initialState, action);

            expect(result['plugin-1']).to.include({
                name: 'plugin-1',
                version: '1.0.0',
                author: 'Test Author',
                description: 'Test Description',
                customField: 'custom value'
            });
        });

        it('should handle plugins with minimal data', function() {
            const minimalPlugin = { name: 'minimal' };

            const action = installedPluginActions.installedPluginUpdate({
                'minimal': minimalPlugin
            });
            const result = installedPluginsReducer({}, action);

            expect(result['minimal']).to.deep.equal(minimalPlugin);
        });

        it('should handle plugins with extensive metadata', function() {
            const extensivePlugin = {
                name: 'extensive',
                version: '1.0.0',
                author: 'Author',
                description: 'Description',
                repository: 'https://github.com/test/test',
                keywords: ['key1', 'key2'],
                category: 'test',
                verified: true,
                downloads: 1000,
                rating: 4.5,
                customData: { foo: 'bar' }
            };

            const action = installedPluginActions.installedPluginUpdate({
                'extensive': extensivePlugin
            });
            const result = installedPluginsReducer({}, action);

            expect(result['extensive']).to.deep.equal(extensivePlugin);
        });
    });
});
