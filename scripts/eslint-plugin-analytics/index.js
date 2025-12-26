/**
 * ESLint Plugin for Analytics Enforcement
 *
 * This plugin ensures all React components in the components/ and containers/
 * directories properly import and use the Analytics module.
 */

module.exports = {
  rules: {
    'require-analytics-import': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce Analytics import in React components',
          category: 'Best Practices',
          recommended: true
        },
        messages: {
          missingImport: 'Analytics module must be imported in component files',
          missingUsage: 'Analytics must be used in componentDidMount or useEffect for tracking'
        },
        schema: []
      },
      create(context) {
        const filename = context.getFilename();

        // Only check files in components/ and containers/ directories
        if (!filename.includes('/components/') && !filename.includes('/containers/')) {
          return {};
        }

        // Skip test files
        if (filename.includes('.test.') || filename.includes('.spec.')) {
          return {};
        }

        let hasAnalyticsImport = false;
        let hasReactComponent = false;
        let hasAnalyticsUsage = false;

        return {
          ImportDeclaration(node) {
            // Check for Analytics import
            if (node.source.value.includes('analytics')) {
              hasAnalyticsImport = true;
            }
          },

          ClassDeclaration(node) {
            // Check if it's a React component
            if (node.superClass &&
                (node.superClass.name === 'Component' ||
                 (node.superClass.object && node.superClass.object.name === 'React'))) {
              hasReactComponent = true;
            }
          },

          MemberExpression(node) {
            // Check for Analytics usage (Analytics.track*, Analytics.setUserId, etc.)
            if (node.object && node.object.name === 'Analytics') {
              hasAnalyticsUsage = true;
            }
          },

          'Program:exit'() {
            if (hasReactComponent && !hasAnalyticsImport) {
              context.report({
                loc: { line: 1, column: 0 },
                messageId: 'missingImport'
              });
            }

            if (hasReactComponent && hasAnalyticsImport && !hasAnalyticsUsage) {
              context.report({
                loc: { line: 1, column: 0 },
                messageId: 'missingUsage'
              });
            }
          }
        };
      }
    },

    'analytics-lifecycle-tracking': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Ensure analytics tracking in component lifecycle methods',
          category: 'Best Practices',
          recommended: true
        },
        messages: {
          missingLifecycleTracking: 'Component should track view/navigation in componentDidMount or useEffect'
        },
        schema: []
      },
      create(context) {
        const filename = context.getFilename();

        // Only check files in components/ and containers/
        if (!filename.includes('/components/') && !filename.includes('/containers/')) {
          return {};
        }

        let hasAnalyticsImport = false;
        let hasComponentDidMount = false;
        let hasAnalyticsInLifecycle = false;

        return {
          ImportDeclaration(node) {
            if (node.source.value.includes('analytics')) {
              hasAnalyticsImport = true;
            }
          },

          MethodDefinition(node) {
            if (node.key.name === 'componentDidMount') {
              hasComponentDidMount = true;

              // Check if Analytics is called within componentDidMount
              const body = node.value.body.body;
              if (body) {
                for (const statement of body) {
                  if (JSON.stringify(statement).includes('Analytics')) {
                    hasAnalyticsInLifecycle = true;
                  }
                }
              }
            }
          },

          'Program:exit'() {
            if (hasAnalyticsImport && hasComponentDidMount && !hasAnalyticsInLifecycle) {
              context.report({
                loc: { line: 1, column: 0 },
                messageId: 'missingLifecycleTracking'
              });
            }
          }
        };
      }
    }
  }
};
