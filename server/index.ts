import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ShareStore } from './shareStore.ts';
import { shareApi } from './shareApi.ts';
const root = resolve(fileURLToPath(new URL('../dist', import.meta.url))), data = resolve(process.env.SHARE_DATA_DIR ?? fileURLToPath(new URL('../.data/shares', import.meta.url)));
const api = shareApi(new ShareStore(data));
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
createServer((req, res) => { void api(req, res, () => { void (async () => {
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname), path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if ((path !== join(root, 'index.html') && !path.startsWith(`${root}${sep}`)) || !['GET', 'HEAD'].includes(req.method ?? '')) { res.writeHead(404); res.end(); return; }
    const info = await stat(path); if (!info.isFile()) throw new Error('Missing file');
    res.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end(); else createReadStream(path).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404); res.end('Not found'); }
})(); }); }).listen(Number(process.env.PORT ?? 5181), process.env.HOST ?? '127.0.0.1', () => { console.log(`PetalPop serving dist with saved short links on port ${process.env.PORT ?? 5181}`); });
