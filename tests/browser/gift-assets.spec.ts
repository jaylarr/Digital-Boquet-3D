import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { giftAssets } from '../../src/giftCatalog';

test('all assets render, frame accepts a full picture, and custom GLB reopens', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/asset-study.html');
  const stage = page.getByTestId('asset-stage'); await expect(stage).toHaveAttribute('data-ready', 'true');
  for (const { id } of giftAssets) {
    await page.locator(`button[data-asset="${id}"]`).click(); await expect(stage).toHaveAttribute('data-asset', id);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: '¾ view', exact: true }).click();
  }
  await page.locator('button[data-asset="standing-frame"]').click();
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 360;
    const c = canvas.getContext('2d')!; c.fillStyle = '#76adbd'; c.fillRect(0, 0, 720, 360);
    c.fillStyle = '#d86c88'; c.fillRect(0, 0, 120, 360); c.fillStyle = '#e3b359'; c.fillRect(600, 0, 120, 360);
    c.fillStyle = '#fff'; c.font = 'bold 46px sans-serif'; c.textAlign = 'center'; c.fillText('TOP ↑', 360, 70); c.fillText('Our little memory', 360, 195); c.fillText('BOTTOM', 360, 320); return canvas.toDataURL();
  });
  const picture = Buffer.from(fixture.split(',')[1], 'base64'); await writeFile('artifacts/gift-models/test-picture.png', picture);
  await page.getByLabel('Choose your picture', { exact: true }).setInputFiles({ name: 'memory.png', mimeType: 'image/png', buffer: picture });
  await expect(stage).toHaveAttribute('data-photo', 'custom'); await expect(page.getByRole('status')).toContainText('Your picture is in the frame');
  await page.getByRole('button', { name: 'Front', exact: true }).click(); await page.screenshot({ path: 'artifacts/gift-models/custom-picture-front.png', fullPage: true });
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download 3D model' }).click();
  const download = await downloading; await download.saveAs('artifacts/gift-models/custom-frame.glb');
  const data = await readFile('artifacts/gift-models/custom-frame.glb');
  const result = await page.evaluate(async bytes => {
    const loaderUrl = '/node_modules/three/examples/jsm/loaders/GLTFLoader.js', threeUrl = '/node_modules/.vite/deps/three.js';
    const { GLTFLoader }: typeof import('three/addons/loaders/GLTFLoader.js') = await import(loaderUrl);
    const T: typeof import('three') = await import(threeUrl);
    const gltf = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '');
    const picture = gltf.scene.getObjectByName('photo-surface') as import('three').Mesh;
    const material = picture.material as import('three').MeshStandardMaterial;
    const image = material.map!.image as ImageBitmap;
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const c = canvas.getContext('2d')!; c.drawImage(image, 0, 0); const pixels = c.getImageData(0, 0, canvas.width, canvas.height);
    // GLTFExporter vertically flips embedded textures; GLTFLoader disables flipY.
    const colorAt = (x: number, y: number) => Array.from(pixels.data.slice((y * canvas.width + x) * 4, (y * canvas.width + x) * 4 + 3));
    const bounds = new T.Box3().setFromObject(gltf.scene), center = bounds.getCenter(new T.Vector3());
    const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setSize(480, 580); renderer.setClearColor('#eeeee5'); renderer.toneMapping = T.ACESFilmicToneMapping;
    const scene = new T.Scene(); scene.add(gltf.scene, new T.HemisphereLight('#fff9ef', '#859477', 2));
    const light = new T.DirectionalLight('#fff4e4', 3); light.position.set(-3, 5, 4); scene.add(light);
    const camera = new T.PerspectiveCamera(32, 480 / 580, .01, 30); camera.position.set(0, center.y + .1, 3.7); camera.lookAt(center);
    // The GLB unlit extension preserves the uploaded picture; avoid export preview tone mapping.
    material.toneMapped = false; renderer.render(scene, camera); const screenshot = renderer.domElement.toDataURL(); renderer.dispose(); renderer.forceContextLoss();
    return { picture: !!picture, support: !!gltf.scene.getObjectByName('easel-support'), size: [image.width, image.height], left: colorAt(50, 500), right: colorAt(750, 500), floor: bounds.min.y, screenshot };
  }, Array.from(data));
  expect(result.picture).toBe(true); expect(result.support).toBe(true); expect(result.size).toEqual([800, 1000]);
  expect(result.left[0]).toBeGreaterThan(result.left[1]); expect(result.right[0]).toBeGreaterThan(result.right[2]); expect(Math.abs(result.floor)).toBeLessThan(.0001);
  await writeFile('artifacts/gift-models/custom-frame-reloaded.png', Buffer.from(result.screenshot.split(',')[1], 'base64'));
  await page.getByRole('button', { name: 'Use sample picture' }).click(); await expect(stage).toHaveAttribute('data-photo', 'sample');
  await page.getByLabel('Choose your picture', { exact: true }).setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('status')).toContainText('Choose a JPG'); await expect(stage).toHaveAttribute('data-photo', 'sample');
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('button[data-asset="cute-kitten"]').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/gift-models/studio-mobile.png', fullPage: true }); expect(errors).toEqual([]);
});
