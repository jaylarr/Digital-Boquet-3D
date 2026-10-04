import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base,
  testMatch: 'frames.spec.ts', grep: /four frame designs/,
  timeout: 90000, outputDir: 'test-results/frames-production',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/frames-production' }]],
  use: { ...base.use, baseURL: 'http://127.0.0.1:5194' },
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run preview -- --port 5194 --strictPort`, url: 'http://127.0.0.1:5194', reuseExistingServer: true, timeout: 60000 },
});
