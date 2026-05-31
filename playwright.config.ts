import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'
import path from 'path'

// Load .env.local for E2E test helpers that call Supabase directly
config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // serial within suites — beforeAll state is shared
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // single worker to avoid DB race conditions between test files
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true, // reuse already-running dev server
    timeout: 30000,
  },
})
