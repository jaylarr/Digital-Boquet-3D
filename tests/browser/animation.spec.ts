import { test, expect } from '@playwright/test';
import type { ViewerMetrics } from '../../src/Viewer';
const metrics = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __petalpopMetrics: () => ViewerMetrics }).__petalpopMetrics());

test('quantity edits animate on cached models and paused scenes stop rendering', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  const before = await metrics(page);
  await page.getByRole('button', { name: 'Add one Rose', exact: true }).click();
  await expect.poll(async () => (await metrics(page)).active).toBe(before.active + 1);
  expect((await metrics(page)).modelBuilds).toBe(before.modelBuilds);
  await expect.poll(async () => (await metrics(page)).transitioning).toBe(0);
  await page.getByRole('button', { name: 'Remove one Rose', exact: true }).click();
  await expect.poll(async () => (await metrics(page)).visibleStems).toBe(before.active);
  expect((await metrics(page)).modelBuilds).toBe(before.modelBuilds);
  await page.getByRole('button', { name: 'Pause motion' }).click(); await page.waitForTimeout(1200);
  const paused = await metrics(page); await page.waitForTimeout(600);
  expect((await metrics(page)).frames - paused.frames).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Enable motion' }).click();
  await expect.poll(async () => (await metrics(page)).frames).toBeGreaterThan(paused.frames + 2);
  expect(errors).toEqual([]);
});

test('scattered butterflies and glowing fireflies render and freeze for review', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('tab', { name: 'Effects', exact: true }).click();
  await page.getByRole('button', { name: 'Select Butterflies', exact: true }).click();
  await page.getByRole('button', { name: 'Select Fireflies', exact: true }).click();
  await page.waitForTimeout(1600); await page.getByRole('button', { name: 'Pause motion' }).click();
  await page.waitForTimeout(400); await page.getByTestId('scene').screenshot({ path: 'artifacts/scattered-effects.png' });
  expect((await metrics(page)).calls).toBeLessThan(50); expect(errors).toEqual([]);
});

test('reduced-motion users receive instant edits and no continuous bouquet animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Add one Rose', exact: true }).click();
  await expect.poll(async () => (await metrics(page)).active).toBe(13);
  expect((await metrics(page)).transitioning).toBe(0);
  await page.waitForTimeout(800); const before = await metrics(page); await page.waitForTimeout(500);
  expect((await metrics(page)).frames - before.frames).toBeLessThanOrEqual(1);
});
