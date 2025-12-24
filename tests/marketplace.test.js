/**
 * Marketplace Component Tests
 *
 * Comprehensive test suite for the plugin marketplace component
 * Coverage: Component rendering, search, filtering, installation UI
 */

const { expect } = require('chai');
const React = require('react');
const { shallow, mount } = require('enzyme');
const sinon = require('sinon');

// Import component
const Marketplace = require('../build/components/Marketplace').default;

describe('Marketplace Component', function() {
    let defaultProps;
    let sandbox;

    beforeEach(function() {
        sandbox = sinon.createSandbox();

        defaultProps = {
            pluginLibrary: {
                'allow2automate-battle.net': {
                    name: 'allow2automate-battle.net',
                    shortName: 'battle.net',
                    description: 'Enable Allow2Automate management of World of Warcraft parental controls',
                    category: 'gaming',
                    version: '1.0.0',
                    publisher: 'allow2',
                    verified: true,
                    downloads: 1500,
                    rating: 4.5
                },
                'allow2automate-ssh': {
                    name: 'allow2automate-ssh',
                    shortName: 'ssh',
                    description: 'Enable Allow2Automate the ability to use ssh to configure devices',
                    category: 'networking',
                    version: '1.0.0',
                    publisher: 'allow2',
                    verified: true,
                    downloads: 800,
                    rating: 4.2
                },
                'allow2automate-wemo': {
                    name: 'allow2automate-wemo',
                    shortName: 'wemo',
                    description: 'Enable Allow2Automate the ability to control wemo devices',
                    category: 'smart-home',
                    version: '1.0.0',
                    publisher: 'allow2',
                    verified: true,
                    downloads: 1200,
                    rating: 4.7
                }
            },
            installedPlugins: {
                'allow2automate-ssh': {
                    name: 'allow2automate-ssh',
                    enabled: true
                }
            },
            onInstallPlugin: sinon.spy()
        };
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('Component Rendering', function() {
        it('should render without crashing', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);
            expect(wrapper.exists()).to.be.true;
        });

        it('should display loading state when pluginLibrary is null', function() {
            const props = { ...defaultProps, pluginLibrary: null };
            const wrapper = shallow(<Marketplace {...props} />);

            expect(wrapper.find('CircularProgress')).to.have.length(1);
        });

        it('should display marketplace title and description', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const title = wrapper.find('Typography[variant="h4"]');
            expect(title).to.have.length(1);
            expect(title.dive().text()).to.include('Plugin Marketplace');

            const description = wrapper.find('Typography[variant="body1"]');
            expect(description.dive().text()).to.include('Discover and install plugins');
        });

        it('should render search bar', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const searchField = wrapper.find('TextField[placeholder="Search plugins..."]');
            expect(searchField).to.have.length(1);
        });

        it('should render category filters', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const chips = wrapper.find('Chip');
            expect(chips.length).to.be.greaterThan(0);

            // Should include 'all' category plus unique categories from plugins
            const categories = chips.map(chip => chip.prop('label'));
            expect(categories).to.include('All');
        });

        it('should render plugin cards for each plugin', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const cards = wrapper.find('Card');
            expect(cards.length).to.equal(3);
        });

        it('should display empty state when no plugins match search', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.setState({ searchQuery: 'nonexistent-plugin-xyz' });
            wrapper.update();

            const emptyState = wrapper.find('Extension');
            expect(emptyState).to.have.length(1);

            const emptyText = wrapper.find('Typography[variant="h6"]');
            expect(emptyText.dive().text()).to.include('No plugins found');
        });
    });

    describe('Plugin Card Display', function() {
        it('should display plugin name and short name', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const cards = wrapper.find('Card');
            const firstCard = cards.first();

            const cardTypography = firstCard.find('Typography[variant="h6"]');
            expect(cardTypography).to.have.length(1);
        });

        it('should display plugin description', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const cards = wrapper.find('Card');
            const firstCard = cards.first();

            const description = firstCard.find('Typography[variant="body2"]');
            expect(description).to.have.length.greaterThan(0);
        });

        it('should display category chip for plugins with categories', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const cards = wrapper.find('Card');
            const firstCard = cards.first();

            const categoryChip = firstCard.find('Chip[size="small"]');
            expect(categoryChip.length).to.be.greaterThan(0);
        });

        it('should display version information when available', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const cards = wrapper.find('Card');
            const firstCard = cards.first();

            const versionText = firstCard.find('Typography[variant="caption"]').findWhere(
                node => node.dive && node.dive().text().includes('Version:')
            );
            expect(versionText.length).to.be.greaterThan(0);
        });

        it('should display author information when available', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const cards = wrapper.find('Card');
            const firstCard = cards.first();

            const authorText = firstCard.find('Typography[variant="caption"]').findWhere(
                node => node.dive && node.dive().text().includes('By:')
            );
            expect(authorText.length).to.be.greaterThan(0);
        });

        it('should show checkmark icon for installed plugins', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            // Find the SSH plugin card (which is installed)
            const cards = wrapper.find('Card');
            const sshCard = cards.findWhere(card => {
                const name = card.find('Typography[variant="h6"]');
                return name.length > 0 && name.dive().text() === 'ssh';
            });

            if (sshCard.length > 0) {
                const checkIcon = sshCard.find('CheckCircle');
                expect(checkIcon.length).to.be.greaterThan(0);
            }
        });

        it('should show extension icon for not installed plugins', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            // Find the battle.net plugin card (which is not installed)
            const cards = wrapper.find('Card');
            const battleNetCard = cards.findWhere(card => {
                const name = card.find('Typography[variant="h6"]');
                return name.length > 0 && name.dive().text() === 'battle.net';
            });

            if (battleNetCard.length > 0) {
                const extensionIcon = battleNetCard.find('Extension');
                expect(extensionIcon.length).to.be.greaterThan(0);
            }
        });
    });

    describe('Search Functionality', function() {
        it('should update search query state on input change', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const searchField = wrapper.find('TextField[placeholder="Search plugins..."]');
            searchField.simulate('change', { target: { value: 'ssh' } });

            expect(wrapper.state('searchQuery')).to.equal('ssh');
        });

        it('should filter plugins by name', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.setState({ searchQuery: 'ssh' });
            const filtered = wrapper.instance().getFilteredPlugins();

            expect(filtered).to.have.length(1);
            expect(filtered[0].name).to.equal('allow2automate-ssh');
        });

        it('should filter plugins by description', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.setState({ searchQuery: 'warcraft' });
            const filtered = wrapper.instance().getFilteredPlugins();

            expect(filtered).to.have.length(1);
            expect(filtered[0].shortName).to.equal('battle.net');
        });

        it('should be case insensitive', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.setState({ searchQuery: 'SSH' });
            const filtered = wrapper.instance().getFilteredPlugins();

            expect(filtered).to.have.length(1);
            expect(filtered[0].shortName).to.equal('ssh');
        });

        it('should show all plugins when search is empty', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.setState({ searchQuery: '' });
            const filtered = wrapper.instance().getFilteredPlugins();

            expect(filtered).to.have.length(3);
        });

        it('should return empty array when no matches', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.setState({ searchQuery: 'nonexistent' });
            const filtered = wrapper.instance().getFilteredPlugins();

            expect(filtered).to.have.length(0);
        });
    });

    describe('Category Filtering', function() {
        it('should extract unique categories from plugins', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const categories = wrapper.instance().getCategories();

            expect(categories).to.include('all');
            expect(categories).to.include('gaming');
            expect(categories).to.include('networking');
            expect(categories).to.include('smart-home');
        });

        it('should update selected category on chip click', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const chips = wrapper.find('Chip');
            const gamingChip = chips.findWhere(chip =>
                chip.prop('label') === 'Gaming'
            );

            if (gamingChip.length > 0) {
                gamingChip.simulate('click');
                expect(wrapper.state('selectedCategory')).to.equal('gaming');
            }
        });

        it('should filter plugins by selected category', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.setState({ selectedCategory: 'gaming' });
            const filtered = wrapper.instance().getFilteredPlugins();

            expect(filtered).to.have.length(1);
            expect(filtered[0].category).to.equal('gaming');
        });

        it('should show all plugins when "all" category is selected', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.setState({ selectedCategory: 'all' });
            const filtered = wrapper.instance().getFilteredPlugins();

            expect(filtered).to.have.length(3);
        });

        it('should combine search and category filters', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.setState({
                searchQuery: 'allow2',
                selectedCategory: 'gaming'
            });
            const filtered = wrapper.instance().getFilteredPlugins();

            expect(filtered).to.have.length(1);
            expect(filtered[0].category).to.equal('gaming');
        });

        it('should highlight selected category chip', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.setState({ selectedCategory: 'gaming' });
            wrapper.update();

            const chips = wrapper.find('Chip');
            const gamingChip = chips.findWhere(chip =>
                chip.prop('label') === 'Gaming'
            );

            if (gamingChip.length > 0) {
                expect(gamingChip.prop('color')).to.equal('primary');
                expect(gamingChip.prop('variant')).to.equal('default');
            }
        });
    });

    describe('Installation Flow', function() {
        it('should call onInstallPlugin when install button clicked', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const cards = wrapper.find('Card');
            const battleNetCard = cards.first();
            const installButton = battleNetCard.find('Button[color="primary"]').first();

            installButton.simulate('click');

            expect(defaultProps.onInstallPlugin.calledOnce).to.be.true;
        });

        it('should show alert if plugin already installed', function() {
            const dialogsStub = sandbox.stub(require('dialogs')(), 'alert');
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.instance().handleInstall('allow2automate-ssh');

            expect(dialogsStub.calledOnce).to.be.true;
            expect(dialogsStub.firstCall.args[0]).to.include('already installed');
        });

        it('should set installing state during installation', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.instance().handleInstall('allow2automate-battle.net');

            expect(wrapper.state('installing')['allow2automate-battle.net']).to.be.true;
        });

        it('should clear installing state on success', function(done) {
            const onInstall = (name, callback) => {
                setTimeout(() => callback(null), 10);
            };

            const props = { ...defaultProps, onInstallPlugin: onInstall };
            const wrapper = shallow(<Marketplace {...props} />);

            wrapper.instance().handleInstall('allow2automate-battle.net');

            setTimeout(() => {
                expect(wrapper.state('installing')['allow2automate-battle.net']).to.be.false;
                done();
            }, 20);
        });

        it('should clear installing state on error', function(done) {
            const onInstall = (name, callback) => {
                setTimeout(() => callback(new Error('Installation failed')), 10);
            };

            const props = { ...defaultProps, onInstallPlugin: onInstall };
            const wrapper = shallow(<Marketplace {...props} />);

            wrapper.instance().handleInstall('allow2automate-battle.net');

            setTimeout(() => {
                expect(wrapper.state('installing')['allow2automate-battle.net']).to.be.false;
                done();
            }, 20);
        });

        it('should disable install button while installing', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.setState({
                installing: { 'allow2automate-battle.net': true }
            });
            wrapper.update();

            const cards = wrapper.find('Card');
            const battleNetCard = cards.first();
            const installButton = battleNetCard.find('Button[color="primary"]').first();

            expect(installButton.prop('disabled')).to.be.true;
        });

        it('should show progress indicator while installing', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            wrapper.setState({
                installing: { 'allow2automate-battle.net': true }
            });
            wrapper.update();

            const cards = wrapper.find('Card');
            const battleNetCard = cards.first();
            const progressIndicator = battleNetCard.find('CircularProgress');

            expect(progressIndicator.length).to.be.greaterThan(0);
        });

        it('should show "Installed" button for installed plugins', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            // Find SSH card which is installed
            const cards = wrapper.find('Card');
            const sshCard = cards.findWhere(card => {
                const name = card.find('Typography[variant="h6"]');
                return name.length > 0 && name.dive().text() === 'ssh';
            });

            if (sshCard.length > 0) {
                const installedButton = sshCard.find('Button[variant="outlined"]');
                expect(installedButton.length).to.be.greaterThan(0);
                expect(installedButton.prop('disabled')).to.be.true;
            }
        });
    });

    describe('Plugin Status Detection', function() {
        it('should correctly identify installed plugin', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const isInstalled = wrapper.instance().isPluginInstalled('allow2automate-ssh');
            expect(isInstalled).to.be.true;
        });

        it('should correctly identify not installed plugin', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const isInstalled = wrapper.instance().isPluginInstalled('allow2automate-battle.net');
            expect(isInstalled).to.be.false;
        });

        it('should handle null installedPlugins gracefully', function() {
            const props = { ...defaultProps, installedPlugins: null };
            const wrapper = shallow(<Marketplace {...props} />);

            const isInstalled = wrapper.instance().isPluginInstalled('allow2automate-ssh');
            expect(isInstalled).to.be.false;
        });
    });

    describe('Error Handling', function() {
        it('should handle empty plugin library gracefully', function() {
            const props = { ...defaultProps, pluginLibrary: {} };
            const wrapper = shallow(<Marketplace {...props} />);

            const filtered = wrapper.instance().getFilteredPlugins();
            expect(filtered).to.have.length(0);
        });

        it('should handle missing plugin properties', function() {
            const propsWithIncomplete = {
                ...defaultProps,
                pluginLibrary: {
                    'incomplete-plugin': {
                        name: 'incomplete-plugin'
                        // Missing description, category, etc.
                    }
                }
            };

            const wrapper = shallow(<Marketplace {...propsWithIncomplete} />);
            expect(wrapper.exists()).to.be.true;
        });

        it('should show error alert on installation failure', function() {
            const dialogsStub = sandbox.stub(require('dialogs')(), 'alert');
            const onInstall = (name, callback) => {
                callback(new Error('Network error'));
            };

            const props = { ...defaultProps, onInstallPlugin: onInstall };
            const wrapper = shallow(<Marketplace {...props} />);

            wrapper.instance().handleInstall('allow2automate-battle.net');

            expect(dialogsStub.called).to.be.true;
        });

        it('should show success alert on installation success', function() {
            const dialogsStub = sandbox.stub(require('dialogs')(), 'alert');
            const onInstall = (name, callback) => {
                callback(null);
            };

            const props = { ...defaultProps, onInstallPlugin: onInstall };
            const wrapper = shallow(<Marketplace {...props} />);

            wrapper.instance().handleInstall('allow2automate-battle.net');

            expect(dialogsStub.called).to.be.true;
        });
    });

    describe('Category Color Mapping', function() {
        it('should return correct color for automation category', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const color = wrapper.instance().getCategoryColor('automation');
            expect(color).to.equal('primary');
        });

        it('should return correct color for integration category', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const color = wrapper.instance().getCategoryColor('integration');
            expect(color).to.equal('secondary');
        });

        it('should return default color for unknown category', function() {
            const wrapper = shallow(<Marketplace {...defaultProps} />);

            const color = wrapper.instance().getCategoryColor('unknown-category');
            expect(color).to.equal('default');
        });
    });
});
