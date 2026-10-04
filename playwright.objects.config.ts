import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({
  ...config, testMatch: ['objects.spec.ts', 'app.spec.ts'], timeout: 90000, outputDir: 'test-results/objects',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/objects' }]],
  use: { ...config.use, baseURL: 'http://127.0.0.1:5190' },
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev -- --port 5190 --strictPort`, url: 'http://127.0.0.1:5190', reuseExistingServer: true, timeout: 60000 },
});
