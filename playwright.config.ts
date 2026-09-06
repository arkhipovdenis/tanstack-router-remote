import { defineConfig, devices } from '@playwright/test'

// These specs exercise what jsdom structurally cannot: real chunk requests, the
// Module Federation runtime, and genuine network failures. Everything that can
// be asserted without a browser stays in the vitest suites.
export default defineConfig({
  testDir: './tests/e2e',
  // The federation lab is one shared host on a fixed port, so specs that
  // navigate it cannot run concurrently against each other.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3100',
    // A failed run in CI is the only chance to see what happened.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Production builds, not dev servers: chunk-splitting and the federation
  // entry only behave like the shipped artifact after a real build.
  webServer: {
    command: 'pnpm run preview:example:module-federation',
    url: 'http://localhost:3100/platform/',
    reuseExistingServer: !process.env.CI,
    // The command builds the packages and all three apps before serving.
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
