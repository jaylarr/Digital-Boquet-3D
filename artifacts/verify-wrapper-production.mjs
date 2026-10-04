/* global console */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:5181/');
  await page.locator('[data-testid=scene][data-ready=true]').waitFor();
  await page.getByRole('slider', { name: /Spread/ }).press('End');
  await page.getByRole('slider', { name: /Flower size/ }).press('End');
  assert.equal(await page.getByRole('slider', { name: /Spread/ }).inputValue(), '1.2');
  assert.equal(await page.getByRole('slider', { name: /Flower size/ }).inputValue(), '1.2');
  await page.screenshot({ path: 'artifacts/production-wrapper-contacts.png', fullPage: true });
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save PNG', exact: true }).click();
  await (await download).saveAs('artifacts/maximum-spread-card.png');
  assert.deepEqual(errors, []);
  console.log('Production maximum spread/size and PNG capture passed without page or shader errors.');
} finally { await browser.close(); }
