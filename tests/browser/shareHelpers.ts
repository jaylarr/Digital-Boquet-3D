import { expect, type Page } from '@playwright/test';
import { decode } from '../../src/config';
export async function confirmRemix(page: Page) {
  await page.getByRole('link', { name: 'PetalPop home', exact: true }).click();
  await page.getByRole('dialog', { name: 'Make this bouquet your own?' }).getByRole('button', { name: 'Open studio', exact: true }).click();
}
export async function sharedDesign(page: Page, url: string) {
  const u = new URL(url); if (u.hash.startsWith('#b=')) return decode(u.hash.slice(3));
  expect(u.hash).toMatch(/^#s=[A-Za-z0-9_-]{16}$/); const response = await page.request.get(new URL(`api/bouquets/${u.hash.slice(3)}`, new URL('.', url)).href);
  expect(response.ok()).toBe(true); return decode((await response.json()).payload);
}
export async function readyLink(page: Page) {
  await expect(page.locator('.link-status')).toContainText('Short link ready');
  await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeEnabled();
  const url = await page.locator('.share-link').inputValue();
  expect(new URL(url).hash).toMatch(/^#s=[A-Za-z0-9_-]{16}$/); return url;
}
