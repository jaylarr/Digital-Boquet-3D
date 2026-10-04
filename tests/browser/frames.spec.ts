import { expect, test, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { DRAFT_KEY, type BouquetConfigV1 } from '../../src/config';
import { createGiftObject, giftAssets, isFrame } from '../../src/giftCatalog';
import { readyLink, sharedDesign } from './shareHelpers';

const draft = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as BouquetConfigV1 | null, DRAFT_KEY);
async function picture(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 800;
    const c = canvas.getContext('2d')!; c.fillStyle = '#db7187'; c.fillRect(0, 0, 330, 800); c.fillStyle = '#80b5b1'; c.fillRect(330, 0, 340, 800); c.fillStyle = '#e8bd65'; c.fillRect(670, 0, 330, 800);
    c.fillStyle = '#fff6e7'; c.font = 'italic 72px Georgia'; c.textAlign = 'center'; c.fillText('our little moment', 500, 410); return canvas.toDataURL('image/png');
  });
}

test('four frame designs change orientation, retain recroppable pictures, duplicate, undo, share and export on mobile', async ({ page, browser }, testInfo) => {
  test.setTimeout(90000); const prefix = testInfo.project.use.baseURL?.endsWith('5194') ? 'production-' : '';
  await mkdir('artifacts/frames', { recursive: true }); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('tab', { name: 'Objects', exact: true }).click();
  for (const name of ['Memory Frame', 'Landscape Frame', 'Golden Frame', 'Snapshot Frame']) {
    await page.getByRole('button', { name: `Add ${name}`, exact: true }).click();
    const orientations = page.getByRole('group', { name: 'Frame orientation', exact: true });
    await expect(orientations.getByRole('button', { name: name === 'Landscape Frame' ? 'Landscape' : 'Portrait', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await orientations.getByRole('button', { name: 'Landscape', exact: true }).click();
  }
  await expect.poll(async () => (await draft(page))?.objects.length).toBe(4);
  await page.getByRole('button', { name: 'Edit Landscape Frame 2', exact: true }).click();
  const image = await picture(page);
  await page.getByLabel('Frame picture', { exact: true }).setInputFiles({ name: 'moment.png', mimeType: 'image/png', buffer: Buffer.from(image.split(',')[1], 'base64') });
  const editor = page.getByRole('dialog', { name: 'Crop frame picture', exact: true }), canvas = editor.locator('canvas');
  await expect(canvas).toHaveAttribute('width', '400'); await expect(canvas).toHaveAttribute('height', '320');
  await editor.getByRole('button', { name: 'Fill the frame', exact: true }).click();
  await editor.getByRole('slider', { name: 'Crop zoom', exact: true }).focus(); await editor.getByRole('slider', { name: 'Crop zoom', exact: true }).press('ArrowRight');
  await canvas.press('ArrowRight');
  await editor.screenshot({ path: `artifacts/frames/${prefix}landscape-crop.png` });
  await editor.getByRole('button', { name: 'Apply crop', exact: true }).click();
  await expect.poll(async () => (await draft(page))?.objects[1].crop?.zoom).toBe(1.01);
  const savedPhoto = (await draft(page))!.objects[1];
  await page.getByRole('button', { name: 'Portrait', exact: true }).click();
  await expect.poll(async () => (await draft(page))?.objects[1].frameOrientation).toBe('portrait');
  expect((await draft(page))!.objects[1].photo).toBe(savedPhoto.photo); expect((await draft(page))!.objects[1].crop).toEqual(savedPhoto.crop);
  await page.getByRole('button', { name: 'Adjust crop', exact: true }).click(); await expect(canvas).toHaveAttribute('width', '320'); await expect(canvas).toHaveAttribute('height', '400');
  await editor.getByRole('button', { name: 'Cancel cropping', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.getByRole('button', { name: 'Landscape', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect(page.getByRole('button', { name: 'Portrait', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Landscape', exact: true }).click(); await page.getByRole('button', { name: 'Duplicate selected object', exact: true }).click();
  await expect.poll(async () => (await draft(page))?.objects.length).toBe(5);
  const design = (await draft(page))!; expect(design.objects[4]).toMatchObject({ id: 'landscape-frame', frameOrientation: 'landscape', photo: savedPhoto.photo, crop: savedPhoto.crop });
  await page.getByRole('button', { name: 'Show front view', exact: true }).click(); await page.screenshot({ path: `artifacts/frames/${prefix}editor-desktop.png`, fullPage: true });
  await page.reload(); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true'); expect((await draft(page))!.objects).toEqual(design.objects);
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); const url = await readyLink(page); expect((await sharedDesign(page, url)).objects).toEqual(design.objects);
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } }), recipient = await context.newPage(); recipient.on('pageerror', e => errors.push(e.message));
  await recipient.goto(url); await recipient.getByRole('button', { name: 'Tap to open', exact: true }).click(); await expect(recipient.getByRole('button', { name: 'Keep this bouquet', exact: true })).toBeEnabled();
  expect(await draft(recipient)).toBeNull(); const pending = recipient.waitForEvent('download'); await recipient.getByRole('button', { name: 'Keep this bouquet', exact: true }).click(); await (await pending).saveAs(`artifacts/frames/${prefix}frame-card.png`);
  await recipient.getByRole('button', { name: 'Remix bouquet', exact: true }).last().click(); await expect.poll(async () => (await draft(recipient))?.objects).toEqual(design.objects);
  await recipient.getByRole('tab', { name: 'Objects', exact: true }).click(); await recipient.getByRole('button', { name: 'Edit Landscape Frame 2', exact: true }).click();
  for (const width of [320, 390, 768]) {
    await recipient.setViewportSize({ width, height: 844 }); expect(await recipient.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await recipient.getByRole('button', { name: 'Adjust crop', exact: true }).click(); const mobileEditor = recipient.getByRole('dialog', { name: 'Crop frame picture', exact: true });
    expect(await mobileEditor.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true); await mobileEditor.getByRole('button', { name: 'Cancel cropping', exact: true }).click();
  }
  await recipient.setViewportSize({ width: 390, height: 844 }); await recipient.screenshot({ path: `artifacts/frames/${prefix}editor-mobile.png`, fullPage: true });
  await writeFile(`artifacts/frames/${prefix ? 'production' : 'browser'}-validation.json`, JSON.stringify({ address: testInfo.project.use.baseURL, frameDesigns: 4, orientation: true, picturePreserved: true, undoRedo: true, duplicate: true, sharing: true, remix: true, png: true, widths: [320, 390, 768], errors }, null, 2)); expect(errors).toEqual([]); await context.close();
});

test('all frame photo textures follow their aperture and stale loads cannot replace a changed orientation', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true'); const source = await picture(page);
  const objects = giftAssets.filter(a => isFrame(a.id)).map(a => ({ ...createGiftObject(a.id, []), photo: source, crop: { mode: 'fill' as const, zoom: 1, x: 0, y: 0 } }));
  const result = await page.evaluate(async objects => {
    const sceneUrl = '/src/objectScene.ts', threeUrl = '/node_modules/.vite/deps/three.js';
    const { ObjectScene }: typeof import('../../src/objectScene') = await import(sceneUrl); const T: typeof import('three') = await import(threeUrl);
    const errors: string[] = [], engine = new ObjectScene(() => {}, () => errors.push('photo failed'), new T.Texture());
    try {
      engine.sync(objects); await engine.ready();
      const textures = () => objects.map(o => { const model = engine.entries.get(o.uid)!.model, mesh = model.getObjectByName('photo-surface') as import('three').Mesh; const image = (mesh.material as import('three').MeshBasicMaterial).map!.image as HTMLCanvasElement; return { id: o.id, width: image.width, height: image.height, aspect: model.userData.photoAspectRatio, color: Array.from(image.getContext('2d')!.getImageData(image.width / 2, image.height / 2, 1, 1).data) }; });
      const initial = textures(), builds = engine.builds;
      engine.sync(objects.map(o => ({ ...o, position: [1, -1.5, 0] }))); const movedBuilds = engine.builds;
      // Switch twice while the first decode is pending. The discarded frame owns its old texture.
      engine.sync(objects.map(o => ({ ...o, frameOrientation: 'landscape' })));
      engine.sync(objects.map(o => ({ ...o, frameOrientation: 'portrait' }))); await engine.ready();
      return { initial, final: textures(), builds, movedBuilds, errors };
    } finally { engine.dispose(); }
  }, objects);
  expect(result.builds).toBe(4); expect(result.movedBuilds).toBe(4); expect(result.errors).toEqual([]);
  for (const entry of result.initial) expect(entry.width / entry.height).toBeCloseTo(entry.id === 'landscape-frame' ? 1.25 : .8);
  for (const entry of result.final) { expect(entry.width / entry.height).toBeCloseTo(.8); expect(entry.aspect).toBeCloseTo(.8); expect(entry.color[3]).toBe(255); }
});

test('landscape asset studio embeds a correctly proportioned custom photo in its downloadable GLB', async ({ page }) => {
  await mkdir('artifacts/frames', { recursive: true }); await page.goto('/asset-study.html');
  await expect(page.getByTestId('asset-stage')).toHaveAttribute('data-ready', 'true'); await page.locator('button[data-asset="landscape-frame"]').click();
  const source = await picture(page);
  await page.getByLabel('Choose your picture', { exact: true }).setInputFiles({ name: 'wide-moment.png', mimeType: 'image/png', buffer: Buffer.from(source.split(',')[1], 'base64') });
  await expect(page.getByTestId('asset-stage')).toHaveAttribute('data-photo', 'custom');
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download 3D model' }).click(); await (await downloading).saveAs('artifacts/frames/custom-landscape-frame.glb');
  const bytes = await readFile('artifacts/frames/custom-landscape-frame.glb');
  const result = await page.evaluate(async bytes => {
    const loaderUrl = '/node_modules/three/examples/jsm/loaders/GLTFLoader.js', threeUrl = '/node_modules/.vite/deps/three.js';
    const { GLTFLoader }: typeof import('three/addons/loaders/GLTFLoader.js') = await import(loaderUrl), T: typeof import('three') = await import(threeUrl);
    const gltf = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, ''), mesh = gltf.scene.getObjectByName('photo-surface') as import('three').Mesh;
    const image = (mesh.material as import('three').MeshBasicMaterial).map!.image as ImageBitmap;
    const dimensions = new T.Box3().setFromObject(mesh).getSize(new T.Vector3()), floor = new T.Box3().setFromObject(gltf.scene).min.y;
    return { width: image.width, height: image.height, planeWidth: dimensions.x, floor, support: !!gltf.scene.getObjectByName('easel-support') };
  }, Array.from(bytes));
  expect(result).toMatchObject({ width: 1000, height: 800, support: true }); expect(result.planeWidth).toBeCloseTo(.89); expect(Math.abs(result.floor)).toBeLessThan(.0001);
  await page.getByRole('button', { name: 'Front', exact: true }).click(); await page.screenshot({ path: 'artifacts/frames/custom-landscape-glb.png', fullPage: true });
});
