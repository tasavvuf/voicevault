const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  globalIgnores(['server/**', 'design-system/**', 'docs/**', 'node_modules/**', 'src/hooks/use-color-scheme.web.ts']),
  expoConfig,
]);
