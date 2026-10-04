import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { clone, DRAFT_KEY, starter, type BouquetConfigV1 } from '../../src/config';
import { createGiftObject } from '../../src/giftCatalog';
import { readyLink, sharedDesign } from './shareHelpers';

type Metrics = { modelBuilds: number; objectBuilds: number; objects: number; calls: number; triangles: number };
async function draft(page: import('@playwright/test').Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as BouquetConfigV1, DRAFT_KEY); }
async function metrics(page: import('@playwright/test').Page) { return page.evaluate(() => (window as unknown as { __petalpopMetrics: () => Metrics }).__petalpopMetrics()); }
async function slider(page: import('@playwright/test').Page, name: string, value: string) {
  await page.getByRole('slider', { name, exact: true }).evaluate((input, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }, value);
}

test('objects add, drag, place, transform, persist, share and export with a custom frame', async ({ page, browser }) => {
  await mkdir('artifacts/objects', { recursive: true }); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('tab', { name: 'Objects', exact: true }).click();
  await page.getByRole('button', { name: 'Add Cuddle Teddy', exact: true }).click();
  await expect.poll(async () => (await metrics(page)).objects).toBe(1); await expect.poll(async () => (await draft(page)).objects.length).toBe(1);
  const initial = await draft(page), uid = initial.objects[0].uid, before = await metrics(page);
  const point = await page.evaluate(uid => (window as unknown as { __petalpopObjectPoints: () => Record<string, [number, number]> }).__petalpopObjectPoints()[uid], uid);
  const box = (await page.getByTestId('scene').boundingBox())!;
  await page.mouse.move(box.x + point[0], box.y + point[1]); await page.mouse.down(); await page.mouse.move(box.x + point[0] - 42, box.y + point[1] + 12, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => (await draft(page)).objects[0].position).not.toEqual(initial.objects[0].position);
  const moved = (await draft(page)).objects[0].position;
  await page.getByRole('button', { name: 'Tap a spot to place', exact: true }).click();
  await page.mouse.click(box.x + box.width * .72, box.y + box.height * .7);
  await expect(page.getByRole('button', { name: 'Tap a spot to place', exact: true })).toBeVisible();
  await expect.poll(async () => (await draft(page)).objects[0].position).not.toEqual(moved);
  await slider(page, 'Object horizontal position', '-1.2'); await slider(page, 'Object depth', '.45'); await slider(page, 'Object rotation', '35'); await slider(page, 'Object size', '.86');
  await expect.poll(async () => (await draft(page)).objects[0].scale).toBe(.86);
  const after = await metrics(page); expect(after.modelBuilds).toBe(before.modelBuilds); expect(after.objectBuilds).toBe(before.objectBuilds);
  for (const name of ['Heart Balloon', 'Golden Puppy', 'Ginger Kitten', 'Memory Frame']) await page.getByRole('button', { name: `Add ${name}`, exact: true }).click();
  await expect.poll(async () => (await metrics(page)).objects).toBe(5);
  const picture = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 360; const c = canvas.getContext('2d')!; c.fillStyle = '#78aaba'; c.fillRect(0, 0, 720, 360); c.fillStyle = '#d86c88'; c.fillRect(0, 0, 110, 360); c.fillStyle = '#e3b359'; c.fillRect(610, 0, 110, 360); c.fillStyle = 'white'; c.font = 'bold 44px sans-serif'; c.textAlign = 'center'; c.fillText('TOP ↑', 360, 65); c.fillText('Our little memory', 360, 190); c.fillText('BOTTOM', 360, 325); return canvas.toDataURL(); });
  await page.getByLabel('Frame picture', { exact: true }).setInputFiles({ name: 'memory.png', mimeType: 'image/png', buffer: Buffer.from(picture.split(',')[1], 'base64') });
  await page.getByRole('button', { name: 'Apply crop', exact: true }).click();
  await expect.poll(async () => (await draft(page)).objects[4].photo?.startsWith('data:image/jpeg;base64,')).toBe(true);
  await slider(page, 'Object horizontal position', '1.25'); await slider(page, 'Object depth', '.6');
  await expect.poll(async () => (await draft(page)).objects[4].position[0]).toBe(1.25);
  await page.screenshot({ path: 'artifacts/objects/editor-desktop.png', fullPage: true });
  const design = await draft(page);
  await page.reload(); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true'); await expect.poll(async () => (await metrics(page)).objects).toBe(5); expect((await draft(page)).objects).toEqual(design.objects);
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); const url = await readyLink(page); expect(url.length).toBeLessThan(60); expect((await sharedDesign(page, url)).objects).toEqual(design.objects);
  const context = await browser.newContext({ reducedMotion: 'reduce' }), receiver = await context.newPage(); const receiverErrors: string[] = []; receiver.on('pageerror', e => receiverErrors.push(e.message));
  await receiver.goto(url); await receiver.getByRole('button', { name: 'Tap to open', exact: true }).click(); await expect(receiver.getByRole('button', { name: 'Keep this bouquet', exact: true })).toBeEnabled();
  await expect.poll(async () => (await metrics(receiver)).objects).toBe(5); expect(await receiver.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  await receiver.screenshot({ path: 'artifacts/objects/shared-gift.png', fullPage: true });
  const pending = receiver.waitForEvent('download'); await receiver.getByRole('button', { name: 'Keep this bouquet', exact: true }).click(); const download = await pending; await download.saveAs('artifacts/objects/gift-card.png'); const png = await readFile('artifacts/objects/gift-card.png'); expect(png.readUInt32BE(16)).toBe(1080); expect(png.readUInt32BE(20)).toBe(1080);
  await receiver.getByRole('button', { name: 'Remix bouquet', exact: true }).last().click(); await expect.poll(async () => (await draft(receiver))?.objects).toEqual(design.objects);
  await receiver.getByRole('tab', { name: 'Objects', exact: true }).click(); await receiver.getByRole('button', { name: 'Edit Memory Frame 5', exact: true }).click(); await expect(receiver.getByRole('button', { name: 'Use sample picture', exact: true })).toBeVisible();
  await receiver.getByRole('button', { name: 'Duplicate selected object', exact: true }).click(); await expect.poll(async () => (await metrics(receiver)).objects).toBe(6); await expect(receiver.getByRole('button', { name: 'Add Cuddle Teddy', exact: true })).toBeDisabled();
  await receiver.getByRole('button', { name: 'Remove Memory Frame 6', exact: true }).click(); await expect.poll(async () => (await metrics(receiver)).objects).toBe(5);
  await receiver.setViewportSize({ width: 390, height: 844 }); await receiver.getByRole('button', { name: 'Edit Ginger Kitten 4', exact: true }).click();
  expect(await receiver.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await receiver.screenshot({ path: 'artifacts/objects/editor-mobile.png', fullPage: true });
  await writeFile('artifacts/objects/validation.json', JSON.stringify({ before, after, finalObjects: design.objects.map(({ uid, id, position, rotation, scale, photo }) => ({ uid, id, position, rotation, scale, photoLength: photo?.length ?? 0 })), sharedUrlLength: url.length, errors, receiverErrors }, null, 2));
  expect(errors).toEqual([]); expect(receiverErrors).toEqual([]); await context.close();
});

test('touch dragging works in an object-only gift and keyboard controls keep it editable', async ({ browser }) => {
  const config = clone(starter); config.flowers = []; config.fillers = []; config.objects = [createGiftObject('teddy-bear', [])];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ key, config }) => localStorage.setItem(key, JSON.stringify(config)), { key: DRAFT_KEY, config });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Share bouquet', exact: true })).toBeEnabled(); await expect(page.getByRole('button', { name: 'Save PNG', exact: true })).toBeEnabled();
  await page.getByRole('tab', { name: 'Flowers', exact: true }).press('End'); await expect(page.getByRole('tab', { name: 'Gift', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Objects', exact: true }).click(); await page.getByRole('button', { name: 'Edit Cuddle Teddy 1', exact: true }).click();
  await page.getByTestId('scene').scrollIntoViewIfNeeded();
  const initial = await draft(page), uid = initial.objects[0].uid, point = await page.evaluate(uid => (window as unknown as { __petalpopObjectPoints: () => Record<string, [number, number]> }).__petalpopObjectPoints()[uid], uid);
  const box = (await page.getByTestId('scene').boundingBox())!, x = box.x + point[0], y = box.y + point[1], scroll = await page.evaluate(() => scrollY);
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
  for (const delta of [10, 20, 30, 40]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + delta, y: y + 5, id: 0 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await draft(page)).objects[0].position).not.toEqual(initial.objects[0].position);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await page.getByRole('slider', { name: 'Object height', exact: true }).press('ArrowRight'); await expect.poll(async () => (await draft(page)).objects[0].position[1]).toBeGreaterThan(-1.5);
  await page.getByRole('button', { name: 'Set on the ground', exact: true }).click(); await expect.poll(async () => (await draft(page)).objects[0].position[1]).toBe(-1.5);
  const request = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save PNG', exact: true }).click(); await (await request).saveAs('artifacts/objects/object-only-card.png');
  expect(errors).toEqual([]); await context.close();
});
