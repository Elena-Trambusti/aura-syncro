import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
const isLocal = !process.env.PLAYWRIGHT_BASE_URL

const localBackendEnv = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://aura:aura@localhost:5432/aura_test',
  DIRECT_URL: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? 'postgresql://aura:aura@localhost:5432/aura_test',
  JWT_SECRET: process.env.JWT_SECRET ?? 'ci-jwt-secret-for-e2e-tests-only',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  NODE_ENV: 'development',
  PREMIUM_DEV_UNLOCK: process.env.PREMIUM_DEV_UNLOCK ?? 'true',
  POS_ALLOW_SIMULATION: process.env.POS_ALLOW_SIMULATION ?? 'true',
}

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
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: localBackendEnv,
        },
        {
          command: 'npm run dev --prefix .',
          url: 'http://localhost:5173',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ]
    : undefined,
})
