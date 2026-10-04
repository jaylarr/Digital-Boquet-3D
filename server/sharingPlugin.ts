import { join } from 'node:path';
import type { Plugin } from 'vite';
import { ShareStore } from './shareStore.ts';
import { shareApi } from './shareApi.ts';
export function sharingPlugin(): Plugin {
  return { name: 'petalpop-short-links', configureServer(server) { server.middlewares.use(shareApi(new ShareStore(join(server.config.root, '.data', 'shares')), server.config.base)); }, configurePreviewServer(server) { server.middlewares.use(shareApi(new ShareStore(join(server.config.root, '.data', 'shares')), server.config.base)); } };
}
