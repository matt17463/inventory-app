import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

const sharedRules = {
  ...js.configs.recommended.rules,
  'no-unused-vars': ['warn', {
    argsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
    varsIgnorePattern: '^React$',
  }],
  'no-useless-assignment': 'off',
  'preserve-caught-error': 'off',
  'no-empty': ['warn', { allowEmptyCatch: true }],
  'no-useless-escape': 'warn',
}

const reactRules = {
  ...reactHooks.configs.recommended.rules,

  // These newer React Compiler-oriented rules flag the application's
  // established async loading effects even though they are valid runtime code.
  // Keep the core Rules of Hooks enabled, but do not make these migration/style
  // rules block a production build.
  'react-hooks/set-state-in-effect': 'off',
  'react-hooks/purity': 'off',
  'react-hooks/exhaustive-deps': 'warn',

  'react-refresh/only-export-components': [
    'warn',
    { allowConstantExport: true },
  ],
}

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'docs/legacy-code/**',
      'supabase/**',
    ],
  },

  // Browser application files.
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...sharedRules,
      ...reactRules,
    },
  },

  // Netlify functions, validation scripts, and configuration run under Node.
  {
    files: [
      'netlify/functions/**/*.js',
      'scripts/**/*.{js,mjs}',
      '*.config.js',
      'vite.config.js',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      ...sharedRules,
    },
  },
]
