/**
 * Test Setup Configuration
 *
 * Configures Enzyme adapter for React 16 and global test utilities
 */

const { configure } = require('enzyme');
const Adapter = require('enzyme-adapter-react-16');

// Configure Enzyme with React 16 adapter
configure({ adapter: new Adapter() });

// Global test helpers can be added here
global.expect = require('chai').expect;
