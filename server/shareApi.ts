import type { IncomingMessage, ServerResponse } from 'node:http';
import { SHARE_CODE, ShareStore } from './shareStore.ts';

function reply(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body));
}
export function shareApi(store: ShareStore, base = '/') {
  const prefix = `${base.replace(/\/$/, '')}/api/bouquets`, requests = new Map<string, { until: number; count: number }>();
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? '').split('?')[0];
    if (path !== prefix && !path.startsWith(`${prefix}/`)) { next(); return; }
    try {
      if (req.method === 'GET' && path === prefix) { reply(res, 200, { shortLinks: true }); return; }
      if (req.method === 'GET') {
        const code = path.slice(prefix.length + 1);
        if (!SHARE_CODE.test(code)) { reply(res, 400, { error: 'This bouquet link seems broken.' }); return; }
        const payload = await store.get(code); reply(res, payload ? 200 : 404, payload ? { payload } : { error: 'This saved bouquet could not be found.' }); return;
      }
      if (req.method !== 'POST' || path !== prefix) { reply(res, 405, { error: 'Method not allowed.' }); return; }
      if (!req.headers['content-type']?.startsWith('application/json')) { reply(res, 415, { error: 'Use JSON.' }); return; }
      if (req.headers.origin) { const origin = new URL(req.headers.origin); if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== req.headers.host) { reply(res, 403, { error: 'Use this site to create a link.' }); return; } }
      const now = Date.now(), ip = req.socket.remoteAddress ?? 'unknown';
      for (const [key, entry] of requests) if (entry.until < now) requests.delete(key);
      const rate = requests.get(ip) ?? { until: now + 3600000, count: 0 }; requests.set(ip, rate);
      if (++rate.count > 120 || requests.size > 10000) { reply(res, 429, { error: 'Please try again later.' }); return; }
      let body = '', bytes = 0;
      for await (const chunk of req) { bytes += Buffer.byteLength(chunk); if (bytes > 190000) { reply(res, 413, { error: 'This bouquet is too large.' }); return; } body += chunk; }
      let config: unknown;
      try { config = (JSON.parse(body) as { config?: unknown }).config; } catch { reply(res, 400, { error: 'Invalid bouquet.' }); return; }
      if (!config || typeof config !== 'object') { reply(res, 400, { error: 'Invalid bouquet.' }); return; }
      let code: string;
      try { code = await store.save(config); } catch (e) { if ((e as Error).message === 'Share storage is full.') { reply(res, 507, { error: 'Short links are temporarily unavailable.' }); return; } if ((e as NodeJS.ErrnoException).code) throw e; reply(res, 400, { error: 'Invalid bouquet.' }); return; }
      reply(res, 201, { code });
    } catch { reply(res, 503, { error: 'Short links are temporarily unavailable.' }); }
  };
}
