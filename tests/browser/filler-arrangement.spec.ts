import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { clone, DRAFT_KEY, starter, type BouquetConfigV1 } from '../../src/config';
import { readyLink, sharedDesign } from './shareHelpers';

const draft = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as BouquetConfigV1, DRAFT_KEY);
const metrics = (page: Page) => page.evaluate(() => (window as unknown as { __petalpopMetrics: () => { modelBuilds: number } }).__petalpopMetrics());
async function arrange(page: Page) {
  await page.getByRole('tab', { name: 'Fillers', exact: true }).click();
  await page.getByRole('button', { name: 'Arrange fillers', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'All filler height', exact: true })).toBeVisible();
}
async function setRange(page: Page, label: string, value: string) {
  await page.getByRole('slider', { name: label, exact: true }).evaluate((input, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test('all and one filler controls preserve flower values, reset, prune and persist', async ({ page }) => {
  await mkdir('artifacts/filler-editor', { recursive: true });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  await arrange(page); const builds = (await metrics(page)).modelBuilds;
  await expect(page.getByRole('button', { name: 'Stepped filler arrangement', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await setRange(page, 'All filler height', '.32'); await setRange(page, 'All filler size', '1.2'); await setRange(page, 'All filler spread', '.8');
  await page.getByRole('button', { name: 'One filler', exact: true }).click();
  await page.getByLabel('Individual filler', { exact: true }).selectOption('eucalyptus:2');
  await setRange(page, 'Individual filler height', '.4'); await setRange(page, 'Individual filler size', '1.25');
  await setRange(page, 'Individual filler horizontal position', '-.2'); await setRange(page, 'Individual filler depth', '.15');
  await expect.poll(async () => (await draft(page)).arrangement?.fillerEdits).toEqual([{ key: 'eucalyptus:2', height: .4, size: 1.25, x: -.2, z: .15 }]);
  const saved = await draft(page); expect(saved.size).toBe(1); expect(saved.spread).toBe(1); expect(saved.arrangement?.edits).toEqual([]);
  await page.getByRole('button', { name: 'Shuffle', exact: true }).click();
  await expect.poll(async () => (await draft(page)).seed).not.toBe(saved.seed);
  expect((await draft(page)).arrangement).toEqual(saved.arrangement); expect((await metrics(page)).modelBuilds).toBe(builds);
  await page.screenshot({ path: 'artifacts/filler-editor/one-filler-desktop.png', fullPage: true });
  await page.reload(); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true', { timeout: 60000 }); await arrange(page);
  await expect(page.getByRole('slider', { name: 'All filler height', exact: true })).toHaveValue('0.32');
  await page.getByRole('button', { name: 'Reset overall height', exact: true }).click();
  await expect.poll(async () => (await draft(page)).arrangement?.fillerHeight).toBe(0); expect((await draft(page)).arrangement?.fillerEdits).toEqual(saved.arrangement?.fillerEdits);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.getByRole('slider', { name: 'All filler height', exact: true })).toHaveValue('0.32');
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect(page.getByRole('slider', { name: 'All filler height', exact: true })).toHaveValue('0');
  await page.getByRole('button', { name: 'One filler', exact: true }).click(); await page.getByLabel('Individual filler', { exact: true }).selectOption('eucalyptus:2');
  await page.getByRole('button', { name: 'Reset this filler', exact: true }).click(); await expect.poll(async () => (await draft(page)).arrangement?.fillerEdits).toEqual([]);
  await setRange(page, 'Individual filler height', '.4'); await page.getByRole('button', { name: 'Reset all filler edits', exact: true }).click();
  await expect.poll(async () => (await draft(page)).arrangement?.fillerEdits).toEqual([]); await setRange(page, 'Individual filler height', '.4');
  await page.getByRole('button', { name: 'Choose fillers', exact: true }).click(); await page.getByRole('button', { name: 'Remove one Eucalyptus', exact: true }).click();
  await expect.poll(async () => (await draft(page)).arrangement?.fillerEdits).toEqual([]);
  await page.getByRole('button', { name: 'Remove Eucalyptus', exact: true }).click(); await page.getByRole('button', { name: 'Arrange fillers', exact: true }).click();
  await page.getByRole('button', { name: 'All fillers', exact: true }).click();
  for (const label of ['All filler height', 'All filler size', 'All filler spread']) await expect(page.getByRole('slider', { name: label, exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset bouquet', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stepped filler arrangement', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider', { name: 'All filler height', exact: true })).toHaveValue('0');
  await expect(page.getByRole('slider', { name: 'All filler size', exact: true })).toHaveValue('1');
  expect(errors).toEqual([]);
});

test('preview taps select fillers and selection stays separate from blooms', async ({ page }) => {
  const config = clone(starter); config.flowers = []; config.fillers = [{ id: 'fern', count: 3, color: '#6e9a79' }];
  await page.addInitScript(({ key, config }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(config)); }, { key: DRAFT_KEY, config });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  await arrange(page); await page.getByRole('button', { name: 'One filler', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Share bouquet', exact: true })).toBeEnabled();
  await expect(page.locator('.empty-bouquet')).toHaveCount(0);
  await page.getByLabel('Individual filler', { exact: true }).selectOption('fern:0');
  await page.getByRole('button', { name: 'Show front view', exact: true }).click();
  const box = (await page.getByTestId('scene').boundingBox())!;
  const points = await page.evaluate(() => (window as unknown as { __petalpopFillerPoints: () => Record<string, [number, number]> }).__petalpopFillerPoints());
  // Fern's stalk crosses the center of its instance; tap a different visible stem.
  const key = Object.keys(points).filter(key => key !== 'fern:0').sort((a, b) => points[b][0] - points[a][0])[0];
  const offsets = [[0, 0], [3, 0], [-3, 0], [0, -5], [3, -5], [-3, -5], [0, 5], [6, 0], [-6, 0]];
  let attempt = 0;
  await expect.poll(async () => {
    const [x, y] = offsets[Math.min(attempt++, offsets.length - 1)];
    await page.mouse.click(box.x + points[key][0] + x, box.y + points[key][1] + y);
    return page.getByLabel('Individual filler', { exact: true }).inputValue();
  }, { intervals: [100, 200, 300] }).toBe(key);
  await page.getByRole('tab', { name: 'Flowers', exact: true }).click(); await page.getByRole('button', { name: 'Select Rose', exact: true }).click();
  await page.getByRole('button', { name: 'Arrange blooms', exact: true }).click(); await page.getByRole('button', { name: 'One bloom', exact: true }).click();
  await expect(page.getByLabel('Individual flower', { exact: true })).toHaveValue('rose:0');
  await page.getByRole('tab', { name: 'Fillers', exact: true }).click(); await expect(page.getByLabel('Individual filler', { exact: true })).toHaveValue(key);
});

test('filler settings survive saved and portable gifts, remix and PNG export', async ({ page, browser }) => {
  test.setTimeout(120000);
  await mkdir('artifacts/filler-editor', { recursive: true });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true', { timeout: 60000 }); await arrange(page);
  await page.getByRole('button', { name: 'Natural filler arrangement', exact: true }).click();
  await setRange(page, 'All filler height', '.7'); await setRange(page, 'All filler size', '1.2'); await setRange(page, 'All filler spread', '1.2');
  await page.getByRole('button', { name: 'One filler', exact: true }).click(); await setRange(page, 'Individual filler height', '.7'); await setRange(page, 'Individual filler size', '1.45');
  await expect.poll(async () => (await draft(page)).arrangement?.fillerEdits?.[0].size).toBe(1.45); const saved = await draft(page);
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); const short = await readyLink(page);
  expect(new URL(short).hash).toMatch(/^#s=/); expect((await sharedDesign(page, short)).arrangement).toEqual(saved.arrangement);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.route('**/api/bouquets', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); await page.getByLabel('Title', { exact: true }).fill('Fillers, arranged with love');
  const portable = await readyLink(page); expect(new URL(portable).hash).toMatch(/^#b=c\./); expect((await sharedDesign(page, portable)).arrangement).toEqual(saved.arrangement);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const receiver = await context.newPage();
  await receiver.goto(short); await receiver.getByRole('button', { name: 'Tap to open', exact: true }).click();
  await expect(receiver.getByRole('button', { name: 'Keep this bouquet', exact: true })).toBeEnabled();
  const download = receiver.waitForEvent('download'); await receiver.getByRole('button', { name: 'Keep this bouquet', exact: true }).click();
  await (await download).saveAs('artifacts/filler-editor/filler-card.png');
  expect(await receiver.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  await receiver.getByRole('button', { name: 'Remix bouquet', exact: true }).last().click();
  await expect.poll(async () => (await draft(receiver)).arrangement).toEqual(saved.arrangement); await arrange(receiver);
  await expect(receiver.getByRole('slider', { name: 'All filler height', exact: true })).toHaveValue('0.7');
  await expect(receiver.getByRole('button', { name: 'Natural filler arrangement', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await receiver.screenshot({ path: 'artifacts/filler-editor/extreme-natural-mobile.png' }); await context.close();
});

test('live touch edits keep the canvas visible, group undo and fit narrow and landscape screens', async ({ browser }) => {
  test.setTimeout(120000);
  await mkdir('artifacts/filler-editor', { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }); const page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true', { timeout: 60000 }); await arrange(page);
  await expect(page.locator('.app')).toHaveClass(/flower-workspace/); const scene = page.getByTestId('scene'), canvas = scene.locator('canvas');
  await canvas.evaluate(node => node.setAttribute('data-original-canvas', 'true')); const builds = (await metrics(page)).modelBuilds;
  const height = page.getByRole('slider', { name: 'All filler height', exact: true }); await height.scrollIntoViewIfNeeded();
  const originalBox = (await scene.boundingBox())!, before = await canvas.screenshot(), box = (await height.boundingBox())!;
  const touch = await context.newCDPSession(page); const start = box.x + box.width * .37, end = box.x + box.width * .8, y = box.y + box.height / 2;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y, id: 1 }] });
  for (let i = 1; i <= 12; i++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + (end - start) * i / 12, y, id: 1 }] });
  await expect.poll(async () => Number(await height.inputValue())).toBeGreaterThan(.3); const lifted = await height.inputValue();
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.getByRole('button', { name: 'Undo', exact: true }).tap(); await expect(height).toHaveValue('0');
  await page.getByRole('button', { name: 'Redo', exact: true }).tap(); await expect(height).toHaveValue(lifted);
  await page.getByRole('button', { name: 'One filler', exact: true }).tap(); await page.getByLabel('Individual filler', { exact: true }).selectOption('eucalyptus:1');
  const depth = page.getByRole('slider', { name: 'Individual filler depth', exact: true }); await depth.scrollIntoViewIfNeeded(); await depth.press('ArrowRight');
  expect((await scene.boundingBox())!).toEqual(originalBox); await expect(canvas).toHaveAttribute('data-original-canvas', 'true');
  for (const [width, heightPx] of [[320, 568], [390, 844], [700, 390], [844, 390]]) {
    await page.setViewportSize({ width, height: heightPx }); await depth.scrollIntoViewIfNeeded();
    const preview = (await scene.boundingBox())!, control = (await depth.boundingBox())!;
    expect(preview.y).toBeGreaterThanOrEqual(50);
    if (width > heightPx) expect(preview.x + preview.width).toBeLessThan(control.x); else expect(preview.y + preview.height).toBeLessThan(control.y);
    expect(control.y + control.height).toBeLessThan(heightPx - 69);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/filler-editor/one-filler-${width}x${heightPx}.png` });
  }
  expect((await metrics(page)).modelBuilds).toBe(builds);
  await page.getByRole('navigation', { name: 'Studio navigation' }).getByRole('button', { name: 'Gift preview', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Tap to open', exact: true })).toBeVisible(); expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await page.getByRole('button', { name: 'Back to studio', exact: true }).tap(); await expect(page.getByLabel('Individual filler', { exact: true })).toHaveValue('eucalyptus:1');
  await page.getByRole('button', { name: 'Done', exact: true }).tap(); await expect(page.locator('.app')).not.toHaveClass(/flower-workspace/);
  await expect(page.getByRole('button', { name: 'Choose fillers', exact: true })).toHaveAttribute('aria-pressed', 'true'); expect(errors).toEqual([]); await context.close();
});
