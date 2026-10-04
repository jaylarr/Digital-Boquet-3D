import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sharingPlugin } from './server/sharingPlugin.ts';
export default defineConfig({
  plugins: [react(), sharingPlugin()], base: './',
  server: { watch: { ignored: ['**/artifacts/**', '**/test-results/**', '**/playwright-report/**', '**/.checks/**', '**/.data/**'] } },
  build: { chunkSizeWarningLimit: 850, rollupOptions: { input: { main: 'index.html', assets: 'asset-study.html' } } },
});
