import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({
  ...config, testMatch: 'gift-assets.spec.ts', outputDir: 'test-results/gift-assets',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/gift-assets' }]],
  use: { ...config.use, baseURL: 'http://127.0.0.1:5190' },
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev -- --port 5190 --strictPort`, url: 'http://127.0.0.1:5190', reuseExistingServer: true, timeout: 60000 },
});
