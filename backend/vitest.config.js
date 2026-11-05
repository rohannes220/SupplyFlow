import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      allowExternal: true,
      include: [
        '../shared/**',
        'services/**',
        'utils/**',
        'controllers/**',
        'routes/**',
        'middleware/**',
      ],
      thresholds: { 'services/**': { lines: 80, functions: 80, branches: 80, statements: 80 } },
    },
  },
});
