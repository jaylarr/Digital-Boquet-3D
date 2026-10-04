import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base,
  testMatch: ['mobile-studio.spec.ts', 'live-flower-editor.spec.ts', 'studio.spec.ts', 'envelopes.spec.ts'],
  outputDir: 'test-results/mobile-studio',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/mobile-studio' }]],
  use: { ...base.use, baseURL: 'http://127.0.0.1:5195' },
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev -- --port 5195 --strictPort`, url: 'http://127.0.0.1:5195', reuseExistingServer: true, timeout: 60000 },
});
