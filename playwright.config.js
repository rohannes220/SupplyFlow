// Playwright end-to-end tests (e2e/). Run with `pnpm test:e2e`.
//
// The suite never touches a real database. Playwright starts its own API in in-memory mode
// (DATABASE_URL forced empty, and IN_MEMORY_DEMO_USERS refuses to start if one is set) plus a
// Vite dev server proxied to it. Both use their own ports and are never reused, so a running
// development server (which may be connected to PostgreSQL) is never used by the tests.
import { defineConfig, devices } from '@playwright/test';
import { E2E_ADMIN, E2E_EMPLOYEE } from './e2e/accounts.js';

const API_PORT = 4100;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: 'e2e',
  // One worker, files in order: every test shares the API's in-memory data.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node backend/server.js',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL: '',
        JWT_SECRET: 'e2e-only-jwt-secret-not-used-anywhere-else',
        IN_MEMORY_DEMO_USERS: 'true',
        DEMO_ADMIN_PASSWORD: E2E_ADMIN.password,
        DEMO_EMPLOYEE_PASSWORD: E2E_EMPLOYEE.password,
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: 'frontend',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_PROXY: `http://localhost:${API_PORT}` },
    },
  ],
});
