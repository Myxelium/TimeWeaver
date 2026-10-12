module.exports = [
  ...require('junolint'),
  {
    files: ['**/*.{ts,html}', 'src/**/*.{js,mjs,cjs,css,scss,sass,less}'],
    rules: {
      'junolint/bare-src-file-naming': ['error', { allowedNames: ['index', 'main.ts', 'styles.css'] }]
    }
  },
  {
    files: ['**/*.ts'],
    rules: {
      'junolint/prefer-sentence-names': ['warn', { minLength: 0, exceptions: ['timestamp'] }],
      'junolint/prefer-sentence-function-names': ['warn', { minLength: 0 }],
      'junolint/decompose-complex-expressions': ['warn', { threshold: 5 }]
    }
  }
];
