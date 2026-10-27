import { validate } from '../src/config.ts';
import { D1ShareStore, SHARE_CODE, ShareCapacityError } from './shareStore.ts';

const PREFIX = '/api/bouquets', BODY_LIMIT = 190000;
function reply(status: number, body: unknown, allow?: string) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', ...(allow ? { Allow: allow } : {}),
  } });
}
class RequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
async function readConfig(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new RequestError(415, 'Use JSON.');
  const length = request.headers.get('content-length');
  if (length && Number(length) > BODY_LIMIT) throw new RequestError(413, 'This bouquet is too large.');
  if (!request.body) throw new RequestError(400, 'Invalid bouquet.');
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT) { await reader.cancel(); throw new RequestError(413, 'This bouquet is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return validate(body && typeof body === 'object' && 'config' in body ? body.config : null);
  } catch { throw new RequestError(400, 'Invalid bouquet.'); }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    const collection = path === PREFIX;
    if (!collection && !path.startsWith(`${PREFIX}/`)) return reply(404, { error: 'Not found.' });
    if (!['GET', 'POST'].includes(request.method) || !collection && request.method !== 'GET') return reply(405, { error: 'Method not allowed.' }, collection ? 'GET, POST' : 'GET');
    try {
      const store = new D1ShareStore(env.BOUQUET_SHARES);
      if (request.method === 'GET') {
        if (collection) { await store.ready(); return reply(200, { shortLinks: true }); }
        const code = path.slice(PREFIX.length + 1);
        if (!SHARE_CODE.test(code)) return reply(400, { error: 'This bouquet link seems broken.' });
        const payload = await store.get(code);
        return payload === null ? reply(404, { error: 'This saved bouquet could not be found.' }) : reply(200, { payload });
      }
      const origin = request.headers.get('origin');
      if (origin) {
        let matches = false;
        try { matches = new URL(origin).origin === url.origin; } catch { /* Malformed origins are rejected. */ }
        if (!matches) return reply(403, { error: 'Use this site to create a link.' });
      }
      const config = await readConfig(request);
      if (!await store.consumeRateLimit(request.headers.get('CF-Connecting-IP') ?? 'unknown', Date.now())) return reply(429, { error: 'Please try again later.' });
      return reply(201, { code: await store.save(config) });
    } catch (error) {
      if (error instanceof RequestError) return reply(error.status, { error: error.message });
      if (error instanceof ShareCapacityError) return reply(507, { error: 'Short links are temporarily unavailable.' });
      console.error(JSON.stringify({ operation: 'bouquet-api', category: 'storage-or-internal', status: 503, requestId: crypto.randomUUID() }));
      return reply(503, { error: 'Short links are temporarily unavailable.' });
    }
  },
} satisfies ExportedHandler<Env>;
