import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';

test('botanical models render from front, side, and back', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  const images = await page.evaluate(async () => {
    const threeUrl = '/node_modules/.vite/deps/three.js', modelsUrl = '/src/models.ts', catalogUrl = '/src/catalog.ts';
    const T: typeof import('three') = await import(threeUrl);
    const { flower, mergeModel, disposeModel }: typeof import('../../src/models') = await import(modelsUrl);
    const { catalog }: typeof import('../../src/catalog') = await import(catalogUrl);
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(320, 320); renderer.toneMapping = T.ACESFilmicToneMapping;
    const scene = new T.Scene(); scene.add(new T.HemisphereLight('#fff9f2', '#817983', 1.65));
    const key = new T.DirectionalLight('#fff5e9', 2.5); key.position.set(-3, 5, 4); scene.add(key);
    const fill = new T.DirectionalLight('#e5eaff', 1.8); fill.position.set(4, 2, -3); scene.add(fill);
    const front = new T.DirectionalLight('#fff4f1', .7); front.position.set(0, 0, 6); scene.add(front);
    const camera = new T.PerspectiveCamera(35, 1, .01, 30), images: { name: string; views: string[] }[] = [];
    for (const item of catalog.flowers) {
      const source = flower(item.id, item.color);
      if (item.id === 'tulip') source.rotation.x = -.95;
      const model = mergeModel(source); scene.add(model);
      const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3()); model.position.sub(bounds.getCenter(new T.Vector3()));
      const distance = Math.max(size.x, size.y, size.z) * 2.2, views: string[] = [];
      for (const angle of [0, Math.PI / 2, Math.PI]) {
        camera.position.set(Math.sin(angle) * distance, distance * .14, Math.cos(angle) * distance); camera.lookAt(0, 0, 0);
        renderer.setClearColor('#ffffff', 0); renderer.render(scene, camera); views.push(renderer.domElement.toDataURL());
      }
      images.push({ name: item.name, views }); scene.remove(model); disposeModel(model);
    }
    renderer.dispose(); renderer.forceContextLoss(); return images;
  });
  expect(images).toHaveLength(10);
  await page.setContent(`<html><body style="background:#faf7f2;color:#493e46;font:16px system-ui;margin:32px"><h1>Botanical study · front / side / back</h1><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">${images.map(item => `<section style="background:white;border-radius:16px;padding:16px"><h2>${item.name}</h2><div style="display:flex">${item.views.map(src => `<img style="width:33.33%" src="${src}">`).join('')}</div></section>`).join('')}</div></body></html>`);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.screenshot({ path: 'artifacts/botanical-study.png', fullPage: true });
});

test('all wrappers fit an animated bouquet from front, side, and back without rebuilding flowers', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  const study = await page.evaluate(async () => {
    const threeUrl = '/node_modules/.vite/deps/three.js', animationUrl = '/src/animation.ts', configUrl = '/src/config.ts', catalogUrl = '/src/catalog.ts';
    const T: typeof import('three') = await import(threeUrl);
    const { AnimatedBouquet }: typeof import('../../src/animation') = await import(animationUrl);
    const { starter, clone }: typeof import('../../src/config') = await import(configUrl);
    const { catalog }: typeof import('../../src/catalog') = await import(catalogUrl);
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); renderer.setSize(400, 480); renderer.toneMapping = T.ACESFilmicToneMapping;
    const scene = new T.Scene(); scene.add(new T.HemisphereLight('#fff9f2', '#817983', 1.65));
    const key = new T.DirectionalLight('#fff5e9', 2.5); key.position.set(-3, 5, 4); scene.add(key);
    const fill = new T.DirectionalLight('#e5eaff', 1.4); fill.position.set(4, 2, 3); scene.add(fill);
    const engine = new AnimatedBouquet(); scene.add(engine.group); const config = clone(starter);
    const camera = new T.PerspectiveCamera(35, 400 / 480, .1, 30), images: { id: string; name: string; views: string[]; calls: number; triangles: number; modelBuilds: number }[] = [];
    try {
      for (const item of catalog.wrappers) {
        config.wrapper = { id: item.id, color: item.color }; engine.sync(config, false);
        const views: string[] = [];
        for (const angle of [.18, Math.PI / 2, Math.PI]) {
          camera.position.set(Math.sin(angle) * 6.7, .25 + 6.7 * .09, Math.cos(angle) * 6.7); camera.lookAt(0, .25, 0);
          renderer.setClearColor('#f8ecef', 1); renderer.render(scene, camera); views.push(renderer.domElement.toDataURL());
        }
        images.push({ id: item.id, name: item.name, views, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, modelBuilds: engine.metrics().modelBuilds });
      }
      return images;
    } finally { engine.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  });
  expect(study).toHaveLength(10);
  for (const item of study) { expect(item.modelBuilds).toBe(study[0].modelBuilds); expect(item.calls).toBeLessThan(20); expect(item.triangles).toBeLessThan(45000); }
  for (const id of ['classic-cone', 'gift-bag']) await writeFile(`artifacts/wrapper-${id}.png`, Buffer.from(study.find(s => s.id === id)!.views[0].split(',')[1], 'base64'));
  await page.setContent(`<html><body style="background:#faf7f2;color:#493e46;font:16px system-ui;margin:28px"><h1>Wrapper study · front / side / back</h1><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">${study.map(item => `<section style="background:white;border-radius:16px;padding:12px"><h2>${item.name}</h2><div style="display:flex">${item.views.map(src => `<img style="width:33.33%" src="${src}">`).join('')}</div></section>`).join('')}</div></body></html>`);
  await page.setViewportSize({ width: 1400, height: 1000 }); await page.screenshot({ path: 'artifacts/wrapper-study.png', fullPage: true });
  expect(errors).toEqual([]);
});
