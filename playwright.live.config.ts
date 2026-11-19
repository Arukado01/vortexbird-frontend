import { defineConfig, devices } from '@playwright/test';
import { loadLiveEnvironment } from './e2e-live/environment';

const environment = loadLiveEnvironment();

export default defineConfig({
  testDir: './e2e-live',
  testMatch: '**/*.live.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60000,
  expect: { timeout: 20000 },
  outputDir: 'test-results/live/artifacts',
  preserveOutput: 'never',
  quiet: true,
  reporter: [['./e2e-live/safe-reporter.ts']],
  metadata: { evidence: 'Real portal, identity provider and API; no response interception' },
  use: {
    baseURL: environment.frontend.origin,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    ignoreHTTPSErrors: false,
    trace: 'off', screenshot: 'off', video: 'off',
    acceptDownloads: false,
  },
  projects: [{ name: 'live-chromium', use: { ...devices['Desktop Chrome'] } }],
});
