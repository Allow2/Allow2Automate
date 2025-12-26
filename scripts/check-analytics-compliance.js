#!/usr/bin/env node

/**
 * Analytics Compliance Checker
 *
 * Validates that all React component files importing Analytics are properly configured.
 * This pre-commit hook ensures analytics integration follows best practices.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get list of staged .js files in app/components
let stagedFiles;
try {
  stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
    .split('\n')
    .filter(file => file.startsWith('app/components/') && file.endsWith('.js'));
} catch (error) {
  console.error('Failed to get staged files:', error.message);
  process.exit(1);
}

if (stagedFiles.length === 0) {
  process.exit(0); // No component files to check
}

console.log('🔍 Running Analytics compliance check...');

let hasErrors = false;

function checkFileForAnalytics(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Special case: Plugin.js injects analytics via props, doesn't need direct import
    if (filePath.includes('Plugin.js')) {
      return { valid: true, reason: 'Plugin.js uses analytics injection pattern' };
    }

    // Check if file has Analytics import
    const hasAnalyticsImport = /import\s+Analytics\s+from\s+['"]\.\.\/analytics['"]/.test(content);

    if (!hasAnalyticsImport) {
      return { valid: true, reason: 'No Analytics import needed' };
    }

    // If Analytics is imported, check for proper usage patterns
    const hasComponentDidMount = /componentDidMount/.test(content);
    const hasTrackingCall = /Analytics\.track/.test(content);

    if (!hasTrackingCall) {
      return {
        valid: false,
        reason: 'Analytics imported but no tracking calls found',
        fix: 'Add Analytics.trackScreenView() or other tracking methods'
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      reason: `Failed to read file: ${error.message}`
    };
  }
}

// Check each staged file
stagedFiles.forEach(file => {
  if (!file) return;

  const result = checkFileForAnalytics(file);

  if (!result.valid) {
    hasErrors = true;
    console.error(`\n✗ ${file}`);
    console.error(`  ${result.reason}`);
    if (result.fix) {
      console.error(`  Fix: ${result.fix}`);
    }
  } else if (result.reason) {
    console.log(`✓ ${file} - ${result.reason}`);
  }
});

if (hasErrors) {
  console.error('\n❌ Analytics compliance check failed');
  console.error('Please fix the issues above before committing.\n');
  process.exit(1);
}

console.log('✅ Analytics compliance check passed\n');
process.exit(0);
