import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { ShareStore } from '../server/shareStore';
import { shareApi } from '../server/shareApi';
import { clone, decode, encode, starter } from '../src/config';
import { createGiftObject } from '../src/giftCatalog';
import { createShareLink, openSharedBouquet, ShareLinkError } from '../src/sharing';

describe('saved sharing', () => {
  it('persists immutable complete snapshots across store restarts and deduplicates simultaneous requests', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'petalpop-share-')), store = new ShareStore(directory), c = clone(starter);
    c.objects = [{ ...createGiftObject('standing-frame', []), photo: 'data:image/jpeg;base64,/9j/AAAA', crop: { mode: 'fill', zoom: 2, x: .5, y: 0 }, color: '#123456' }];
    const codes = await Promise.all([store.save(c), store.save(c)]); expect(codes[0]).toMatch(/^[A-Za-z0-9_-]{16}$/); expect(codes[0]).toBe(codes[1]);
    c.gift.title = 'Later edit'; const second = await store.save(c); expect(second).not.toBe(codes[0]);
    const restarted = new ShareStore(directory); expect(decode((await restarted.get(codes[0]))!).gift.title).toBe(''); expect(decode((await restarted.get(second))!)).toEqual(c);
    expect(await store.get('../secret')).toBeNull(); expect(await store.get('0000000000000000')).toBeNull(); expect(() => store.save('!bad')).toThrow();
  });
  it('creates/restores tiny links, rejects active/cross-origin input, and reports a missing API', async () => {
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
      await expect(createShareLink(starter, controller.signal, `${base}static/`)).rejects.toBeInstanceOf(ShareLinkError);
    } finally { await new Promise<void>((resolve, reject) => { server.close(e => e ? reject(e) : resolve()); server.closeAllConnections(); }); }
  });
});

describe('short-only link creation', () => {
  const address = 'https://bouquetforyou.lar-ykt.com/';
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it('keeps a complete photo gift out of a 53-character URL', async () => {
    const config = clone(starter);
    config.objects = ['standing-frame', 'landscape-frame'].map(id => ({ ...createGiftObject(id as 'standing-frame' | 'landscape-frame', []), photo: 'data:image/jpeg;base64,/9j/AAAA' }));
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 'Abcdef012345_-XY' }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await createShareLink(config, new AbortController().signal, address);
    expect(result).toEqual({ url: `${address}#s=Abcdef012345_-XY`, short: true });
    expect(result.url).toHaveLength(53);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).config).toEqual(config);
  });
  it.each([400, 404, 405, 413, 429, 503, 507])('rejects HTTP %i instead of returning portable data', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status })));
    await expect(createShareLink(starter, new AbortController().signal, address)).rejects.toMatchObject({
      reason: status === 429 ? 'rate-limited' : [400, 413].includes(status) ? 'invalid-gift' : 'unavailable', status,
    });
  });
  it.each([null, {}, { code: 123 }, { code: '../invalid' }, { code: 'short' }])('rejects malformed success payload %j', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));
    await expect(createShareLink(starter, new AbortController().signal, address)).rejects.toMatchObject({ reason: 'unavailable' });
  });
  it('rejects HTML success, bad JSON and network failure', async () => {
    for (const response of [new Response('<html>site</html>', { headers: { 'content-type': 'text/html' } }), new Response('{', { headers: { 'content-type': 'application/json' } })]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
      await expect(createShareLink(starter, new AbortController().signal, address)).rejects.toMatchObject({ reason: 'unavailable' });
    }
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(createShareLink(starter, new AbortController().signal, address)).rejects.toMatchObject({ reason: 'unavailable' });
  });
  it('validates before sending and preserves explicit cancellation', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(createShareLink({ ...starter, version: 99 } as unknown as typeof starter, new AbortController().signal, address)).rejects.toMatchObject({ reason: 'invalid-gift' });
    const controller = new AbortController(); controller.abort();
    await expect(createShareLink(starter, controller.signal, address)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('distinguishes the deadline from cancellation during a request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const timed = expect(createShareLink(starter, new AbortController().signal, address)).rejects.toMatchObject({ reason: 'timeout' });
    await vi.advanceTimersByTimeAsync(6000); await timed;
    const controller = new AbortController();
    const cancelled = expect(createShareLink(starter, controller.signal, address)).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await cancelled;
  });
});
