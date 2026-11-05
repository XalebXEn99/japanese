import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  use: { baseURL, trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { command: 'npm run dev -- --port 5173 --strictPort', url: baseURL, reuseExistingServer: !process.env.CI },
});
