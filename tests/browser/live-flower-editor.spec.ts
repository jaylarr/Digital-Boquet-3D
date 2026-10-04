import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { DRAFT_KEY, type BouquetConfigV1 } from '../../src/config';
import { readyLink, sharedDesign } from './shareHelpers';

const draft = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as BouquetConfigV1, DRAFT_KEY);
async function arrange(page: Page) {
  await page.getByRole('navigation', { name: 'Studio navigation' }).getByRole('button', { name: 'Customize', exact: true }).click();
  await page.getByRole('button', { name: 'Arrange blooms', exact: true }).click();
  await expect(page.locator('.app')).toHaveClass(/flower-workspace/);
  await expect(page.getByRole('slider', { name: 'All flower height', exact: true })).toBeVisible();
}

test('live mobile preview stays visible during a real touch height drag, scrolling, undo and individual editing', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await mkdir('artifacts/live-flower-editor', { recursive: true });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true'); await arrange(page);
  const scene = page.getByTestId('scene'), canvas = scene.locator('canvas'), panel = page.getByRole('tabpanel', { name: 'Flowers', exact: true });
  const position = (await scene.boundingBox())!;
  expect(position.y).toBeGreaterThanOrEqual(56); expect(position.y + position.height).toBeLessThan(340);
  await page.evaluate(() => { const canvas = document.querySelector('[data-testid=scene] canvas')!; canvas.setAttribute('data-original-canvas', 'true'); });
  const builds = await page.evaluate(() => (window as unknown as { __petalpopMetrics?: () => { modelBuilds: number } }).__petalpopMetrics?.().modelBuilds);
  const height = page.getByRole('slider', { name: 'All flower height', exact: true }); await height.scrollIntoViewIfNeeded();
  const before = await canvas.screenshot();
  const box = (await height.boundingBox())!, start = box.x + 8 + box.width * .35, end = box.x + 8 + (box.width - 16) * (.75 / 1.1), y = box.y + box.height / 2;
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y, id: 1 }] });
  for (let step = 1; step <= 12; step++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + (end - start) * step / 12, y, id: 1 }] });
  await expect.poll(async () => Number(await height.inputValue())).toBeGreaterThan(.3);
  const lifted = Number(await height.inputValue());
  await expect.poll(async () => (await draft(page)).arrangement?.height).toBe(lifted);
  const during = await canvas.screenshot({ path: 'artifacts/live-flower-editor/live-drag-canvas.png' }); expect(during.equals(before)).toBe(false);
  await page.screenshot({ path: 'artifacts/live-flower-editor/all-blooms-390.png' });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(canvas).toHaveAttribute('data-original-canvas', 'true');
  await page.getByRole('button', { name: 'Undo', exact: true }).tap(); await expect(height).toHaveValue('0');
  await page.getByRole('button', { name: 'Redo', exact: true }).tap(); await expect(height).toHaveValue(String(lifted));
  await page.getByRole('button', { name: 'Stepped bouquet arrangement', exact: true }).tap(); await expect(height).toHaveValue(String(lifted));
  await page.getByRole('button', { name: 'One bloom', exact: true }).tap(); await page.getByLabel('Individual flower', { exact: true }).selectOption('rose:0');
  const individual = page.getByRole('slider', { name: 'Individual flower height', exact: true }); await individual.press('ArrowRight'); await expect(individual).toHaveValue('0.01');
  await expect.poll(async () => (await draft(page)).arrangement?.edits[0]?.height).toBe(.01);
  const size = page.getByRole('slider', { name: 'Individual flower size', exact: true }); await size.scrollIntoViewIfNeeded(); await size.press('ArrowRight');
  await panel.evaluate(e => e.scrollTo({ top: e.scrollHeight }));
  expect((await scene.boundingBox())!).toEqual(position); expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await expect(canvas).toBeVisible();
  await page.getByRole('slider', { name: 'Individual flower depth', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/live-flower-editor/one-bloom-390.png' });
  if (builds !== undefined) expect(await page.evaluate(() => (window as unknown as { __petalpopMetrics: () => { modelBuilds: number } }).__petalpopMetrics().modelBuilds)).toBe(builds);
  await page.getByRole('navigation', { name: 'Studio navigation' }).getByRole('button', { name: 'Gift preview', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Tap to open', exact: true })).toBeVisible(); expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await page.getByRole('button', { name: 'Back to studio', exact: true }).tap(); await expect(page.locator('.app')).toHaveClass(/flower-workspace/); await expect(page.getByLabel('Individual flower', { exact: true })).toHaveValue('rose:0');
  await page.getByRole('button', { name: 'Done', exact: true }).tap(); await expect(page.locator('.app')).not.toHaveClass(/flower-workspace/); expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await expect(page.getByRole('tab', { name: 'Fillers', exact: true })).toBeVisible();
  await writeFile('artifacts/live-flower-editor/live-validation.json', JSON.stringify({ lifted, scenePosition: position, sameCanvas: true, livePixelsChangedBeforeRelease: true, undoGroupedGesture: true, modelBuilds: builds, errors }, null, 2));
  expect(errors).toEqual([]); await context.close();
});

test('bulk height survives reload, saved and portable gifts and mobile remix, and short-screen controls fit', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true'); await arrange(page);
  const height = page.getByRole('slider', { name: 'All flower height', exact: true }); await height.focus(); await height.press('End'); await expect(height).toHaveValue('0.7');
  await page.getByRole('button', { name: 'Natural dome arrangement', exact: true }).tap(); await expect(height).toHaveValue('0.7');
  for (const [width, heightPx] of [[320, 568], [390, 844], [700, 390]]) {
    await page.setViewportSize({ width, height: heightPx });
    await height.scrollIntoViewIfNeeded(); const scene = (await page.getByTestId('scene').boundingBox())!, control = (await height.boundingBox())!;
    expect(scene.y).toBeGreaterThanOrEqual(50); expect(scene.y + scene.height).toBeLessThan(control.y);
    expect(control.y + control.height).toBeLessThan(heightPx - 69); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 320) await page.screenshot({ path: 'artifacts/live-flower-editor/all-blooms-320.png' });
  }
  await page.setViewportSize({ width: 1280, height: 960 }); await expect(page.locator('.app')).not.toHaveClass(/flower-workspace/); expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); const short = await readyLink(page); expect((await sharedDesign(page, short)).arrangement?.height).toBe(.7);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.route('**/api/bouquets', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); await page.getByLabel('Title', { exact: true }).fill('All blooms, lifted'); const portable = await readyLink(page); expect(new URL(portable).hash).toMatch(/^#b=c\./); expect((await sharedDesign(page, portable)).arrangement?.height).toBe(.7);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click(); await page.reload(); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true'); expect((await draft(page)).arrangement?.height).toBe(.7);
  const receiverContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }), receiver = await receiverContext.newPage();
  await receiver.goto(short); await receiver.getByRole('button', { name: 'Tap to open', exact: true }).click(); await expect(receiver.getByRole('button', { name: 'Keep this bouquet', exact: true })).toBeEnabled();
  expect(await receiver.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  await receiver.getByRole('button', { name: 'Remix bouquet', exact: true }).last().click(); await arrange(receiver); await expect(receiver.getByRole('slider', { name: 'All flower height', exact: true })).toHaveValue('0.7');
  await receiver.getByRole('button', { name: 'Reset overall height', exact: true }).click(); await expect(receiver.getByRole('slider', { name: 'All flower height', exact: true })).toHaveValue('0');
  await receiverContext.close(); await context.close();
});
