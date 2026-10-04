import { expect, test, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { mkdir } from 'node:fs/promises';
import { clone, DRAFT_KEY, starter, type BouquetConfigV1 } from '../../src/config';
import { createGiftObject } from '../../src/giftCatalog';

const draft = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as BouquetConfigV1, DRAFT_KEY);
const guides = (page: Page) => page.evaluate(() => (window as unknown as { __petalpopMetrics: () => { groundY: number; editGrid: boolean } }).__petalpopMetrics());
async function objectPoint(page: Page, uid: string) {
  await page.getByTestId('scene').scrollIntoViewIfNeeded();
  const point = await page.evaluate(uid => (window as unknown as { __petalpopObjectPoints: () => Record<string, [number, number]> }).__petalpopObjectPoints()[uid], uid);
  const box = (await page.getByTestId('scene').boundingBox())!;
  return { x: box.x + point[0], y: box.y + point[1] };
}
async function dragObject(page: Page, uid: string, delta = 130) {
  const { x, y } = await objectPoint(page, uid);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + delta, y + 7, { steps: 12 }); await page.mouse.up();
}

test('an unselected object turns the view; only a separately selected object can move', async ({ page }) => {
  const config = clone(starter); config.flowers = []; config.fillers = [];
  config.objects = [createGiftObject('teddy-bear', [])];
  await page.addInitScript(({ key, config }) => localStorage.setItem(key, JSON.stringify(config)), { key: DRAFT_KEY, config });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Show front view', exact: true }).click();
  const object = config.objects[0];
  await dragObject(page, object.uid);
  await expect(page.locator('.front-guide strong')).not.toHaveText('Front');
  expect((await draft(page)).objects).toEqual(config.objects);
  await expect(page.getByRole('tab', { name: 'Flowers', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Show front view', exact: true }).click();
  const point = await objectPoint(page, object.uid); await page.mouse.click(point.x, point.y);
  await expect(page.getByRole('button', { name: 'Edit Cuddle Teddy 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect((await draft(page)).objects[0].position).toEqual(object.position);
  await dragObject(page, object.uid, 36);
  await expect.poll(async () => (await draft(page)).objects[0].position).not.toEqual(object.position);
  await expect(page.locator('.front-guide strong')).toHaveText('Front');
  await page.getByRole('button', { name: 'Add Golden Puppy', exact: true }).click();
  const before = await draft(page);
  await dragObject(page, object.uid);
  await expect(page.getByRole('button', { name: 'Edit Golden Puppy 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect((await draft(page)).objects).toEqual(before.objects);
});

test('frame addition opens a dismissible chooser immediately and selected photos can be cropped', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await mkdir('artifacts/object-editing', { recursive: true });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('tab', { name: 'Objects', exact: true }).click();
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('button', { name: 'Add Memory Frame', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Choose frame picture', exact: true });
    await expect(dialog).toBeVisible(); await expect(dialog.getByRole('button', { name: 'Change picture', exact: true })).toBeFocused();
    await expect.poll(async () => dialog.locator('canvas').evaluate(node => (node as HTMLCanvasElement).width)).toBe(512);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth && node.getBoundingClientRect().right <= innerWidth)).toBe(true);
    await dialog.screenshot({ path: `artifacts/object-editing/frame-dialog-${width}.png` });
    if (width === 320) await page.keyboard.press('Escape');
    else await dialog.getByRole('button', { name: 'Keep sample picture', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  await expect.poll(async () => (await draft(page)).objects.length).toBe(3);
  expect((await draft(page)).objects.every(o => !o.photo)).toBe(true);
  await page.getByRole('button', { name: 'Add Landscape Frame', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Choose frame picture', exact: true });
  const picture = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 200; const c = canvas.getContext('2d')!; c.fillStyle = '#82a9a8'; c.fillRect(0, 0, 400, 200); return canvas.toDataURL(); });
  await chooser.getByLabel('Frame picture', { exact: true }).setInputFiles({ name: 'moment.png', mimeType: 'image/png', buffer: Buffer.from(picture.split(',')[1], 'base64') });
  const crop = page.getByRole('dialog', { name: 'Crop frame picture', exact: true }); await expect(crop).toBeVisible();
  await crop.getByRole('button', { name: 'Cancel cropping', exact: true }).click();
  await expect(chooser).toBeVisible(); expect((await draft(page)).objects[3].photo).toBeUndefined();
  await chooser.getByLabel('Frame picture', { exact: true }).setInputFiles({ name: 'moment.png', mimeType: 'image/png', buffer: Buffer.from(picture.split(',')[1], 'base64') });
  await crop.getByRole('button', { name: 'Apply crop', exact: true }).click();
  await expect(chooser).toHaveCount(0); await expect(crop).toHaveCount(0);
  await expect.poll(async () => (await draft(page)).objects[3].photo).toMatch(/^data:image\/jpeg;base64,/);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe(''); expect(errors).toEqual([]);
});

test('ground guides remain during editing and disappear from gift viewing and PNG capture', async ({ page }) => {
  await mkdir('artifacts/object-editing', { recursive: true });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  expect(await guides(page)).toMatchObject({ groundY: -1.5, editGrid: true });
  await page.getByTestId('scene').screenshot({ path: 'artifacts/object-editing/grid-before-objects.png' });
  await page.getByRole('tab', { name: 'Objects', exact: true }).click();
  await page.getByRole('button', { name: 'Add Cuddle Teddy', exact: true }).click();
  await page.getByRole('tab', { name: 'Wrap', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Show bottom stems', exact: true }).check();
  await expect.poll(async () => (await draft(page)).arrangement?.showStems).toBe(true);
  await expect.poll(async () => (await guides(page)).groundY).toBe(-1.84);
  expect((await guides(page)).editGrid).toBe(true);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await page.getByTestId('scene').screenshot({ path: 'artifacts/object-editing/stem-ground.png' });
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save PNG', exact: true }).click(); await (await download).saveAs('artifacts/object-editing/stem-ground-card.png');
  await page.getByRole('button', { name: 'Preview gift', exact: true }).click();
  await page.getByRole('button', { name: 'Tap to open', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Keep this bouquet', exact: true })).toBeEnabled();
  await expect.poll(async () => (await guides(page))?.editGrid).toBe(false);
  await page.locator('.gift-scene').screenshot({ path: 'artifacts/object-editing/gift-without-grid.png' });
});
