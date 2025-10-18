// ESLint Flat Config for Weaver
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const stylisticTs = require('@stylistic/eslint-plugin-ts');
const stylisticJs = require('@stylistic/eslint-plugin-js');

module.exports = tseslint.config(
  {
    ignores: ['**/generated/*','dist/**', '**/migrations/**']
  },
  {
    files: ['**/*.ts'],
    plugins: {
      '@stylistic/ts': stylisticTs,
      '@stylistic/js': stylisticJs
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
      ...tseslint.configs.strict
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
      '@angular-eslint/component-class-suffix': [ 'error', { suffixes: ['Component','Page','Stub'] } ],
      '@angular-eslint/directive-class-suffix': 'error',
      '@typescript-eslint/explicit-module-boundry-types': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/explicit-member-accessibility': ['error',{ accessibility: 'no-public' }],
      '@typescript-eslint/array-type': ['error',{ default: 'array' }],
      '@typescript-eslint/consistent-type-definitions': 'error',
      '@typescript-eslint/dot-notation': 'off',
      '@stylistic/ts/indent': ['error',2,{ ignoredNodes:[
        'TSTypeParameterInstantation',
        'FunctionExpression > .params[decorators.length > 0]',
        'FunctionExpression > .params > :matches(Decorator, :not(:first-child))',
  'ClassBody.body > PropertyDefinition[decorators.length > 0] > .key'
      ], SwitchCase:1 }],
      '@stylistic/ts/member-delimiter-style': ['error',{ multiline:{ delimiter:'semi', requireLast:true }, singleline:{ delimiter:'semi', requireLast:false } }],
      '@typescript-eslint/member-ordering': ['error',{ default:[
        'signature','call-signature',
        'public-static-field','protected-static-field','private-static-field','#private-static-field',
        'public-decorated-field','protected-decorated-field','private-decorated-field',
        'public-instance-field','protected-instance-field','private-instance-field','#private-instance-field',
        'public-abstract-field','protected-abstract-field',
        'public-field','protected-field','private-field','#private-field',
        'static-field','instance-field','abstract-field','decorated-field','field','static-initialization',
        'public-constructor','protected-constructor','private-constructor','constructor',
        'public-static-method','protected-static-method','private-static-method','#private-static-method',
        'public-decorated-method','protected-decorated-method','private-decorated-method',
        'public-instance-method','protected-instance-method','private-instance-method','#private-instance-method',
        'public-abstract-method','protected-abstract-method','public-method','protected-method','private-method','#private-method',
        'static-method','instance-method','abstract-method','decorated-method','method'
      ] }],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-invalid-this': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-unused-vars': ['error',{ argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-function-type': 'error',
      '@stylistic/ts/quotes': ['error','single',{ avoidEscape:true }],
      '@stylistic/ts/semi': ['error','always'],
      '@stylistic/ts/type-annotation-spacing': 'error',
      '@typescript-eslint/unified-signatures': 'error',
      '@stylistic/js/array-bracket-spacing': 'error',
      '@stylistic/ts/comma-dangle': ['error','never'],
      '@stylistic/ts/comma-spacing': 'error',
      '@stylistic/js/comma-style': 'error',
      'complexity': ['warn',{ max:20 }],
      'curly': 'off',
      'eol-last': 'error',
      'id-denylist': ['warn','e','cb','i','x','c','y','any','string','String','Undefined','undefined','callback'],
      'max-len': ['error',{ code:150, ignoreComments:true }],
      'new-parens': 'error',
      'newline-per-chained-call': 'error',
      'no-bitwise': 'off',
      'no-cond-assign': 'error',
      'no-empty': 'off',
      'no-eval': 'error',
      '@stylistic/js/no-multi-spaces': 'error',
      '@stylistic/js/no-multiple-empty-lines': ['error',{ max:1, maxEOF:1 }],
      'no-new-wrappers': 'error',
      'no-restricted-imports': ['error','rxjs/Rx'],
      'no-throw-literal': 'error',
      'no-trailing-spaces': 'error',
      'no-undef-init': 'error',
      'no-unsafe-finally': 'error',
      'no-var': 'error',
      'one-var': ['error','never'],
      'prefer-const': 'error',
      '@stylistic/ts/space-before-blocks': 'error',
      '@stylistic/js/space-before-function-paren': ['error',{ anonymous:'never', asyncArrow:'always', named:'never' }],
      '@stylistic/ts/space-infix-ops': 'error',
      '@stylistic/js/space-in-parens': 'error',
      '@stylistic/js/space-unary-ops': 'error',
      '@stylistic/js/spaced-comment': ['error','always',{ markers:['/'] }]
    }
  },
);
