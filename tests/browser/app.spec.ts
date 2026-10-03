import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import LZString from 'lz-string';
import { clone, encode, starter, DRAFT_KEY, decode } from '../../src/config';

test('all 50 original variants render, and the editor fits phone through desktop', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  const sheet: { category: string; name: string; src: string }[] = [];
  for (const name of ['Flowers', 'Fillers', 'Wrap', 'Ribbon', 'Effects']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.locator('.catalog-card')).toHaveCount(10);
    await expect.poll(() => page.locator('.catalog-card img').evaluateAll(images => images.filter(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0).length)).toBe(10);
    sheet.push(...await page.locator('.catalog-card').evaluateAll((cards, category) => cards.map(card => ({ category, name: card.querySelector('.item-name')!.textContent!, src: (card.querySelector('img') as HTMLImageElement).src })), name));
  }
  await mkdir('artifacts', { recursive: true });
  // A contact sheet of actual 3D thumbnails makes the complete catalog reviewable without 50 live canvases.
  const gallery = await page.context().newPage();
  await gallery.setContent(`<html><body style="margin:0;padding:30px;background:#faf7f2;font:14px system-ui;color:#493e46"><h1 style="margin:0 0 24px">PetalPop 3D · 50 original variants</h1>${['Flowers', 'Fillers', 'Wrap', 'Ribbon', 'Effects'].map(category => `<h2>${category}</h2><div style="display:grid;grid-template-columns:repeat(10,1fr);gap:10px">${sheet.filter(item => item.category === category).map(item => `<div style="text-align:center;padding:8px;background:#fff;border:1px solid #eadfe5;border-radius:14px"><img width="95" height="95" src="${item.src}"/><div>${item.name}</div></div>`).join('')}</div>`).join('')}</body></html>`);
  await gallery.setViewportSize({ width: 1440, height: 1080 }); await gallery.screenshot({ path: 'artifacts/catalog.png', fullPage: true }); await gallery.close();
  await page.getByRole('tab', { name: 'Flowers', exact: true }).click();
  for (const width of [320, 390, 768, 1280]) { await page.setViewportSize({ width, height: width < 760 ? 844 : 960 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await expect(page.getByRole('button', { name: 'Share bouquet' })).toBeVisible(); if (width === 390) await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true }); }
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('enforces mix and quantity limits, supports palettes, presets and keyboard tabs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Select Sunflower', exact: true }).click(); await page.getByRole('button', { name: 'Select Peony', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select Lily', exact: true })).toBeDisabled();
  for (let i = 0; i < 13; i++) await page.getByRole('button', { name: 'Add one Rose', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add one Rose', exact: true })).toBeDisabled();
  await expect(page.locator('.limit-pill')).toHaveText('24/24');
  await page.getByRole('button', { name: 'Apply Cloud nine palette' }).click(); await expect(page.locator('.palette-name')).toHaveText('Cloud nine');
  await page.getByRole('tab', { name: 'Flowers', exact: true }).press('ArrowRight'); await expect(page.getByRole('tab', { name: 'Fillers', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Select Fern', exact: true }).click(); await page.getByRole('button', { name: 'Select Ivy', exact: true }).click(); await expect(page.getByRole('button', { name: 'Select Wheat Sprigs', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: 'Effects', exact: true }).click(); await page.getByRole('button', { name: 'Select Sparkles', exact: true }).click(); await page.getByRole('button', { name: 'Select Floating Hearts', exact: true }).click(); await expect(page.getByRole('button', { name: 'Select Bubble Drift', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Start with a preset' }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('button', { name: 'Cosmic crush Out of this world' }).click(); await expect(page.locator('.palette-name')).toHaveText('Cloud nine');
});

test('shared URLs reconstruct gifts in a fresh context and preserve the recipient’s draft until Remix', async ({ page, browser }) => {
  await page.goto('/'); await page.getByRole('tab', { name: 'Gift', exact: true }).click();
  await page.getByLabel('For', { exact: true }).fill('小花 🌷'); await page.getByLabel('From', { exact: true }).fill('Arjay'); await page.getByLabel('Your little note').fill('A little joy for you! 🌸\n你好 — happy birthday.');
  await page.getByRole('button', { name: 'Share bouquet' }).click(); const url = await page.locator('.share-link').inputValue();
  const source = decode(new URL(url).hash.slice(3)); expect(source.gift.to).toBe('小花 🌷');
  const context = await browser.newContext({ reducedMotion: 'reduce' }); const receiver = await context.newPage(); await receiver.goto(url);
  await expect(receiver.getByRole('button', { name: 'Tap to open' })).toBeVisible(); expect(await receiver.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  await receiver.getByRole('button', { name: 'Tap to open' }).click(); await expect(receiver.getByText(source.gift.message, { exact: true })).toBeVisible(); await expect(receiver.getByRole('button', { name: 'Keep this bouquet' })).toBeEnabled();
  expect(await receiver.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  await receiver.evaluate(({ key, draft }) => localStorage.setItem(key, JSON.stringify(draft)), { key: DRAFT_KEY, draft: starter }); await receiver.reload(); await receiver.getByRole('button', { name: 'Tap to open' }).click();
  expect(JSON.parse((await receiver.evaluate(key => localStorage.getItem(key), DRAFT_KEY))!)).toEqual(starter);
  await receiver.getByRole('button', { name: 'Remix bouquet', exact: true }).last().click();
  await expect.poll(() => receiver.evaluate(key => JSON.parse(localStorage.getItem(key)!).gift.to, DRAFT_KEY)).toBe('小花 🌷');
  expect(new URL(receiver.url()).hash).toBe(''); await receiver.reload(); await receiver.getByRole('tab', { name: 'Gift', exact: true }).click(); await expect(receiver.getByLabel('For', { exact: true })).toHaveValue('小花 🌷'); await context.close();
});

test('malformed and future links recover without deleting drafts', async ({ page }) => {
  await page.goto('/'); await expect.poll(() => page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).not.toBeNull();
  const old = await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY);
  for (const hash of ['!bad', LZString.compressToEncodedURIComponent(JSON.stringify({ ...starter, version: 2 }))]) { await page.goto(`/#b=${hash}`); await expect(page.getByRole('alert')).toBeVisible(); expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBe(old); await page.getByRole('button', { name: 'Open studio' }).click(); await expect(page.getByRole('alert')).toHaveCount(0); }
});

test('downloads a 1080-square gift card, including the maximum Unicode note', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Save PNG', exact: true })).toBeEnabled();
  await page.getByRole('tab', { name: 'Gift', exact: true }).click(); await page.getByLabel('For', { exact: true }).fill('小花 🌷'); await page.getByLabel('From', { exact: true }).fill('Arjay'); await page.getByLabel('Your little note').fill('A little joy for you. You make the world bloom! 🌸');
  let download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save PNG', exact: true }).click(); await mkdir('artifacts', { recursive: true }); await (await download).saveAs('artifacts/gift-card.png');
  const data = await readFile('artifacts/gift-card.png'); expect(data.readUInt32BE(16)).toBe(1080); expect(data.readUInt32BE(20)).toBe(1080); expect(data.length).toBeGreaterThan(20000);
  await page.getByLabel('For', { exact: true }).fill('你'.repeat(50)); await page.getByLabel('From', { exact: true }).fill('🌷'.repeat(50)); await page.getByLabel('Your little note').fill('花'.repeat(500));
  download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save PNG', exact: true }).click(); await (await download).saveAs('artifacts/gift-card-long-note.png');
  await page.getByRole('button', { name: 'Preview gift', exact: true }).click(); await page.getByRole('button', { name: 'Tap to open' }).click(); await expect(page.getByRole('button', { name: 'Keep this bouquet' })).toBeEnabled();
});

test('reduced motion, denied storage and clipboard, and missing WebGL remain usable', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' }); const page = await context.newPage();
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } } }); const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) { if (type.startsWith('webgl')) return null; return Reflect.apply(original, this, [type, ...args]); } as typeof original; });
  await page.goto('/'); await expect(page.getByText('The 3D preview is unavailable')).toBeVisible(); await expect(page.getByRole('button', { name: 'Save PNG', exact: true })).toBeDisabled(); await expect(page.getByRole('button', { name: 'Pause motion' })).toBeDisabled(); await expect(page.getByText('Keep your bouquet with a link')).toBeVisible();
  await page.getByRole('button', { name: 'Share bouquet' }).click(); await page.getByRole('button', { name: 'Copy link', exact: true }).click(); await expect(page.getByRole('status')).toHaveText(/Select and copy/); await expect(page.locator('.share-link')).toBeFocused(); await context.close();
});

test('maximum bouquet uses bounded draw calls and records software-rendered performance', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const config = { ...clone(starter), flowers: [{ id: 'hydrangea', count: 24, color: '#9fbde0' }], fillers: [{ id: 'babys-breath', count: 12, color: '#fff6e7' }], effects: ['butterflies', 'rainbow'], size: 1.2, spread: 1.2 };
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`/#b=${encode(config)}`); await page.getByRole('button', { name: 'Tap to open' }).click();
  await expect(page.getByRole('button', { name: 'Keep this bouquet' })).toBeEnabled();
  await page.waitForTimeout(12000);
  const metrics = await page.evaluate(() => (window as unknown as { __petalpopMetrics: () => { calls: number; triangles: number; fps: number } }).__petalpopMetrics());
  expect(metrics.calls).toBeLessThan(50); expect(metrics.triangles).toBeLessThan(150000);
  await writeFile(path.join('artifacts', 'performance.json'), JSON.stringify({ environment: 'Headless Chromium, SwiftShader software GPU, 390×844 viewport; not a physical phone', ...metrics }, null, 2));
  await page.screenshot({ path: 'artifacts/maximum-mobile.png', fullPage: true });
});

test('camera rotation, zoom, reset and mobile pinch work without scrolling the page', async ({ page, browser }) => {
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  const scene = page.getByTestId('scene'), box = (await scene.boundingBox())!, original = await scene.screenshot();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 85, box.y + box.height / 2 + 25, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(800);
  const turned = await scene.screenshot(); expect(turned.equals(original)).toBe(false);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click(); await page.waitForTimeout(500); const reset = await scene.screenshot(); expect(reset.equals(turned)).toBe(false);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -220); await page.waitForTimeout(500); expect((await scene.screenshot()).equals(reset)).toBe(false);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' }); const phone = await context.newPage();
  await phone.goto('/'); await expect(phone.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  const phoneScene = phone.getByTestId('scene'), bounds = (await phoneScene.boundingBox())!, before = await phoneScene.screenshot(), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  const session = await context.newCDPSession(phone);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 35, y, id: 0 }, { x: x + 35, y, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 65, y, id: 0 }, { x: x + 65, y, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await phone.waitForTimeout(600);
  expect((await phoneScene.screenshot()).equals(before)).toBe(false); expect(await phone.evaluate(() => window.scrollY)).toBe(0); await context.close();
});
