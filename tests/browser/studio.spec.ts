import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { DRAFT_KEY, clone, starter, type BouquetConfigV1 } from '../../src/config';
import { readyLink, sharedDesign } from './shareHelpers';
async function draft(page: Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as BouquetConfigV1, DRAFT_KEY); }
async function setRange(page: Page, label: string, value: string) {
  await page.getByRole('slider', { name: label, exact: true }).evaluate((input, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }, value);
}
test('history groups real object drags, restores removal and colors, and supports shortcuts and branching', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Add one Rose', exact: true }).click(); await expect(page.getByLabel('Rose quantity')).toHaveText('4');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.getByLabel('Rose quantity')).toHaveText('3');
  await page.getByRole('button', { name: 'Redo', exact: true }).press('Control+Shift+Z'); await expect(page.getByLabel('Rose quantity')).toHaveText('4');
  await page.getByRole('tab', { name: 'Objects', exact: true }).click(); await page.getByRole('button', { name: 'Add Cuddle Teddy', exact: true }).click();
  await expect.poll(async () => (await draft(page)).objects.length).toBe(1); const original = (await draft(page)).objects[0];
  const point = await page.evaluate(uid => (window as unknown as { __petalpopObjectPoints: () => Record<string, [number, number]> }).__petalpopObjectPoints()[uid], original.uid);
  const box = (await page.getByTestId('scene').boundingBox())!; await page.mouse.move(box.x + point[0], box.y + point[1]); await page.mouse.down(); await page.mouse.move(box.x + point[0] + 85, box.y + point[1] + 12, { steps: 16 }); await page.mouse.up();
  const displayedPosition = await page.locator('.object-position-controls output').allTextContents();
  await expect.poll(async () => (await draft(page)).objects[0].position.map(n => n.toFixed(2))).toEqual(displayedPosition); const moved = (await draft(page)).objects[0].position; expect(moved).not.toEqual(original.position);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect.poll(async () => (await draft(page)).objects[0].position).toEqual(original.position);
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect.poll(async () => (await draft(page)).objects[0].position).toEqual(moved);
  const builds = await page.evaluate(() => (window as unknown as { __petalpopMetrics: () => { objectBuilds: number } }).__petalpopMetrics().objectBuilds);
  await expect(page.locator('.object-color-row')).toContainText('Color');
  await page.getByLabel('Cuddle Teddy color', { exact: true }).evaluate(input => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '#b18acf'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect.poll(async () => (await draft(page)).objects[0].color).toBe('#b18acf');
  expect(await page.evaluate(() => (window as unknown as { __petalpopMetrics: () => { objectBuilds: number } }).__petalpopMetrics().objectBuilds)).toBe(builds);
  await page.getByRole('button', { name: 'Remove Cuddle Teddy 1', exact: true }).click(); await expect(page.getByRole('button', { name: 'Edit Cuddle Teddy 1', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.getByRole('button', { name: 'Edit Cuddle Teddy 1', exact: true })).toBeVisible();
  await expect.poll(async () => (await draft(page)).objects[0].color).toBe('#b18acf');
  await page.getByRole('button', { name: 'Add Golden Puppy', exact: true }).click(); await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
  await mkdir('artifacts/studio', { recursive: true }); await page.screenshot({ path: 'artifacts/studio/editor-desktop.png', fullPage: true });
});
test('cropping keeps a framed preview and source, persists the crop, and shares an immutable tiny link', async ({ page, browser }) => {
  await mkdir('artifacts/studio', { recursive: true }); await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('tab', { name: 'Objects', exact: true }).click(); await page.getByRole('button', { name: 'Add Memory Frame', exact: true }).click();
  const picture = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 360; const c = canvas.getContext('2d')!; c.fillStyle = '#df526d'; c.fillRect(0, 0, 240, 360); c.fillStyle = '#65b1c2'; c.fillRect(240, 0, 240, 360); c.fillStyle = '#e7bb55'; c.fillRect(480, 0, 240, 360); return canvas.toDataURL(); });
  const file = { name: 'crop-memory.png', mimeType: 'image/png', buffer: Buffer.from(picture.split(',')[1], 'base64') };
  await page.getByLabel('Frame picture', { exact: true }).setInputFiles(file); let editor = page.getByRole('dialog', { name: 'Crop frame picture', exact: true }); await expect(editor).toBeVisible();
  await expect.poll(async () => (await draft(page)).objects[0].photo).toBeUndefined(); await editor.getByRole('button', { name: 'Cancel cropping', exact: true }).click();
  await page.getByLabel('Frame picture', { exact: true }).setInputFiles(file); editor = page.getByRole('dialog', { name: 'Crop frame picture', exact: true }); await editor.getByRole('button', { name: 'Fill the frame', exact: true }).click(); await setRange(page, 'Crop zoom', '2');
  const preview = editor.getByRole('img', { name: /^Framed crop preview/ }); await preview.press('ArrowRight'); await preview.press('ArrowRight');
  const cropBox = (await preview.boundingBox())!; await page.mouse.move(cropBox.x + cropBox.width * .5, cropBox.y + cropBox.height * .5); await page.mouse.down(); await page.mouse.move(cropBox.x + cropBox.width * .8, cropBox.y + cropBox.height * .5, { steps: 6 }); await page.mouse.up();
  expect(await editor.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true); await editor.screenshot({ path: 'artifacts/studio/crop-mobile.png' });
  await editor.getByRole('button', { name: 'Apply crop', exact: true }).click(); await expect.poll(async () => (await draft(page)).objects[0].crop?.zoom).toBe(2);
  const saved = (await draft(page)).objects[0]; expect(saved.crop?.x).toBeGreaterThan(.1); expect(saved.photo).toMatch(/^data:image\/jpeg;base64,/);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect.poll(async () => (await draft(page)).objects[0].photo).toBeUndefined();
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect.poll(async () => (await draft(page)).objects[0].crop).toEqual(saved.crop);
  await page.getByRole('button', { name: 'Adjust crop', exact: true }).click(); await expect(page.getByRole('slider', { name: 'Crop zoom', exact: true })).toHaveValue('2'); await page.getByRole('button', { name: 'Cancel cropping', exact: true }).click();
  await page.reload(); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true'); await expect.poll(async () => (await draft(page)).objects[0]).toEqual(saved);
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); const url = await readyLink(page); expect(url.length).toBeLessThan(60); expect((await sharedDesign(page, url)).objects[0]).toEqual(saved); await page.getByRole('dialog').screenshot({ path: 'artifacts/studio/short-link-mobile.png' });
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click(); await page.getByRole('tab', { name: 'Gift', exact: true }).click(); await page.getByLabel('Title', { exact: true }).fill('A later change');
  const context = await browser.newContext({ reducedMotion: 'reduce' }), receiver = await context.newPage(); await receiver.goto(url); await receiver.getByRole('button', { name: 'Tap to open', exact: true }).click(); await expect(receiver.getByRole('button', { name: 'Keep this bouquet', exact: true })).toBeEnabled();
  expect(await receiver.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull(); await receiver.getByRole('button', { name: 'Remix bouquet', exact: true }).last().click(); await expect.poll(async () => (await draft(receiver))?.objects[0]).toEqual(saved); expect((await draft(receiver)).gift.title).toBe('');
  await writeFile('artifacts/studio/features.json', JSON.stringify({ shortUrlLength: url.length, sourcePhotoLength: saved.photo?.length, crop: saved.crop, errors }, null, 2)); expect(errors).toEqual([]); await context.close();
});
test('the direction guide follows camera rotation and aligns the front; failed services keep portable sharing', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Show front view', exact: true }).click(); await expect(page.locator('.front-guide')).toContainText('Viewing: Front');
  const box = (await page.getByTestId('scene').boundingBox())!; await page.mouse.move(box.x + box.width * .6, box.y + box.height * .65); await page.mouse.down(); await page.mouse.move(box.x + box.width * .9, box.y + box.height * .65, { steps: 12 }); await page.mouse.up();
  await expect(page.locator('.front-guide strong')).not.toHaveText('Front'); await page.getByRole('button', { name: 'Show front view', exact: true }).click(); await expect(page.locator('.front-guide strong')).toHaveText('Front');
  await page.route('**/api/bouquets', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })); await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); const url = await readyLink(page); expect(new URL(url).hash).toMatch(/^#b=c\./); expect(await sharedDesign(page, url)).toEqual(clone(starter)); await expect(page.locator('.link-status')).toContainText('Portable link ready');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click(); await page.goto('/#s=0000000000000000'); await expect(page.getByRole('alert')).toContainText('could not be found'); await expect(page.getByRole('button', { name: 'Share bouquet', exact: true })).toBeEnabled();
});
