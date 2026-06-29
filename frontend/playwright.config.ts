import { defineConfig } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://aurasyncro.com'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{
    name: 'chromium',
    use: {
      browserName: 'chromium',
      // Usa Edge di sistema su Windows — evita download ~180MB in CI locale
      ...(process.platform === 'win32' ? { channel: 'msedge' as const } : {}),
    },
  }],
})
