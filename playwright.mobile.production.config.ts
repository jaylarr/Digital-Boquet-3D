import { defineConfig } from '@playwright/test';
import mobile from './playwright.mobile.config';
export default defineConfig({ ...mobile,
  testMatch: 'mobile-studio.spec.ts',
  outputDir: 'test-results/mobile-production',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/mobile-production' }]],
  use: { ...mobile.use, baseURL: 'http://127.0.0.1:5194' },
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run preview -- --port 5194 --strictPort`, url: 'http://127.0.0.1:5194', reuseExistingServer: true, timeout: 60000 },
});
