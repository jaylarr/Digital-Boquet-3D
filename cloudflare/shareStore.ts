import { decode, encode, validate } from '../src/config.ts';

export const SHARE_CODE = /^[A-Za-z0-9_-]{16}$/;
const CAPACITY = 100 * 1024 * 1024;
const HOUR = 3600000;
export class ShareCapacityError extends Error {
  constructor() { super('Share storage is full.'); this.name = 'ShareCapacityError'; }
}
async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function randomCode() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))).replace(/\+/g, '-').replace(/\//g, '_');
}
/** Immutable snapshots; every operation uses the primary D1 binding. */
export class D1ShareStore {
  private readonly db: Env['BOUQUET_SHARES'];
  constructor(db: Env['BOUQUET_SHARES']) { this.db = db; }
  async ready() {
    await this.db.prepare('SELECT code FROM bouquets LIMIT 1').all();
    await this.db.prepare('SELECT ip_hash FROM share_rate_limits LIMIT 1').all();
  }
  async get(code: string): Promise<string | null> {
    if (!SHARE_CODE.test(code)) return null;
    const row = await this.db.prepare('SELECT payload FROM bouquets WHERE code = ?').bind(code).first<{ payload: string }>();
    if (!row) return null;
    decode(row.payload); return row.payload;
  }
  async consumeRateLimit(client: string, now: number): Promise<boolean> {
    const hash = await sha256(client);
    const result = await this.db.batch<{ request_count: number }>([
      this.db.prepare('DELETE FROM share_rate_limits WHERE ip_hash IN (SELECT ip_hash FROM share_rate_limits WHERE window_start <= ? LIMIT 1000)').bind(now - HOUR),
      this.db.prepare(`INSERT INTO share_rate_limits(ip_hash, window_start, request_count) VALUES (?, ?, 1)
        ON CONFLICT(ip_hash) DO UPDATE SET
          request_count = CASE WHEN share_rate_limits.window_start <= ? - 3600000 THEN 1 ELSE share_rate_limits.request_count + 1 END,
          window_start = CASE WHEN share_rate_limits.window_start <= ? - 3600000 THEN excluded.window_start ELSE share_rate_limits.window_start END
        RETURNING request_count`).bind(hash, now, now, now),
    ]);
    const count = result[1].results[0]?.request_count;
    if (typeof count !== 'number') throw new Error('Rate limit unavailable.');
    return count <= 120;
  }
  async save(input: unknown): Promise<string> {
    const payload = encode(validate(input)), digest = await sha256(payload);
    const existing = await this.findDigest(digest, payload);
    if (existing) return existing;
    const bytes = new TextEncoder().encode(payload).byteLength;
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = randomCode();
      const inserted = await this.db.prepare(`INSERT INTO bouquets(code, digest, payload, byte_length, created_at)
        SELECT ?, ?, ?, ?, ? WHERE COALESCE((SELECT SUM(byte_length) FROM bouquets), 0) + ? <= 104857600
        ON CONFLICT DO NOTHING RETURNING code`).bind(code, digest, payload, bytes, Date.now(), bytes).all<{ code: string }>();
      if (inserted.results[0]) return inserted.results[0].code;
      const concurrent = await this.findDigest(digest, payload);
      if (concurrent) return concurrent;
      const usage = await this.db.prepare('SELECT COALESCE(SUM(byte_length), 0) AS bytes FROM bouquets').first<{ bytes: number }>();
      if (!usage || usage.bytes + bytes > CAPACITY) throw new ShareCapacityError();
    }
    throw new Error('Could not allocate a share code.');
  }
  private async findDigest(digest: string, payload: string): Promise<string | null> {
    const row = await this.db.prepare('SELECT code, payload FROM bouquets WHERE digest = ?').bind(digest).first<{ code: string; payload: string }>();
    if (row && (row.payload !== payload || !SHARE_CODE.test(row.code))) throw new Error('Saved snapshot integrity check failed.');
    return row?.code ?? null;
  }
}
