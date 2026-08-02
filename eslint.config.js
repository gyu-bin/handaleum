const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Build/tooling scripts run in Node, not in the Expo runtime.
    files: ['scripts/**'],
    languageOptions: {
      globals: { __dirname: 'readonly', process: 'readonly' },
    },
  },
]);
