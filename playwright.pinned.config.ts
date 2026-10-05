import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, timeout: 120000,
  testMatch: ['mobile-studio.spec.ts', 'live-flower-editor.spec.ts', 'surprise-studio.spec.ts'],
  outputDir: 'test-results/pinned-studio',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/pinned-studio' }]],
  use: { ...base.use, baseURL: 'http://127.0.0.1:5203' },
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev -- --port 5203 --strictPort`, url: 'http://127.0.0.1:5203', reuseExistingServer: true, timeout: 60000 },
});
