import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
const isLocal = !process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.platform === 'win32' ? { channel: 'msedge' as const } : {}),
      },
    },
  ],
  webServer: isLocal
    ? [
        {
          command: 'npm run dev --prefix ../backend',
          url: 'http://localhost:3001/api/health',
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'npm run dev --prefix .',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ]
    : undefined,
})
