import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 60000, expect: { timeout: 15000 }, workers: 1, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5180', viewport: { width: 1280, height: 960 }, reducedMotion: 'reduce', screenshot: 'only-on-failure', trace: 'retain-on-failure', launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev -- --port 5180 --strictPort`, url: 'http://127.0.0.1:5180', reuseExistingServer: true, timeout: 60000 },
});
