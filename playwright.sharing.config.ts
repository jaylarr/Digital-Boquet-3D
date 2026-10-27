import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
export default defineConfig(base, {
  testMatch: '**/sharing-errors.spec.ts',
  webServer: [
    { command: `${npm} run dev -- --port 5180 --strictPort`, url: 'http://127.0.0.1:5180', reuseExistingServer: true, timeout: 60000 },
    { command: `${npm} run cf:migrate:local && ${npm} run cf:dev`, url: 'http://127.0.0.1:8787/api/bouquets', reuseExistingServer: false, timeout: 60000 },
  ],
});
