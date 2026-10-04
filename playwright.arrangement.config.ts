import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base,
  testMatch: ['flower-arrangement.spec.ts', 'live-flower-editor.spec.ts', 'mobile-studio.spec.ts', 'frames.spec.ts', 'gift-assets.spec.ts', 'studio.spec.ts', 'envelopes.spec.ts', 'animation.spec.ts'],
  use: { ...base.use, baseURL: 'http://127.0.0.1:5195' },
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev -- --port 5195 --strictPort`, url: 'http://127.0.0.1:5195', reuseExistingServer: true, timeout: 60000 },
});
