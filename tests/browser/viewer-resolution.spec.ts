import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { clone, encode, starter } from '../../src/config';
import { createGiftObject } from '../../src/giftCatalog';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });

for (const [kind, width] of [['short', 390], ['portable', 390], ['short', 760]] as const) {
  test(`${kind} recipient preserves resolution through fallback and replay at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      const diagnostic = window as unknown as { __resolutionSlowFrames: boolean };
      diagnostic.__resolutionSlowFrames = false;
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => request(() => {
        if (diagnostic.__resolutionSlowFrames) {
          const until = performance.now() + 75;
          while (performance.now() < until) { /* Test-only sustained frame pressure. */ }
        }
        callback(performance.now());
      });
    });
    const config = clone(starter);
    config.objects.push(createGiftObject('standing-frame', config.objects));
    config.objects.push(createGiftObject('teddy-bear', config.objects));
    const payload = encode(config);
    await page.route('**/api/bouquets/Abcdef012345_-XY', route => route.fulfill({ json: { payload } }));
    await page.goto(`/#${kind === 'short' ? 's=Abcdef012345_-XY' : `b=${payload}`}`);
    await page.getByRole('button', { name: 'Tap to open', exact: true }).click();
    await page.waitForFunction(() => ((window as unknown as { __petalpopMetrics?: () => { frames: number } }).__petalpopMetrics?.()?.frames ?? 0) > 1);
    const snapshot = () => page.evaluate(() => {
      type Metrics = { pixelRatio: number; economy: boolean; frames: number };
      const metrics = (window as unknown as { __petalpopMetrics: () => Metrics }).__petalpopMetrics();
      const canvas = document.querySelector('.gift-scene canvas') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      return { metrics, width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height, ratio: canvas.width / rect.width };
    });
    const initial = await snapshot();
    expect(initial.ratio).toBeCloseTo(1.25, 2);
    expect(initial.metrics.economy).toBe(false);
    await expect(page.getByRole('button', { name: 'Pause motion', exact: true })).toBeDisabled();
    const records = [{ label: 'initial', ...initial }];
    const stable = async (label: string) => {
      const current = await snapshot();
      records.push({ label, ...current });
      expect(current.cssWidth).toBe(initial.cssWidth);
      expect(current.cssHeight).toBe(initial.cssHeight);
      expect(current.ratio).toBeGreaterThanOrEqual(1);
      expect(current.width).toBe(initial.width);
      expect(current.height).toBe(initial.height);
      expect(current.metrics.pixelRatio).toBe(initial.metrics.pixelRatio);
      expect(current.metrics.economy).toBe(true);
    };
    await page.evaluate(() => { (window as unknown as { __resolutionSlowFrames: boolean }).__resolutionSlowFrames = true; });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => (await snapshot()).metrics.economy, { timeout: 30000 }).toBe(true);
    await stable('fallback');
    for (const button of ['Replay effects', 'Reset view', 'Pause motion']) {
      const before = (await snapshot()).metrics.frames;
      await page.getByRole('button', { name: button, exact: true }).click();
      await expect.poll(async () => (await snapshot()).metrics.frames).toBeGreaterThan(before);
      await stable(button);
    }
    await page.evaluate(() => { (window as unknown as { __resolutionSlowFrames: boolean }).__resolutionSlowFrames = false; });
    await mkdir('artifacts/viewer-resolution', { recursive: true });
    await writeFile(`artifacts/viewer-resolution/${kind}-${width}.json`, JSON.stringify(records, null, 2));
    await page.mouse.move(0, 0);
    await page.locator('.gift-scene').screenshot({ path: `artifacts/viewer-resolution/${kind}-${width}.png` });
  });
}
