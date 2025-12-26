#!/usr/bin/env node

/**
 * Analytics Compliance Checker
 *
 * This script checks all modified component files for Analytics compliance
 * before allowing commits. It's designed to be used as a pre-commit hook.
 *
 * Usage:
 *   node scripts/check-analytics-compliance.js          # Check staged files only
 *   node scripts/check-analytics-compliance.js --all    # Check all component files
 *   node scripts/check-analytics-compliance.js --strict # Fail on warnings
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileForAnalytics(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Special case: Plugin.js injects analytics via props, doesn't need direct import
    if (filePath.includes('Plugin.js')) {
      return { valid: true, reason: 'Plugin.js uses analytics injection pattern' };
    }

    // Check for React Component
    const isReactComponent = /class\s+\w+\s+extends\s+(React\.)?Component/.test(content) ||
                            /export\s+default\s+class\s+\w+\s+extends\s+(React\.)?Component/.test(content);

    if (!isReactComponent) {
      return { valid: true, reason: 'Not a React component' };
    }

    // Check for Analytics import
    const hasAnalyticsImport = /import\s+.*Analytics.*from\s+['"].*analytics.*['"]/.test(content) ||
                               /import\s+Analytics\s+from/.test(content);

    if (!hasAnalyticsImport) {
      return {
        valid: false,
        reason: 'Missing Analytics import',
        fix: 'Add: import Analytics from \'../analytics\';'
      };
    }

    // Check for Analytics usage
    const hasAnalyticsUsage = /Analytics\.(track|set|initialize|aggregate|clear)/.test(content);

    if (!hasAnalyticsUsage) {
      return {
        valid: false,
        reason: 'Analytics imported but not used',
        fix: 'Add Analytics tracking in componentDidMount or relevant lifecycle methods'
      };
    }

    return { valid: true, reason: 'All checks passed' };
  } catch (error) {
    return { valid: false, reason: `Error reading file: ${error.message}` };
  }
}

function main() {
  const args = process.argv.slice(2);
  const checkAll = args.includes('--all');
  const strict = args.includes('--strict');

  log('\n🔍 Checking Analytics Compliance...', 'cyan');

  try {
    let componentFiles = [];

    if (checkAll) {
      // Check all component files
      log('Mode: Checking all component files', 'blue');
      const componentsPattern = 'app/components/**/*.{js,jsx}';
      const containersPattern = 'app/containers/**/*.{js,jsx}';

      componentFiles = [
        ...glob.sync(componentsPattern, { cwd: process.cwd() }),
        ...glob.sync(containersPattern, { cwd: process.cwd() })
      ].filter(file => !file.includes('.test.') && !file.includes('.spec.'));
    } else {
      // Get staged files
      log('Mode: Checking staged files only', 'blue');
      const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean);

      // Filter for component/container files
      componentFiles = stagedFiles.filter(file =>
        (file.includes('app/components/') || file.includes('app/containers/')) &&
        (file.endsWith('.js') || file.endsWith('.jsx')) &&
        !file.includes('.test.') &&
        !file.includes('.spec.')
      );
    }

    if (componentFiles.length === 0) {
      log('✓ No component files to check', 'green');
      process.exit(0);
    }

    log(`\nFound ${componentFiles.length} component file(s) to check:\n`, 'blue');

    let hasErrors = false;
    const results = [];

    for (const file of componentFiles) {
      const fullPath = path.join(process.cwd(), file);

      if (!fs.existsSync(fullPath)) {
        continue;
      }

      const result = checkFileForAnalytics(fullPath);
      results.push({ file, ...result });

      if (result.valid) {
        log(`  ✓ ${file}`, 'green');
      } else {
        hasErrors = true;
        log(`  ✗ ${file}`, 'red');
        log(`    ${result.reason}`, 'yellow');
        if (result.fix) {
          log(`    Fix: ${result.fix}`, 'cyan');
        }
      }
    }

    if (hasErrors) {
      log('\n❌ Analytics compliance check failed!', 'red');
      log('\nPlease ensure all components:', 'yellow');
      log('  1. Import the Analytics module', 'yellow');
      log('  2. Track relevant user actions', 'yellow');
      log('  3. Follow the analytics documentation\n', 'yellow');
      log('📚 See: docs/analytics-integration-guide.md\n', 'cyan');
      process.exit(1);
    } else {
      log('\n✅ All component files comply with Analytics requirements!\n', 'green');
      process.exit(0);
    }
  } catch (error) {
    log(`\n❌ Error during compliance check: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
