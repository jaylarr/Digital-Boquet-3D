import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { decode, encode, validate } from '../src/config.ts';

export const SHARE_CODE = /^[A-Za-z0-9_-]{16}$/;
const STORAGE_LIMIT = 100 * 1024 * 1024;
/** Immutable snapshots live on disk, survive restarts, and contain the complete gift. */
export class ShareStore {
  private directory: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(directory: string) { this.directory = directory; }
  async get(code: string) {
    if (!SHARE_CODE.test(code)) return null;
    try { const saved = JSON.parse(await readFile(join(this.directory, `${code}.json`), 'utf8')) as { payload: string }; decode(saved.payload); return saved.payload; }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
  }
  save(input: unknown): Promise<string> {
    const payload = encode(validate(input)), digest = createHash('sha256').update(payload).digest('hex');
    const run = this.queue.catch(() => {}).then(async () => {
      await mkdir(this.directory, { recursive: true });
      const index = join(this.directory, `${digest}.index`);
      try { const existing = await readFile(index, 'utf8'); if (SHARE_CODE.test(existing) && await this.get(existing) === payload) return existing; } catch { /* A missing index or interrupted write can be rebuilt. */ }
      const files = await readdir(this.directory), sizes = await Promise.all(files.filter(f => f.endsWith('.json')).map(f => stat(join(this.directory, f))));
      if (sizes.reduce((bytes, s) => bytes + s.size, 0) + payload.length > STORAGE_LIMIT) throw new Error('Share storage is full.');
      const code = randomBytes(12).toString('base64url');
      await writeFile(join(this.directory, `${code}.json`), JSON.stringify({ payload }), { flag: 'wx', mode: 0o600 });
      await writeFile(index, code, { mode: 0o600 }); return code;
    });
    this.queue = run; return run;
  }
}
