import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Vitest owns the unit + integration suites under test/.
    // Playwright owns the browser E2E under e2e/ — keep them apart.
    include: ['test/**/*.test.js'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json-summary'],
      // Measure the source we actually ship; ignore the process bootstrap and
      // the optional Mongo/Redis drivers (exercised only against real services).
      include: ['src/**/*.js'],
      exclude: ['src/index.js'],
    },
  },
});
