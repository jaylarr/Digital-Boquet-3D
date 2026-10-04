import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base, testMatch: ['object-editing.spec.ts', 'objects.spec.ts', 'frames.spec.ts', 'studio.spec.ts', 'envelopes.spec.ts'],
  timeout: 90000, outputDir: 'test-results/object-editing',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/object-editing' }]],
  use: { ...base.use, baseURL: 'http://127.0.0.1:5198' },
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev -- --port 5198 --strictPort`, url: 'http://127.0.0.1:5198', reuseExistingServer: true, timeout: 60000 },
});
