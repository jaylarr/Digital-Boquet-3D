import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { DRAFT_KEY, type BouquetConfigV1 } from '../../src/config';

const draft = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as BouquetConfigV1, DRAFT_KEY);
async function nearTop(page: Page, selector: string, minimum = 68, maximum = 245) {
  await expect.poll(async () => (await page.locator(selector).boundingBox())!.y).toBeGreaterThanOrEqual(minimum);
  await expect.poll(async () => (await page.locator(selector).boundingBox())!.y).toBeLessThanOrEqual(maximum);
}

test('touch navigation reaches every category, resets long panels and returns to the live bouquet', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await mkdir('artifacts/mobile-studio', { recursive: true });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await page.screenshot({ path: 'artifacts/mobile-studio/preview-390.png' });
  const nav = page.getByRole('navigation', { name: 'Studio navigation' });
  await nav.getByRole('button', { name: 'Customize', exact: true }).tap();
  await nearTop(page, '#builder-navigation', 68, 85);
  await expect(nav.getByRole('button', { name: 'Customize', exact: true })).toHaveAttribute('aria-current', 'location');
  for (const name of ['Flowers', 'Fillers', 'Wrap', 'Ribbon', 'Effects', 'Objects', 'Gift']) {
    const tab = page.getByRole('tab', { name, exact: true }); const box = (await tab.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y).toBeGreaterThanOrEqual(68); expect(box.y + box.height).toBeLessThan(230);
    await tab.tap(); await expect(tab).toHaveAttribute('aria-selected', 'true');
    await nearTop(page, '.tab-panel');
    expect(await page.locator('.tab-panel').evaluate(e => getComputedStyle(e).overflowY)).toBe('visible');
  }
  await page.getByRole('tab', { name: 'Flowers', exact: true }).tap();
  await page.getByRole('button', { name: 'Add one Rose', exact: true }).tap(); await expect(page.getByLabel('Rose quantity')).toHaveText('4');
  await page.mouse.wheel(0, 700);
  await nearTop(page, '#builder-navigation', 68, 70);
  await page.getByRole('tab', { name: 'Fillers', exact: true }).tap(); await nearTop(page, '.tab-panel');
  await page.getByRole('button', { name: 'Stepped filler arrangement', exact: true }).tap();
  await expect.poll(async () => (await draft(page)).arrangement?.fillerProfile).toBe('stepped');
  await page.screenshot({ path: 'artifacts/mobile-studio/editor-390.png' });
  await nav.getByRole('button', { name: 'Bouquet', exact: true }).tap(); await nearTop(page, '#bouquet-preview', 68, 85);
  await expect(page.getByTestId('scene').locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save PNG', exact: true })).toBeEnabled();
  expect(errors).toEqual([]); await context.close();
});

test('mobile object controls, envelope animation and gift preview remain reachable without losing edits', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await context.newPage(); await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  const nav = page.getByRole('navigation', { name: 'Studio navigation' });
  await nav.getByRole('button', { name: 'Customize', exact: true }).tap(); await page.getByRole('tab', { name: 'Objects', exact: true }).tap();
  await page.getByRole('button', { name: 'Add Sealed Letter', exact: true }).tap();
  await nearTop(page, '#selected-object-controls');
  await page.getByRole('button', { name: 'Open & write a note', exact: true }).tap();
  const dialog = page.getByRole('dialog', { name: 'Edit envelope note' }); await expect(dialog).toHaveClass(/is-opening/);
  await expect(dialog).toHaveClass(/is-revealed/);
  await page.getByRole('textbox', { name: 'Envelope note text' }).fill('A mobile note, with love.');
  await page.getByRole('button', { name: 'Save & seal', exact: true }).tap(); await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await draft(page)).objects[0]?.note?.runs[0]?.text).toBe('A mobile note, with love.');
  await page.getByRole('button', { name: 'Tap a spot to place', exact: true }).tap();
  await nearTop(page, '#bouquet-preview', 68, 85); await expect(page.locator('.scene-hint')).toContainText('Tap the grid');
  await page.locator('.mobile-selection').getByRole('button', { name: 'Adjust', exact: true }).tap(); await nearTop(page, '#selected-object-controls');
  await expect(page.getByRole('button', { name: 'Tap a spot to place', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('tab', { name: 'Gift', exact: true }).tap(); await page.getByLabel('Title', { exact: true }).fill('For you, on the go');
  await page.getByLabel('Title', { exact: true }).press('Tab'); await page.getByRole('heading', { name: 'Make it personal' }).tap();
  const position = await page.evaluate(() => scrollY);
  await nav.getByRole('button', { name: 'Gift preview', exact: true }).tap(); await expect(page.getByRole('button', { name: 'Tap to open', exact: true })).toBeVisible();
  await expect(nav).toHaveCount(0); expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.getByRole('button', { name: 'Tap to open', exact: true }).tap(); await expect(page.getByRole('heading', { name: 'For you, on the go' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to studio', exact: true }).tap(); await expect(nav).toBeVisible();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('For you, on the go');
  await expect.poll(async () => Math.abs(await page.evaluate(() => scrollY) - position)).toBeLessThan(2);
  await writeFile('artifacts/mobile-studio/workflow.json', JSON.stringify({ noteSaved: true, giftTitleRetained: true, returnedScroll: position, viewport: '390x844', touch: true }, null, 2));
  await context.close();
});

test('narrow and short mobile layouts fit, have readable fields and keep desktop layout', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [760, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.getByRole('navigation', { name: 'Studio navigation' }).getByRole('button', { name: 'Customize', exact: true }).click();
    await page.getByRole('tab', { name: 'Gift', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const tab of await page.getByRole('tab').all()) { const box = (await tab.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width); }
    await expect(page.getByLabel('Title', { exact: true })).toHaveCSS('font-size', '16px');
    await page.getByRole('button', { name: 'Share bouquet', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Send a little joy' }); expect(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    if (width === 320) await page.screenshot({ path: 'artifacts/mobile-studio/gift-320.png' });
  }
  await page.setViewportSize({ width: 1280, height: 960 });
  await expect(page.getByRole('navigation', { name: 'Studio navigation' })).toBeHidden();
  expect(await page.locator('.builder-card').evaluate(e => getComputedStyle(e).overflowY)).toBe('hidden');
  expect(await page.locator('.tab-panel').evaluate(e => getComputedStyle(e).overflowY)).toBe('auto');
});
