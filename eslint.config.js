// ESLint flat config (eslint-config-expo) plus the platform-boundary rules from
// FND-PLT-01: only adapter files may import a Firebase SDK or branch on platform.
// The standalone guardrail script scripts/check-boundaries.mjs enforces the same
// rules in CI even when ESLint is not run.
const expoConfig = require('eslint-config-expo/flat.js');

const ADAPTER_GLOBS = ['src/**/*.native.ts', 'src/**/*.native.tsx', 'src/**/*.web.ts', 'src/**/*.web.tsx', 'src/data/firebase.ts'];

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/**', 'web-build/**', 'firebase/**', 'coverage/**', '.expo/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@react-native-firebase', '@react-native-firebase/*'],
              message: 'Native Firebase modules may only be imported inside adapter files (*.native.ts).',
            },
            {
              group: ['firebase', 'firebase/*'],
              message: 'The Firebase JS SDK may only be imported inside adapter files (firebase.web.ts / firebase.ts).',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Platform'][property.name='OS']",
          message: 'Platform branching lives only in adapter files (*.native.ts / *.web.ts). Cosmetic layout checks may live in src/ui.',
        },
        {
          selector: "CallExpression[callee.object.name='Platform'][callee.property.name='select']",
          message: 'Platform branching lives only in adapter files (*.native.ts / *.web.ts). Cosmetic layout checks may live in src/ui.',
        },
      ],
    },
  },
  {
    files: [...ADAPTER_GLOBS, 'src/ui/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
    },
  },
];
