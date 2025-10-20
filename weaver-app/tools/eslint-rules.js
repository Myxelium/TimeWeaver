// Custom ESLint rules for Angular template formatting
// This enforces the specific formatting style for Angular templates

module.exports = {
  rules: {
    'angular-template-spacing': {
      meta: {
        type: 'layout',
        docs: {
          description: 'Enforce spacing between elements and property grouping in Angular templates',
          category: 'Stylistic Issues',
          recommended: true,
        },
        fixable: 'whitespace',
        schema: [],
      },
      create(context) {
        // This is a placeholder for custom rule implementation
        // ESLint's template rules are limited, so manual formatting is recommended
        return {};
      },
    },
  },
};
