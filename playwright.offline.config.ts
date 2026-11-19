import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  metadata: { ...base.metadata, offlineBuild: true, evidence: 'UI bundle with synthetic API fixtures; no live backend' },
  webServer: undefined,
  outputDir: 'test-results/isolated',
  reporter: [['list'], ['json', { outputFile: 'test-results/isolated-results.json' }]],
  use: { ...base.use, baseURL: 'https://vortexbird.test' },
});
