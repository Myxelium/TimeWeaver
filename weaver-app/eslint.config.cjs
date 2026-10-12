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
      'junolint/angular-file-naming': ['warn', {
        suffixes: [
          'component',
          'page',
          'service',
          'directive',
          'pipe',
          'guard',
          'interceptor',
          'resolver',
          'routes',
          'config',
          'module',
          'actions',
          'reducer',
          'effects',
          'selectors',
          'state',
          'model'
        ],
        testSuffixes: ['spec', 'test']
      }],
      'junolint/prefer-sentence-names': ['off', { minLength: 0, exceptions: ['timestamp', 'store', '_store', 'state', 'api'] }],
      'junolint/prefer-sentence-function-names': ['warn', { minLength: 0, exceptions: ['store', 'state', 'api'] }],
      'junolint/decompose-complex-expressions': ['warn', { threshold: 5 }]
    }
  }
];
