/* global process, console */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto(process.argv[2] ?? 'http://127.0.0.1:5180/');
  const assets = await page.evaluate(async () => {
    const catalogUrl = '/src/catalog.ts', configUrl = '/src/config.ts', thumbnailUrl = '/src/thumbnails.ts';
    const { catalog } = await import(catalogUrl), { presets } = await import(configUrl), { thumbnail, releaseThumbnailRenderer } = await import(thumbnailUrl);
    const requests = new Map();
    for (const [category, entries] of Object.entries(catalog)) for (const item of entries) requests.set(`${category}:${item.id}:${item.color}`, { category, id: item.id, color: item.color });
    for (const preset of presets) for (const flower of preset.config.flowers.slice(0, 3)) requests.set(`flowers:${flower.id}:${flower.color}`, { category: 'flowers', id: flower.id, color: flower.color });
    const results = [];
    for (const [key, item] of requests) results.push({ key, filename: `${item.category}-${item.id}-${item.color.slice(1)}.png`, src: thumbnail(item.category, item.id, item.color) });
    releaseThumbnailRenderer(); return results;
  });
  await mkdir('public/catalog', { recursive: true });
  const manifest = {};
  for (const asset of assets) { await writeFile(`public/catalog/${asset.filename}`, Buffer.from(asset.src.split(',')[1], 'base64')); manifest[asset.key] = `catalog/${asset.filename}`; }
  await writeFile('src/catalog-thumbnails.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Saved ${assets.length} pre-rendered catalog/preset thumbnails.`);
} finally { await browser.close(); }
