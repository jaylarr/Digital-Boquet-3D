import { expect, test } from '@playwright/test';
import { clone, DRAFT_KEY, starter, type BouquetConfigV1 } from '../../src/config';
import { readyLink, sharedDesign } from './shareHelpers';

test('surprise preserves real photos and letters, groups history, and survives drafts, sharing and export', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const photo = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#dd88aa'; ctx.fillRect(0, 0, 32, 32); return canvas.toDataURL('image/jpeg', .5); });
  const input = clone(starter);
  input.objects = [
    { uid: 'my-photo', id: 'golden-frame', position: [-1.8, -1.5, .8], rotation: 0, scale: .6, photo, frameOrientation: 'landscape', crop: { mode: 'fill', zoom: 1.2, x: .1, y: -.2 } },
    { uid: 'my-letter', id: 'sealed-envelope', position: [1.8, -1.5, .8], rotation: 0, scale: .6, note: { align: 'center', runs: [{ text: 'With love 🌷', bold: true, underline: true, color: '#aa6677' }] } },
    { uid: 'old-teddy', id: 'teddy-bear', position: [0, -1.5, 2], rotation: 0, scale: .7 },
  ];
  await page.addInitScript(({ key, input }) => {
    if (!sessionStorage.getItem('surprise-fixture-loaded')) { localStorage.setItem(key, JSON.stringify(input)); sessionStorage.setItem('surprise-fixture-loaded', 'true'); }
  }, { key: DRAFT_KEY, input });
  await page.reload(); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as BouquetConfigV1, DRAFT_KEY);
  await expect.poll(saved).toEqual(input);
  await page.getByRole('button', { name: 'Surprise me', exact: true }).tap();
  await expect.poll(async () => (await saved()).seed).not.toBe(input.seed);
  const result = await saved();
  for (const original of input.objects.slice(0, 2)) expect(result.objects.find(o => o.uid === original.uid)).toMatchObject({ ...original, position: expect.any(Array), rotation: expect.any(Number) });
  expect(result.objects.some(o => o.uid === 'old-teddy')).toBe(false); expect(result.objects.length).toBeLessThanOrEqual(3);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Studio navigation' }).getByRole('button', { name: 'Customize', exact: true }).tap();
  await page.getByRole('button', { name: 'Undo', exact: true }).tap(); await expect.poll(saved).toEqual(input);
  await page.getByRole('button', { name: 'Redo', exact: true }).tap(); await expect.poll(saved).toEqual(result);
  await page.reload(); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true'); await expect.poll(saved).toEqual(result);
  await page.screenshot({ path: 'artifacts/pinned-studio/surprise-personal-390.png' });
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).tap();
  const short = await readyLink(page); expect((await sharedDesign(page, short)).objects).toEqual(result.objects);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).tap();
  await page.route('**/api/bouquets', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).tap(); await page.getByLabel('Title', { exact: true }).fill('A surprise for you');
  const portable = await readyLink(page); expect(new URL(portable).hash).toMatch(/^#b=c\./); expect((await sharedDesign(page, portable)).objects).toEqual(result.objects);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).tap();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save PNG', exact: true }).tap();
  await (await download).saveAs('artifacts/pinned-studio/surprise.png');
  const recipient = await context.newPage(); await recipient.goto(short); await recipient.getByRole('button', { name: 'Tap to open', exact: true }).tap();
  await expect(recipient.locator('.gift-scene canvas')).toBeVisible(); await expect(recipient.getByRole('button', { name: 'Keep this bouquet', exact: true })).toBeEnabled();
  await expect(recipient.getByRole('button', { name: 'Open your letter', exact: true })).toBeVisible();
  await recipient.getByRole('button', { name: 'Open your letter', exact: true }).tap(); await expect(recipient.getByRole('dialog')).toContainText('With love 🌷');
  expect(errors).toEqual([]); await context.close();
});
