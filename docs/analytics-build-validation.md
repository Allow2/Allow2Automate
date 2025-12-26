# Analytics Build-Time Validation System

## Overview

This document describes the build-time validation system that enforces Firebase Analytics integration across all React components in the Allow2Automate application.

## Components

### 1. Custom ESLint Plugin

**Location:** `/mnt/ai/automate/automate/scripts/eslint-plugin-analytics/index.js`

Custom ESLint plugin with two rules:
- `require-analytics-import`: Ensures Analytics module is imported in React components
- `analytics-lifecycle-tracking`: Verifies Analytics usage in lifecycle methods

**Scope:** Only checks files in `app/components/` and `app/containers/` directories

### 2. Compliance Checker Script

**Location:** `/mnt/ai/automate/automate/scripts/check-analytics-compliance.js`

Standalone Node.js script that validates Analytics compliance.

**Usage:**
```bash
# Check staged files only (pre-commit hook)
node scripts/check-analytics-compliance.js

# Check all component files
npm run lint:analytics

# Strict mode (errors instead of warnings)
npm run lint:analytics:strict
```

**Validation Rules:**
1. Detects React Components (classes extending React.Component)
2. Checks for Analytics import statement
3. Verifies Analytics methods are actually called
4. Provides helpful fix suggestions

### 3. Git Pre-Commit Hook

**Location:** `/mnt/ai/automate/automate/.husky/pre-commit`

Automatically runs before each commit to validate that new/modified components include Analytics tracking.

**Features:**
- Only checks staged files
- Provides clear error messages
- Suggests fixes for non-compliant code
- Can be bypassed with `git commit --no-verify` (not recommended)

### 4. NPM Scripts

Added to `package.json`:

```json
{
  "scripts": {
    "lint:analytics": "node scripts/check-analytics-compliance.js --all",
    "lint:analytics:strict": "node scripts/check-analytics-compliance.js --all --strict",
    "prepack": "npm run lint:analytics:strict"
  }
}
```

**Integration:**
- `npm test` - Now includes analytics validation
- `npm run pack` - Runs strict validation before building
- CI/CD pipeline runs validation on every push/PR

### 5. GitHub Actions Workflow

**Location:** `/mnt/ai/automate/automate/.github/workflows/analytics-validation.yml`

**Triggers:**
- Push to master, develop, upgrade branches
- Pull requests to master, develop
- Only when component/container files are modified

**Features:**
- Multi-version Node.js testing (16.x, 18.x)
- Generates compliance reports
- Comments on PRs with failures
- Security scanning for Analytics imports
- Artifact upload for compliance reports

## Validation Criteria

A component passes validation if it meets ALL of these criteria:

1. **Import Check:** Contains Analytics import
   ```javascript
   import Analytics from '../analytics';
   ```

2. **Usage Check:** Actually uses Analytics methods
   ```javascript
   Analytics.trackEvent(...)
   Analytics.trackNavigation(...)
   Analytics.trackUserAction(...)
   // etc.
   ```

3. **Lifecycle Integration:** Typically used in:
   - `componentDidMount()` for component views
   - `componentDidUpdate()` for state changes
   - Event handlers for user actions

## Current Compliance Status

As of last check, the following components need Analytics integration:

**Non-Compliant (7 files):**
- `/mnt/ai/automate/automate/app/components/AddPlugin.js`
- `/mnt/ai/automate/automate/app/components/Checkbox.js`
- `/mnt/ai/automate/automate/app/components/LoggedIn.js`
- `/mnt/ai/automate/automate/app/components/Login.js`
- `/mnt/ai/automate/automate/app/components/Marketplace.js`
- `/mnt/ai/automate/automate/app/components/Pair.js`
- `/mnt/ai/automate/automate/app/components/Plugin.js`

**Compliant (7 files):**
- All container files in `/mnt/ai/automate/automate/app/containers/`

## How to Fix Non-Compliant Components

1. **Add Analytics import:**
   ```javascript
   import Analytics from '../analytics';
   ```

2. **Track component view in componentDidMount:**
   ```javascript
   componentDidMount() {
     Analytics.trackNavigation('previous-screen', 'ComponentName');
     // or
     Analytics.trackEvent('component_view', {
       component_name: 'ComponentName'
     });
   }
   ```

3. **Track user interactions:**
   ```javascript
   handleButtonClick = () => {
     Analytics.trackUserAction('button_click', {
       button_name: 'Submit',
       context: 'ComponentName'
     });
     // ... rest of handler
   }
   ```

## Running Validation

### Local Development

```bash
# Check all components
npm run lint:analytics

# Check staged files before commit
git commit -m "message"  # Automatically runs pre-commit hook

# Bypass validation (NOT recommended)
git commit --no-verify -m "message"
```

### CI/CD Pipeline

Validation automatically runs on:
- Every push to master, develop, upgrade branches
- Every pull request
- Before production builds

### Manual Testing

```bash
# Test the compliance checker directly
node scripts/check-analytics-compliance.js --all

# Test with strict mode
node scripts/check-analytics-compliance.js --all --strict

# Check specific file
node scripts/check-analytics-compliance.js app/components/Login.js
```

## Error Messages

### Missing Import
```
✗ app/components/Login.js
  Missing Analytics import
  Fix: Add: import Analytics from '../analytics';
```

### Missing Usage
```
✗ app/components/Marketplace.js
  Analytics imported but not used
  Fix: Add Analytics tracking in componentDidMount or relevant lifecycle methods
```

## Integration with Build Process

1. **Development:** Pre-commit hook provides immediate feedback
2. **Testing:** `npm test` includes analytics validation
3. **Building:** `npm run pack` requires strict compliance
4. **CI/CD:** GitHub Actions validates on every push/PR
5. **Production:** Builds fail if components lack Analytics

## Bypassing Validation

**⚠️ Not Recommended**

Only bypass validation when:
- Working on non-user-facing components
- Creating stub/placeholder components
- Emergency hotfixes (must be fixed in follow-up PR)

```bash
# Bypass pre-commit hook
git commit --no-verify -m "message"

# Bypass in CI (not possible - intentionally)
```

## Maintenance

### Adding New Validation Rules

Edit `/mnt/ai/automate/automate/scripts/eslint-plugin-analytics/index.js` or `/mnt/ai/automate/automate/scripts/check-analytics-compliance.js`

### Updating Compliance Checker

The checker is a standalone script with no external dependencies (uses only Node.js built-ins + glob).

### Modifying CI Pipeline

Edit `/mnt/ai/automate/automate/.github/workflows/analytics-validation.yml`

## Troubleshooting

### Pre-commit hook not running

```bash
# Reinstall Husky hooks
npm run prepare
# or
npx husky install
```

### False positives

If a component legitimately doesn't need Analytics:
1. Add a comment explaining why
2. Document in this file
3. Consider refactoring to not extend React.Component

### CI failures

Check the compliance report artifact in GitHub Actions for detailed information.

## Related Documentation

- [Analytics Integration Guide](/mnt/ai/automate/automate/docs/analytics-integration-guide.md)
- [Analytics API Reference](/mnt/ai/automate/automate/app/analytics/index.js)
- [Plugin Compliance Guide](/mnt/ai/automate/automate/docs/plugin-compliance-quick-reference.md)

## Support

For questions or issues with the validation system:
1. Check this documentation
2. Review example compliant components in `/mnt/ai/automate/automate/app/containers/`
3. Consult the Analytics Integration Guide
4. Review the compliance checker source code for exact validation logic
