module.exports = [
  ...require('junolint'),
  {
    files: ['**/*.ts'],
    rules: {
      'junolint/prefer-sentence-names': ['warn', { minLength: 0 }],
      'junolint/prefer-sentence-function-names': ['warn', { minLength: 0 }],
      'junolint/decompose-complex-expressions': ['warn', { threshold: 5 }]
    }
  }
];
