import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { clone, DRAFT_KEY, encode, starter } from '../../src/config';
import { confirmRemix } from './shareHelpers';

for (const width of [320, 1280]) {
  for (const format of ['saved', 'portable']) {
    test(`${format} gift logo requires confirmation at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const gift = clone(starter); gift.gift.title = 'A bouquet for you'; gift.gift.to = 'Recipient';
      const hash = format === 'saved' ? '#s=Abcdef012345_-XY' : `#b=${encode(gift)}`;
      await page.addInitScript(({ key, draft }) => localStorage.setItem(key, JSON.stringify(draft)), { key: DRAFT_KEY, draft: starter });
      await page.route('**/api/bouquets/*', route => route.fulfill({ json: { payload: encode(gift) } }));
      await page.goto(`/${hash}`);
      await expect(page.getByRole('button', { name: 'Tap to open', exact: true })).toBeVisible();
      const logo = page.getByRole('link', { name: 'PetalPop home', exact: true });
      const modal = page.getByRole('dialog', { name: 'Make this bouquet your own?' });
      await expect(page.getByRole('button', { name: 'Remix bouquet', exact: true })).toHaveCount(0);
      await logo.focus(); await logo.press('Enter'); await expect(modal).toBeVisible();
      await modal.getByRole('button', { name: 'Stay with gift' }).click();
      await expect(modal).toHaveCount(0); await expect(logo).toBeFocused();
      expect(new URL(page.url()).hash).toBe(hash);
      await page.getByRole('button', { name: 'Tap to open' }).click();
      await expect(page.getByRole('heading', { name: gift.gift.title, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Remix bouquet', exact: true })).toHaveCount(0);
      await logo.click(); await expect(modal).toBeVisible();
      await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0); await expect(logo).toBeFocused();
      await logo.click(); await modal.getByRole('button', { name: 'Close dialog' }).click();
      await expect(modal).toHaveCount(0);
      expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), DRAFT_KEY)).toEqual(starter);
      await logo.click(); await expect(modal).toBeVisible();
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Tab');
        // Native dialogs may let Tab reach browser chrome, but never the inert page.
        expect(await modal.evaluate(node => document.activeElement === document.body || node.contains(document.activeElement))).toBe(true);
      }
      expect(await modal.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await mkdir('artifacts/shared-logo', { recursive: true });
      await page.screenshot({ path: `artifacts/shared-logo/${format}-${width}.png` });
      await modal.getByRole('button', { name: 'Stay with gift' }).click();
      await confirmRemix(page);
      await expect(page.getByRole('button', { name: 'Share bouquet', exact: true })).toBeVisible();
      expect(new URL(page.url()).hash).toBe('');
      await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).gift.title, DRAFT_KEY)).toBe(gift.gift.title);
      await page.getByRole('button', { name: width < 760 ? 'Gift preview' : 'Preview gift', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Back to studio', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Back to studio', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Share bouquet', exact: true })).toBeVisible();
    });
  }
}
