import { test, expect, type BrowserContext } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { clone, DRAFT_KEY, starter, decode, shareUrl } from '../../src/config';
import { readyLink, confirmRemix } from './shareHelpers';

const code = 'Abcdef012345_-XY';
test('save errors show Retry, preserve edits and never expose a portable URL', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} });
  });
  await page.goto('/');
  await page.route('**/api/bouquets', route => route.fulfill({ status: 503, json: {} }));
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Keep this title');
  await expect(page.getByRole('alert')).toContainText("We couldn't create a short link");
  await expect(page.locator('.share-link')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Share via…', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
  await mkdir('artifacts/sharing', { recursive: true });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: width < 760 ? 844 : 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Retry', exact: true }).focus();
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeFocused();
    await page.screenshot({ path: `artifacts/sharing/error-${width}.png` });
  }
  await page.unroute('**/api/bouquets');
  await page.route('**/api/bouquets', route => route.fulfill({ status: 201, json: { code } }));
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  expect(new URL(await readyLink(page)).hash).toBe(`#s=${code}`);
  await expect(page.getByRole('dialog').getByLabel('Title', { exact: true })).toHaveValue('Keep this title');
});

test('HTTP limits, HTML success and timeout settle as errors; reopening retries', async ({ page }) => {
  await page.goto('/');
  for (const status of [429, 413, 200, 0]) {
    await page.route('**/api/bouquets', async route => {
      if (status === 0) { await new Promise(resolve => setTimeout(resolve, 6500)); await route.abort().catch(() => {}); }
      else await route.fulfill({ status, contentType: status === 200 ? 'text/html' : 'application/json', body: status === 200 ? '<html>Static fallback</html>' : '{}' });
    });
    await page.getByRole('button', { name: 'Share bouquet', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(status === 429 ? 'Too many' : status === 413 ? "couldn't be saved" : status === 0 ? 'took too long' : "couldn't create");
    await expect(page.locator('.share-link')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.unroute('**/api/bouquets');
  }
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click();
  await readyLink(page);
});

test('edits and close cancel stale results; native sharing uses only current saved text', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (payload: ShareData) => { Object.assign(window, { __sharingPayload: payload }); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } });
  });
  let first = true, received = false, staleSettled = false;
  let releaseFirst!: () => void, releaseLatest!: () => void;
  const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
  const latestGate = new Promise<void>(resolve => { releaseLatest = resolve; });
  await page.route('**/api/bouquets', async route => {
    if (first) { first = false; received = true; await firstGate; await route.fulfill({ status: 201, json: { code: 'Stale0123456789X' } }).catch(() => {}); staleSettled = true; }
    else { await latestGate; await route.fulfill({ status: 201, json: { code } }); }
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Share bouquet', exact: true }).click();
  await expect.poll(() => received).toBe(true);
  await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Latest saved title');
  await page.getByRole('dialog').getByLabel('Body', { exact: true }).fill('Latest saved body');
  await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeDisabled();
  releaseLatest();
  expect(new URL(await readyLink(page)).hash).toBe(`#s=${code}`);
  releaseFirst(); await expect.poll(() => staleSettled).toBe(true);
  expect(new URL(await page.locator('.share-link').inputValue()).hash).toBe(`#s=${code}`);
  await page.getByRole('button', { name: 'Share via…', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { __sharingPayload: ShareData }).__sharingPayload)).toMatchObject({ title: 'Latest saved title', text: 'Latest saved body', url: expect.stringContaining(`#s=${code}`) });
  await page.getByRole('button', { name: 'Copy link', exact: true }).click(); await expect(page.locator('.share-link')).toBeFocused();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); await readyLink(page);
});

async function useWorker(context: BrowserContext) {
  await context.route(/\/api\/bouquets(?:\/[^?]*)?(?:\?.*)?$/, async route => {
    const headers: Record<string, string> = { ...route.request().headers(), origin: 'http://127.0.0.1:8787' }; delete headers.host;
    const response = await route.fetch({ url: `http://127.0.0.1:8787${new URL(route.request().url()).pathname}`, headers });
    await route.fulfill({ response });
  });
}
test('real Worker stores photos and notes; fresh recipients and legacy gifts retain drafts', async ({ page, context, browser, request }) => {
  await useWorker(context); await page.goto('/');
  const photo = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32; const drawing = canvas.getContext('2d')!; drawing.fillStyle = '#aa5577'; drawing.fillRect(0, 0, 32, 32); return canvas.toDataURL('image/jpeg'); });
  const config = clone(starter); config.gift.title = 'A saved photo gift';
  config.objects = [
    { uid: 'photo-a', id: 'standing-frame', position: [-1, -1.5, 1], rotation: 0, scale: .7, photo, crop: { mode: 'fill', zoom: 1.2, x: .1, y: -.2 }, frameOrientation: 'landscape' },
    { uid: 'photo-b', id: 'landscape-frame', position: [1, -1.5, 1], rotation: 0, scale: .7, photo, frameOrientation: 'portrait' },
    { uid: 'letter', id: 'sealed-envelope', position: [0, -1.5, 1.5], rotation: 0, scale: .7, note: { align: 'center', runs: [{ text: 'Synthetic personal note', bold: true }] } },
  ];
  await page.addInitScript(({ key, config }) => {
    if (!sessionStorage.getItem('sharing-fixture-loaded')) { localStorage.setItem(key, JSON.stringify(config)); sessionStorage.setItem('sharing-fixture-loaded', 'true'); }
  }, { key: DRAFT_KEY, config }); await page.reload();
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); const url = await readyLink(page), hash = new URL(url).hash;
  const response = await request.get(`http://127.0.0.1:8787/api/bouquets/${hash.slice(3)}`);
  expect(response.ok()).toBe(true); expect(decode((await response.json()).payload)).toEqual(config);
  const receiverContext = await browser.newContext({ reducedMotion: 'reduce' });
  try {
    await useWorker(receiverContext); const receiver = await receiverContext.newPage(); await receiver.goto(url);
    await receiver.getByRole('button', { name: 'Tap to open', exact: true }).click();
    await expect(receiver.getByRole('heading', { name: config.gift.title, exact: true })).toBeVisible();
    await expect(receiver.getByRole('button', { name: 'Keep this bouquet', exact: true })).toBeEnabled();
    expect(await receiver.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
    await receiver.screenshot({ path: 'artifacts/sharing/worker-recipient.png' });
    await receiver.getByRole('button', { name: 'Open your letter', exact: true }).click(); await expect(receiver.getByRole('dialog')).toContainText('Synthetic personal note');
    await receiver.getByRole('button', { name: 'Close letter', exact: true }).click();
    await receiver.goto(shareUrl(config, url)); await receiver.getByRole('button', { name: 'Tap to open', exact: true }).click();
    await expect(receiver.getByRole('heading', { name: config.gift.title, exact: true })).toBeVisible();
    await confirmRemix(receiver);
    await expect.poll(() => receiver.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null')?.objects, DRAFT_KEY)).toEqual(config.objects);
  } finally { await receiverContext.close(); }
});
