import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig(base, {
  testMatch: 'envelopes.spec.ts',
  use: { baseURL: 'http://127.0.0.1:5193' },
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev -- --port 5193 --strictPort`, url: 'http://127.0.0.1:5193', reuseExistingServer: true, timeout: 60000 },
});
