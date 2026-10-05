import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { DRAFT_KEY, type BouquetConfigV1 } from '../../src/config';

const draft = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as BouquetConfigV1, DRAFT_KEY);
async function visibleControl(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  const control = (await page.locator(selector).boundingBox())!, pane = (await page.locator('.workspace').boundingBox())!;
  expect(control.y).toBeGreaterThanOrEqual(pane.y);
  expect(control.y + control.height).toBeLessThanOrEqual(pane.y + pane.height + 1);
}

test('every mobile category keeps the same canvas stationary while controls scroll and change', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await mkdir('artifacts/pinned-studio', { recursive: true });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  const scene = page.getByTestId('scene'), canvas = scene.locator('canvas'), pane = page.locator('.workspace');
  await canvas.evaluate(e => e.setAttribute('data-original-canvas', 'true'));
  const rect = await scene.boundingBox(); const nav = page.getByRole('navigation', { name: 'Studio navigation' });
  await nav.getByRole('button', { name: 'Customize', exact: true }).tap();
  for (const name of ['Flowers', 'Fillers', 'Wrap', 'Ribbon', 'Effects', 'Objects', 'Gift']) {
    const tab = page.getByRole('tab', { name, exact: true }); await tab.tap();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await pane.evaluate(e => e.scrollBy(0, 400));
    expect(await scene.boundingBox()).toEqual(rect); await expect(canvas).toHaveAttribute('data-original-canvas', 'true');
    await expect(canvas).toBeVisible(); expect(await page.evaluate(() => scrollY)).toBe(0);
  }
  await page.getByRole('tab', { name: 'Flowers', exact: true }).tap();
  const before = await canvas.screenshot();
  await page.getByRole('button', { name: 'Add one Rose', exact: true }).tap(); await expect(page.getByLabel('Rose quantity')).toHaveText('4');
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
  await page.getByRole('tab', { name: 'Fillers', exact: true }).tap();
  await page.getByRole('button', { name: 'Add one Eucalyptus', exact: true }).tap();
  await expect(page.getByLabel('Eucalyptus quantity')).toHaveText('4');
  await page.getByRole('button', { name: 'Arrange fillers', exact: true }).tap();
  await page.getByRole('button', { name: 'Natural filler arrangement', exact: true }).tap();
  await expect.poll(async () => (await draft(page)).arrangement?.fillerProfile).toBe('natural');
  await page.getByRole('tab', { name: 'Wrap', exact: true }).tap();
  const wrapBefore = await canvas.screenshot();
  await page.getByRole('button', { name: 'Select Mini Gift Bag', exact: true }).tap();
  await expect.poll(async () => (await draft(page)).wrapper.id).toBe('gift-bag');
  await expect.poll(async () => (await canvas.screenshot()).equals(wrapBefore)).toBe(false);
  expect(await scene.boundingBox()).toEqual(rect);
  await page.screenshot({ path: 'artifacts/pinned-studio/wrap-390.png' });
  await nav.getByRole('button', { name: 'Bouquet', exact: true }).tap();
  await expect.poll(() => pane.evaluate(e => e.scrollTop)).toBe(0);
  await expect(page.getByRole('button', { name: 'Surprise me', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save PNG', exact: true })).toBeEnabled();
  expect(errors).toEqual([]); await context.close();
});

test('mobile object placement, notes, dialogs and gift editing stay reachable', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await context.newPage(); await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  const nav = page.getByRole('navigation', { name: 'Studio navigation' });
  await nav.getByRole('button', { name: 'Customize', exact: true }).tap(); await page.getByRole('tab', { name: 'Objects', exact: true }).tap();
  await page.getByRole('button', { name: 'Add Sealed Letter', exact: true }).tap();
  await page.getByRole('button', { name: 'Open & write a note', exact: true }).tap();
  const dialog = page.getByRole('dialog', { name: 'Edit envelope note' });
  await expect(dialog).toHaveClass(/is-revealed/);
  await page.getByRole('textbox', { name: 'Envelope note text' }).fill('A mobile note, with love.');
  await page.getByRole('button', { name: 'Save & seal', exact: true }).tap(); await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await draft(page)).objects[0]?.note?.runs[0]?.text).toBe('A mobile note, with love.');
  const rect = await page.getByTestId('scene').boundingBox();
  await page.getByRole('button', { name: 'Tap a spot to place', exact: true }).tap();
  expect(await page.getByTestId('scene').boundingBox()).toEqual(rect);
  await expect(page.locator('.scene-hint')).toContainText('Tap the grid');
  await page.locator('.mobile-selection').getByRole('button', { name: 'Adjust', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Tap a spot to place', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('tab', { name: 'Gift', exact: true }).tap(); await page.getByLabel('Title', { exact: true }).fill('For you, on the go');
  await expect(page.getByTestId('scene').locator('canvas')).toBeVisible();
  await page.getByLabel('Title', { exact: true }).blur();
  await nav.getByRole('button', { name: 'Gift preview', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Tap to open', exact: true })).toBeVisible(); expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await page.getByRole('button', { name: 'Tap to open', exact: true }).tap(); await expect(page.getByRole('heading', { name: 'For you, on the go' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to studio', exact: true }).tap(); await expect(page.locator('.app')).toHaveClass(/mobile-workspace/);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('For you, on the go');
  await writeFile('artifacts/pinned-studio/workflow.json', JSON.stringify({ noteSaved: true, giftTitleRetained: true, canvasPinned: true }, null, 2));
  await context.close();
});

test('narrow, short, landscape and resized keyboard layouts fit and desktop scroll is restored', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [760, 1024], [700, 390], [844, 390]]) {
    await page.setViewportSize({ width, height }); await expect(page.locator('.app')).toHaveClass(/mobile-workspace/);
    await page.getByRole('navigation', { name: 'Studio navigation' }).getByRole('button', { name: 'Customize', exact: true }).click();
    await page.getByRole('tab', { name: 'Gift', exact: true }).click();
    await visibleControl(page, 'input[placeholder="A little joy, just for you"]');
    const scene = (await page.getByTestId('scene').boundingBox())!, pane = (await page.locator('.workspace').boundingBox())!;
    if (height < 480) expect(scene.x + scene.width).toBeLessThan(pane.x); else expect(scene.y + scene.height).toBeLessThan(pane.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const tab of await page.getByRole('tab').all()) { await tab.scrollIntoViewIfNeeded(); const box = (await tab.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
    await expect(page.getByLabel('Title', { exact: true })).toHaveCSS('font-size', '16px');
    await page.getByRole('button', { name: 'Share bouquet', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Send a little joy' }); expect(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.screenshot({ path: `artifacts/pinned-studio/gift-${width}x${height}.png` });
  }
  // Chromium desktop emulation does not open a physical keyboard; simulate its visual viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { Object.defineProperty(visualViewport, 'height', { configurable: true, value: 470 }); visualViewport!.dispatchEvent(new Event('resize')); });
  await page.getByLabel('Title', { exact: true }).focus();
  await expect.poll(() => page.locator('.app').evaluate(e => e.getBoundingClientRect().height)).toBe(470);
  await visibleControl(page, 'input[placeholder="A little joy, just for you"]');
  expect((await page.getByTestId('scene').boundingBox())!.height).toBeLessThan(130);
  await page.evaluate(() => { Reflect.deleteProperty(visualViewport!, 'height'); visualViewport!.dispatchEvent(new Event('resize')); });
  await page.setViewportSize({ width: 1280, height: 960 }); await expect(page.locator('.app')).not.toHaveClass(/mobile-workspace/);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await expect(page.getByRole('navigation', { name: 'Studio navigation' })).toBeHidden();
  expect(await page.locator('.tab-panel').evaluate(e => getComputedStyle(e).overflowY)).toBe('auto');
});
