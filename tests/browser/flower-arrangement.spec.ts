import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { clone, DRAFT_KEY, starter, type BouquetConfigV1 } from '../../src/config';
import { layout } from '../../src/layout';
import { readyLink, sharedDesign } from './shareHelpers';

const draft = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as BouquetConfigV1, DRAFT_KEY);
async function setRange(page: Page, label: string, value: string) {
  await page.getByRole('slider', { name: label, exact: true }).evaluate((input, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }, value);
}
const metrics = (page: Page) => page.evaluate(() => (window as unknown as { __petalpopMetrics: () => { modelBuilds: number; active: number } }).__petalpopMetrics());
async function point(page: Page, key: string) {
  const p = await page.evaluate(key => (window as unknown as { __petalpopFlowerPoints: () => Record<string, [number, number]> }).__petalpopFlowerPoints()[key], key);
  const box = (await page.getByTestId('scene').boundingBox())!; return { x: box.x + p[0], y: box.y + p[1] };
}

test('stepped heights and individual edits persist, undo, shuffle and select the actual bloom without rebuilding', async ({ page }) => {
  await mkdir('artifacts/arrangement', { recursive: true }); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const c = clone(starter); c.flowers = [{ id: 'rose', count: 8, color: '#e886a3' }]; c.fillers = [];
  await page.addInitScript(({ key, c }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(c)); }, { key: DRAFT_KEY, c });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  const builds = (await metrics(page)).modelBuilds;
  await page.getByRole('button', { name: 'Arrange blooms', exact: true }).click(); await page.getByRole('button', { name: 'One bloom', exact: true }).click();
  await page.getByRole('button', { name: 'Stepped bouquet arrangement', exact: true }).click();
  await expect.poll(async () => (await draft(page)).arrangement?.profile).toBe('stepped');
  await page.getByLabel('Individual flower', { exact: true }).selectOption('rose:1');
  await setRange(page, 'Individual flower height', '.32');
  await expect.poll(async () => (await draft(page)).arrangement?.edits[0]?.height).toBe(.32);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.getByRole('slider', { name: 'Individual flower height', exact: true })).toHaveValue('0');
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect(page.getByRole('slider', { name: 'Individual flower height', exact: true })).toHaveValue('0.32');
  await setRange(page, 'Individual flower size', '1.25'); await setRange(page, 'Individual flower horizontal position', '-.2'); await setRange(page, 'Individual flower depth', '.15');
  await expect.poll(async () => (await draft(page)).arrangement?.edits[0]).toEqual({ key: 'rose:1', height: .32, size: 1.25, x: -.2, z: .15 });
  const settings = (await draft(page)).arrangement; await page.getByRole('button', { name: 'Shuffle', exact: true }).click();
  await expect.poll(async () => (await draft(page)).seed).not.toBe(c.seed); expect((await draft(page)).arrangement).toEqual(settings);
  await expect(page.getByLabel('Individual flower', { exact: true })).toHaveValue('rose:1');
  expect((await metrics(page)).modelBuilds).toBe(builds);
  await page.getByRole('button', { name: 'Show front view', exact: true }).click();
  const front = layout(await draft(page)).flowers.sort((a, b) => b.position[2] - a.position[2])[0].key!;
  await page.getByLabel('Individual flower', { exact: true }).selectOption(front === 'rose:0' ? 'rose:7' : 'rose:0');
  const p = await point(page, front); await page.mouse.click(p.x, p.y); await expect(page.getByLabel('Individual flower', { exact: true })).toHaveValue(front);
  // A moved bloom outside its previous sphere must remain raycastable.
  await setRange(page, 'Individual flower height', '.7'); await setRange(page, 'Individual flower horizontal position', '.45');
  await page.getByLabel('Individual flower', { exact: true }).selectOption(front === 'rose:0' ? 'rose:7' : 'rose:0');
  const moved = await point(page, front); await page.mouse.click(moved.x, moved.y); await expect(page.getByLabel('Individual flower', { exact: true })).toHaveValue(front);
  await page.getByLabel('Show bottom stems', { exact: true }).check();
  await page.screenshot({ path: 'artifacts/arrangement/editor-desktop.png', fullPage: true });
  const final = await draft(page); await page.reload(); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  expect((await draft(page)).arrangement).toEqual(final.arrangement); expect(errors).toEqual([]);
});

test('stem visibility excludes bags and exact arrangements survive short links, portable links, remix and PNG', async ({ page, browser }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('tab', { name: 'Wrap', exact: true }).click(); const stems = page.getByLabel('Show bottom stems', { exact: true }); await expect(stems).not.toBeChecked(); await stems.check();
  await page.getByRole('button', { name: 'Select Mini Gift Bag', exact: true }).click(); await expect(stems).toHaveCount(0); await expect(page.getByText('The bag keeps its stems inside.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Select Classic Cone', exact: true }).click(); await expect(stems).toBeChecked(); await stems.uncheck(); await stems.check();
  await page.getByRole('tab', { name: 'Flowers', exact: true }).click(); await page.getByRole('button', { name: 'Arrange blooms', exact: true }).click(); await page.getByRole('button', { name: 'One bloom', exact: true }).click();
  await page.getByRole('button', { name: 'Stepped bouquet arrangement', exact: true }).click(); await page.getByLabel('Individual flower', { exact: true }).selectOption('rose:0'); await setRange(page, 'Individual flower height', '.45'); await setRange(page, 'Individual flower size', '1.35');
  await expect.poll(async () => (await draft(page)).arrangement?.edits[0]?.size).toBe(1.35); const saved = await draft(page);
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); const url = await readyLink(page); expect(new URL(url).hash).toMatch(/^#s=/); expect((await sharedDesign(page, url)).arrangement).toEqual(saved.arrangement);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click(); await page.route('**/api/bouquets', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); await page.getByLabel('Title', { exact: true }).fill('A stepped little bouquet'); const portable = await readyLink(page); expect(new URL(portable).hash).toMatch(/^#b=c\./); expect((await sharedDesign(page, portable)).arrangement).toEqual(saved.arrangement);
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } }), receiver = await context.newPage(); receiver.on('pageerror', e => errors.push(e.message));
  await receiver.goto(url); await receiver.getByRole('button', { name: 'Tap to open', exact: true }).click(); await expect(receiver.getByRole('button', { name: 'Keep this bouquet', exact: true })).toBeEnabled();
  expect(await receiver.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  await receiver.screenshot({ path: 'artifacts/arrangement/gift-mobile.png', fullPage: true });
  const pending = receiver.waitForEvent('download'); await receiver.getByRole('button', { name: 'Keep this bouquet', exact: true }).click(); await (await pending).saveAs('artifacts/arrangement/stepped-card.png');
  await receiver.getByRole('button', { name: 'Remix bouquet', exact: true }).last().click(); await expect.poll(async () => (await draft(receiver))?.arrangement).toEqual(saved.arrangement);
  await writeFile('artifacts/arrangement/sharing.json', JSON.stringify({ shortUrlLength: url.length, arrangement: saved.arrangement, errors }, null, 2)); expect(errors).toEqual([]); await context.close();
});

test('mobile controls fit, keyboard edits and resets work, and removed flowers lose their adjustments', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true'); await page.getByRole('button', { name: 'Arrange blooms', exact: true }).click(); await page.getByRole('button', { name: 'One bloom', exact: true }).click();
  for (const width of [320, 390, 768, 1280]) { await page.setViewportSize({ width, height: 844 }); await expect(page.getByLabel('Individual flower', { exact: true })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByLabel('Individual flower', { exact: true }).selectOption('rose:2');
  const height = page.getByRole('slider', { name: 'Individual flower height', exact: true }); await height.focus(); await height.press('ArrowRight'); await height.press('ArrowRight'); await expect(height).toHaveValue('0.02');
  await page.getByRole('button', { name: 'Reset this flower', exact: true }).click(); await expect(height).toHaveValue('0');
  await setRange(page, 'Individual flower height', '.5'); await page.getByLabel('Individual flower', { exact: true }).selectOption('tulip:0'); await setRange(page, 'Individual flower size', '.6');
  await expect.poll(async () => (await draft(page)).arrangement?.edits.length).toBe(2); await page.getByRole('button', { name: 'Reset all flower edits', exact: true }).click(); await expect.poll(async () => (await draft(page)).arrangement?.edits).toEqual([]);
  await page.getByLabel('Individual flower', { exact: true }).selectOption('rose:2'); await setRange(page, 'Individual flower height', '.5');
  await page.getByRole('button', { name: 'Done', exact: true }).click(); await page.getByRole('button', { name: 'Remove one Rose', exact: true }).click(); await expect.poll(async () => (await draft(page)).arrangement?.edits).toEqual([]);
  await page.getByRole('button', { name: 'Add one Rose', exact: true }).click(); await page.getByRole('button', { name: 'Arrange blooms', exact: true }).click(); await page.getByRole('button', { name: 'One bloom', exact: true }).click(); await page.getByLabel('Individual flower', { exact: true }).selectOption('rose:2'); await expect(height).toHaveValue('0');
  await page.getByRole('button', { name: 'Stepped bouquet arrangement', exact: true }).click(); await setRange(page, 'Individual flower height', '.7'); await setRange(page, 'Individual flower size', '1.45'); await page.getByLabel('Show bottom stems', { exact: true }).check();
  await page.getByRole('button', { name: 'Show front view', exact: true }).click(); await page.getByTestId('scene').scrollIntoViewIfNeeded();
  await expect.poll(async () => { const points = await page.evaluate(() => (window as unknown as { __petalpopFlowerPoints: () => Record<string, [number, number]> }).__petalpopFlowerPoints()); const box = (await page.getByTestId('scene').boundingBox())!; return Object.values(points).every(([x, y]) => x > 25 && x < box.width - 25 && y > 35 && y < box.height - 35); }).toBe(true);
  await page.screenshot({ path: 'artifacts/arrangement/editor-mobile.png', fullPage: true });
  await expect.poll(async () => (await draft(page)).arrangement?.profile).toBe('stepped');
  await page.getByRole('navigation', { name: 'Studio navigation' }).getByRole('button', { name: 'Bouquet', exact: true }).click(); await page.getByRole('button', { name: 'Reset bouquet', exact: true }).click(); await expect.poll(async () => (await draft(page)).arrangement).toBeUndefined();
  await expect(height).toHaveValue('0'); await expect(page.getByRole('button', { name: 'Natural dome arrangement', exact: true })).toHaveAttribute('aria-pressed', 'true'); await expect(page.getByLabel('Show bottom stems', { exact: true })).not.toBeChecked();
});

test('fillers have independent stepped heights with undo, shuffle, reload, sharing, mobile remix and PNG', async ({ page, browser }) => {
  await mkdir('artifacts/arrangement', { recursive: true }); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const c = clone(starter); c.fillers = [{ id: 'eucalyptus', count: 6, color: '#89aaa0' }, { id: 'wheat', count: 6, color: '#d5b475' }];
  await page.addInitScript(({ key, c }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(c)); }, { key: DRAFT_KEY, c });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true'); const builds = (await metrics(page)).modelBuilds;
  await page.getByRole('tab', { name: 'Fillers', exact: true }).click(); await expect(page.getByRole('button', { name: 'Natural filler arrangement', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Stepped filler arrangement', exact: true }).click(); await expect.poll(async () => (await draft(page)).arrangement?.fillerProfile).toBe('stepped');
  expect((await draft(page)).arrangement?.profile).toBe('natural'); expect((await metrics(page)).modelBuilds).toBe(builds);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.getByRole('button', { name: 'Natural filler arrangement', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect(page.getByRole('button', { name: 'Stepped filler arrangement', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'Flowers', exact: true }).click(); await page.getByRole('button', { name: 'Arrange blooms', exact: true }).click(); await page.getByRole('button', { name: 'One bloom', exact: true }).click(); await page.getByRole('button', { name: 'Stepped bouquet arrangement', exact: true }).click();
  await page.getByRole('tab', { name: 'Fillers', exact: true }).click(); await page.getByRole('button', { name: 'Natural filler arrangement', exact: true }).click(); await expect.poll(async () => (await draft(page)).arrangement?.fillerProfile).toBe('natural'); expect((await draft(page)).arrangement?.profile).toBe('stepped');
  await page.getByRole('button', { name: 'Stepped filler arrangement', exact: true }).click(); await page.getByRole('button', { name: 'Shuffle', exact: true }).click(); await expect.poll(async () => (await draft(page)).seed).not.toBe(c.seed);
  await expect.poll(async () => (await draft(page)).arrangement?.fillerProfile).toBe('stepped'); await page.getByRole('button', { name: 'Show front view', exact: true }).click();
  await page.locator('.tab-panel').evaluate(n => { n.scrollTop = 0; }); await page.screenshot({ path: 'artifacts/arrangement/fillers-desktop.png', fullPage: true });
  const saved = await draft(page); await page.reload(); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true'); await page.getByRole('tab', { name: 'Fillers', exact: true }).click(); await expect(page.getByRole('button', { name: 'Stepped filler arrangement', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); const url = await readyLink(page); expect((await sharedDesign(page, url)).arrangement).toEqual(saved.arrangement);
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, hasTouch: true }), receiver = await context.newPage(); receiver.on('pageerror', e => errors.push(e.message));
  await receiver.goto(url); await receiver.getByRole('button', { name: 'Tap to open', exact: true }).click(); await expect(receiver.getByRole('button', { name: 'Keep this bouquet', exact: true })).toBeEnabled(); expect(await receiver.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  const pending = receiver.waitForEvent('download'); await receiver.getByRole('button', { name: 'Keep this bouquet', exact: true }).click(); await (await pending).saveAs('artifacts/arrangement/fillers-card.png');
  await receiver.getByRole('button', { name: 'Remix bouquet', exact: true }).last().click(); await expect.poll(async () => (await draft(receiver))?.arrangement).toEqual(saved.arrangement);
  await receiver.getByRole('tab', { name: 'Fillers', exact: true }).click(); for (const width of [320, 390]) { await receiver.setViewportSize({ width, height: 844 }); await expect(receiver.getByRole('button', { name: 'Stepped filler arrangement', exact: true })).toHaveAttribute('aria-pressed', 'true'); expect(await receiver.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await receiver.screenshot({ path: 'artifacts/arrangement/fillers-mobile.png', fullPage: true }); expect(errors).toEqual([]); await context.close();
});
