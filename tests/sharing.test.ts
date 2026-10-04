import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { ShareStore } from '../server/shareStore';
import { shareApi } from '../server/shareApi';
import { clone, decode, encode, starter } from '../src/config';
import { createGiftObject } from '../src/giftCatalog';
import { createShareLink, openSharedBouquet } from '../src/sharing';

describe('saved sharing', () => {
  it('persists immutable complete snapshots across store restarts and deduplicates simultaneous requests', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'petalpop-share-')), store = new ShareStore(directory), c = clone(starter);
    c.objects = [{ ...createGiftObject('standing-frame', []), photo: 'data:image/jpeg;base64,/9j/AAAA', crop: { mode: 'fill', zoom: 2, x: .5, y: 0 }, color: '#123456' }];
    const codes = await Promise.all([store.save(c), store.save(c)]); expect(codes[0]).toMatch(/^[A-Za-z0-9_-]{16}$/); expect(codes[0]).toBe(codes[1]);
    c.gift.title = 'Later edit'; const second = await store.save(c); expect(second).not.toBe(codes[0]);
    const restarted = new ShareStore(directory); expect(decode((await restarted.get(codes[0]))!).gift.title).toBe(''); expect(decode((await restarted.get(second))!)).toEqual(c);
    expect(await store.get('../secret')).toBeNull(); expect(await store.get('0000000000000000')).toBeNull(); expect(() => store.save('!bad')).toThrow();
  });
  it('creates/restores tiny links, rejects active/cross-origin input, and falls back on a static host', async () => {
    const store = new ShareStore(await mkdtemp(join(tmpdir(), 'petalpop-api-'))), api = shareApi(store), server = createServer((req, res) => { void api(req, res, () => { res.writeHead(404); res.end(); }); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address() as { port: number }, base = `http://127.0.0.1:${address.port}/`, controller = new AbortController();
    try {
      const link = await createShareLink(starter, controller.signal, base); expect(link.short).toBe(true); expect(link.url.length).toBeLessThan(60);
      expect(await openSharedBouquet(new URL(link.url).hash.slice(3), controller.signal, base)).toEqual(starter);
      await expect(openSharedBouquet('0000000000000000', controller.signal, base)).rejects.toThrow('could not be found');
      expect((await fetch(`${base}api/bouquets`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://other.example' }, body: JSON.stringify({ config: starter }) })).status).toBe(403);
      expect((await fetch(`${base}api/bouquets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: '!bad' }) })).status).toBe(400);
      expect((await fetch(`${base}api/bouquets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: encode(starter) }) })).status).toBe(400);
      expect((await fetch(`${base}api/bouquets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'A'.repeat(190001) })).status).toBe(413);
      const portable = await createShareLink(starter, controller.signal, `${base}static/`); expect(portable.short).toBe(false); expect(decode(new URL(portable.url).hash.slice(3))).toEqual(starter);
    } finally { await new Promise<void>((resolve, reject) => { server.close(e => e ? reject(e) : resolve()); server.closeAllConnections(); }); }
  });
});
