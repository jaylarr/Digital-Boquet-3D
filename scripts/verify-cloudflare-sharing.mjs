import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { clone, starter, validate, encode, decode } from '../src/config.ts';
import { createGiftObject } from '../src/giftCatalog.ts';
import { D1ShareStore, ShareCapacityError } from '../cloudflare/shareStore.ts';

// Use the emulator shipped with the exact pinned Wrangler, not an independently drifting runtime.
const require = createRequire(import.meta.url), wranglerRoot = dirname(require.resolve('wrangler/package.json'));
const { Miniflare } = await import(pathToFileURL(require.resolve('miniflare', { paths: [wranglerRoot] })).href);
if (process.argv.length > 2) throw new Error('This verifier accepts no remote target or arguments.');
const root = resolve(import.meta.dirname, '..');
const build = spawnSync(process.execPath, [resolve(wranglerRoot, 'bin/wrangler.js'), 'deploy', '--dry-run', '--config', 'cloudflare/wrangler.jsonc', '--outdir', resolve(root, '.checks/cloudflare/build')], { cwd: root, stdio: 'inherit', windowsHide: true });
assert.equal(build.status, 0, 'Local Worker bundling failed');
const state = resolve(root, '.checks/cloudflare/test-state', crypto.randomUUID());
await mkdir(state, { recursive: true });
const options = {
  resourcePersistencePath: state,
  workers: [{ config: {
    name: 'bouquetforyou-share-api', compatibilityDate: '2026-10-26', compatibilityFlags: ['nodejs_compat'],
    manifest: { mainModule: 'worker.js', modules: { 'worker.js': { type: 'esm', contents: await readFile(resolve(root, '.checks/cloudflare/build/worker.js'), 'utf8') } } },
    env: { BOUQUET_SHARES: { type: 'd1', name: 'bouquetforyou-shares', id: 'bouquetforyou-test', dev: { remote: false } } },
  }, dev: { rootPath: root } }],
};
let runtime = new Miniflare(options), passed = 0;
async function check(name, test) { await test(); passed++; console.log(`PASS ${name}`); }
const base = 'http://localhost/api/bouquets';
const post = (config, headers = {}) => runtime.dispatchFetch(base, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ config }) });
const config = clone(starter);
config.gift = { to: 'Test recipient', from: 'Test sender', title: 'Test bouquet 花', message: 'Synthetic fixture.' };
for (const id of ['standing-frame', 'landscape-frame', 'sealed-envelope']) config.objects.push(createGiftObject(id, config.objects));
for (const frame of config.objects.slice(0, 2)) {
  frame.photo = 'data:image/jpeg;base64,/9j/AAAA';
  frame.crop = { mode: 'fill', zoom: 1.5, x: .25, y: -.25 }; frame.frameOrientation = 'landscape';
}
config.objects[2].note = { align: 'center', runs: [{ text: 'Synthetic note 花', font: 'serif', size: 20, bold: true, color: '#123456' }] };
config.arrangement = { profile: 'stepped', showStems: true, height: .2, edits: [{ key: 'rose:0', height: .1, size: 1.1, x: .1, z: 0 }], fillerProfile: 'natural', fillerHeight: .1, fillerSize: 1.1, fillerSpread: 1.1, fillerEdits: [{ key: 'eucalyptus:0', height: .1, size: 1.1, x: 0, z: .1 }] };
const expected = validate(config);
let code;
try {
  const db = await runtime.getD1Database('BOUQUET_SHARES');
  await check('missing schema fails readiness closed', async () => assert.equal((await runtime.dispatchFetch(base)).status, 503));
  await db.exec((await readFile(resolve(root, 'cloudflare/migrations/0001_bouquet_shares.sql'), 'utf8')).replace(/\s+/g, ' '));
  const store = new D1ShareStore(db);
  await check('database readiness and JSON headers', async () => {
    const response = await runtime.dispatchFetch(base); assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { shortLinks: true }); assert.equal(response.headers.get('cache-control'), 'no-store');
  });
  await check('full gift survives API round trip and URL is 53 characters', async () => {
    const response = await post(config); assert.equal(response.status, 201); ({ code } = await response.json());
    assert.match(code, /^[A-Za-z0-9_-]{16}$/); assert.equal(`https://bouquetforyou.lar-ykt.com/#s=${code}`.length, 53);
    const saved = await runtime.dispatchFetch(`${base}/${code}`); assert.equal(saved.status, 200);
    assert.deepEqual(decode((await saved.json()).payload), expected);
  });
  await check('concurrent identical requests deduplicate; later edits remain immutable', async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () => post(config)));
    for (const response of responses) { assert.equal(response.status, 201); assert.equal((await response.json()).code, code); }
    const changed = clone(config); changed.gift.title = 'Later edit';
    const next = await post(changed); assert.equal(next.status, 201); assert.notEqual((await next.json()).code, code);
    assert.deepEqual(decode(await store.get(code)), expected);
  });
  await check('origin, method, content type, JSON, validation and code boundaries', async () => {
    assert.equal((await post(config, { Origin: 'https://other.example' })).status, 403);
    assert.equal((await post(config, { Origin: 'null' })).status, 403);
    assert.equal((await post(config, { Origin: 'http://localhost' })).status, 201);
    assert.equal((await runtime.dispatchFetch(base, { method: 'DELETE' })).status, 405);
    assert.equal((await runtime.dispatchFetch(base, { method: 'POST', body: 'bad' })).status, 415);
    assert.equal((await runtime.dispatchFetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })).status, 400);
    assert.equal((await post({ version: 99 })).status, 400);
    assert.equal((await runtime.dispatchFetch(`${base}/bad`)).status, 400);
    assert.equal((await runtime.dispatchFetch(`${base}/0000000000000000`)).status, 404);
    assert.equal((await runtime.dispatchFetch('http://localhost/api/bouquets-unrelated')).status, 404);
  });
  await check('declared and streamed oversized requests return 413', async () => {
    assert.equal((await runtime.dispatchFetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'A'.repeat(190001) })).status, 413);
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(100000)); controller.enqueue(new Uint8Array(90001)); controller.close(); } });
    assert.equal((await runtime.dispatchFetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body, duplex: 'half' })).status, 413);
  });
  await check('persistent atomic rolling-hour rate limit and reset', async () => {
    await db.prepare('DELETE FROM share_rate_limits').run();
    const responses = await Promise.all(Array.from({ length: 121 }, () => post(config)));
    assert.equal(responses.filter(response => response.status === 201).length, 120);
    assert.equal(responses.filter(response => response.status === 429).length, 1);
    await db.prepare('UPDATE share_rate_limits SET window_start = ?').bind(Date.now() - 3500000).run();
    assert.equal((await post(config)).status, 429);
    await db.prepare('UPDATE share_rate_limits SET window_start = ?').bind(Date.now() - 3600001).run();
    assert.equal((await post(config)).status, 201);
    await db.prepare('DELETE FROM share_rate_limits').run();
  });
  await check('atomic capacity, dedup at capacity and concurrent distinct writes', async () => {
    // Adjust accounting only in this unique local test database; no large allocation or remote writes.
    await db.prepare('UPDATE bouquets SET byte_length = 1').run();
    const count = (await db.prepare('SELECT COUNT(*) AS n FROM bouquets').first()).n;
    const changed = clone(config); changed.gift.title = 'Capacity candidate'; const bytes = new TextEncoder().encode(encode(changed)).byteLength;
    await db.prepare('UPDATE bouquets SET byte_length = ? WHERE code = ?').bind(104857600 - bytes - count + 1, code).run();
    const other = clone(changed); other.gift.title = 'Capacity contender';
    const results = await Promise.allSettled([store.save(changed), store.save(other)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const usage = (await db.prepare('SELECT SUM(byte_length) AS n FROM bouquets').first()).n; assert.ok(usage <= 104857600);
    await db.prepare('UPDATE bouquets SET byte_length = byte_length + ? WHERE code = ?').bind(104857600 - usage, code).run();
    assert.equal(await store.save(config), code);
    const full = clone(config); full.gift.title = 'No capacity remaining';
    await assert.rejects(store.save(full), ShareCapacityError); assert.equal((await post(full)).status, 507);
    const rows = (await db.prepare('SELECT code, payload FROM bouquets').all()).results;
    for (const row of rows) await db.prepare('UPDATE bouquets SET byte_length = ? WHERE code = ?').bind(new TextEncoder().encode(row.payload).byteLength, row.code).run();
  });
  await check('corrupt saved payload returns 503 without leaking content', async () => {
    const payload = await store.get(code); await db.prepare('UPDATE bouquets SET payload = ? WHERE code = ?').bind('broken', code).run();
    const response = await runtime.dispatchFetch(`${base}/${code}`); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('broken'));
    assert.equal((await post(config)).status, 503);
    await db.prepare('UPDATE bouquets SET payload = ? WHERE code = ?').bind(payload, code).run();
  });
  await check('saved link survives runtime disposal and restart on the same disk', async () => {
    await runtime.dispose(); runtime = new Miniflare(options);
    const response = await runtime.dispatchFetch(`${base}/${code}`); assert.equal(response.status, 200);
    assert.deepEqual(decode((await response.json()).payload), expected);
  });
  console.log(`Cloudflare sharing: ${passed}/${passed} checks passed (local workerd + persistent D1).`);
} finally { await runtime.dispose(); }
