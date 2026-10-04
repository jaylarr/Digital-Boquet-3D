import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';

test('maximum spread contacts contain all wrappers during sway and edits and match baked exports', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  const study = await page.evaluate(async () => {
    const urls = ['/node_modules/.vite/deps/three.js', '/src/animation.ts', '/src/models.ts', '/src/config.ts', '/src/catalog.ts'];
    const T: typeof import('three') = await import(urls[0]);
    const { AnimatedBouquet, collisionLayout }: typeof import('../../src/animation') = await import(urls[1]);
    const { buildBouquet, disposeModel }: typeof import('../../src/models') = await import(urls[2]);
    const { starter, clone }: typeof import('../../src/config') = await import(urls[3]);
    const { catalog }: typeof import('../../src/catalog') = await import(urls[4]);
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); renderer.setSize(400, 480); renderer.toneMapping = T.ACESFilmicToneMapping;
    const scene = new T.Scene(); scene.add(new T.HemisphereLight('#fff9f2', '#817983', 1.65));
    const key = new T.DirectionalLight('#fff5e9', 2.5); key.position.set(-3, 5, 4); scene.add(key);
    const fill = new T.DirectionalLight('#e5eaff', 1.4); fill.position.set(4, 2, 3); scene.add(fill);
    const engine = new AnimatedBouquet(); scene.add(engine.group); const config = clone(starter);
    config.flowers = [{ id: 'rose', color: '#e8a0af', count: 8 }, { id: 'tulip', color: '#efbaa0', count: 8 }, { id: 'lavender', color: '#af97c7', count: 8 }];
    config.fillers = [{ id: 'eucalyptus', color: '#89aaa0', count: 6 }, { id: 'fern', color: '#8bab84', count: 6 }]; config.size = config.spread = 1.2;
    const camera = new T.PerspectiveCamera(35, 400 / 480, .1, 30), results: { id: string; name: string; views: string[]; calls: number; triangles: number; difference: number; exportView: string }[] = [];
    const aim = (angle: number) => { camera.position.set(Math.sin(angle) * 7.4, .3 + 7.4 * .09, Math.cos(angle) * 7.4); camera.lookAt(0, .3, 0); };
    try {
      for (const item of catalog.wrappers) {
        config.wrapper = { id: item.id, color: item.color }; engine.sync(config, false);
        const builds = engine.metrics().modelBuilds, profile = engine.boundary.profile;
        config.flowers[0].count--; engine.sync(config, true);
        for (let i = 0; i < 12; i++) engine.step(i / 30, 1 / 30, true);
        config.flowers[0].count++; engine.sync(config, true);
        for (let i = 0; i < 24; i++) engine.step(.4 + i / 30, 1 / 30, true);
        if (engine.metrics().modelBuilds !== builds || engine.boundary.profile !== profile) throw new Error('Contact update rebuilt a cached model');
        const views: string[] = [];
        for (const angle of [.18, Math.PI / 2, Math.PI]) {
          aim(angle); renderer.setClearColor('#f8ecef', 1); renderer.render(scene, camera); views.push(renderer.domElement.toDataURL());
        }
        const calls = renderer.info.render.calls, triangles = renderer.info.render.triangles;
        // Render the exact live mesh poses with CPU-baked contacts. GPU silhouette must match.
        aim(Math.PI / 2); renderer.setClearColor('#ffffff', 0); renderer.render(scene, camera);
        const gl = renderer.getContext(), livePixels = new Uint8Array(400 * 480 * 4), bakedPixels = new Uint8Array(livePixels.length);
        gl.readPixels(0, 0, 400, 480, gl.RGBA, gl.UNSIGNED_BYTE, livePixels);
        const baked = new T.Group(), matrix = new T.Matrix4(), point = new T.Vector3();
        engine.group.traverse(object => {
          if (!(object instanceof T.Mesh)) return;
          const count = object instanceof T.InstancedMesh ? object.count : 1;
          for (let i = 0; i < count; i++) {
            const geometry = object.geometry.clone();
            if (object instanceof T.InstancedMesh) { object.getMatrixAt(i, matrix); geometry.applyMatrix4(matrix); if (object.userData.wrapperContact) { const p = geometry.getAttribute('position'); for (let j = 0; j < p.count; j++) { point.fromBufferAttribute(p, j); profile!.constrain(point); p.setXYZ(j, point.x, point.y, point.z); } } }
            else geometry.applyMatrix4(object.matrixWorld);
            baked.add(new T.Mesh(geometry, (object.material as import('three').Material).clone()));
          }
        });
        engine.group.visible = false; scene.add(baked); renderer.render(scene, camera); gl.readPixels(0, 0, 400, 480, gl.RGBA, gl.UNSIGNED_BYTE, bakedPixels);
        let difference = 0; for (let i = 3; i < livePixels.length; i += 4) if (Math.abs(livePixels[i] - bakedPixels[i]) > 30) difference++;
        scene.remove(baked); disposeModel(baked);
        const full = buildBouquet(config, collisionLayout(config)); scene.add(full); aim(Math.PI / 2); renderer.setClearColor('#f8ecef', 1); renderer.render(scene, camera);
        const exportView = renderer.domElement.toDataURL(); scene.remove(full); disposeModel(full); engine.group.visible = true;
        results.push({ id: item.id, name: item.name, views, calls, triangles, difference, exportView });
      }
      return results;
    } finally { engine.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  });
  expect(study).toHaveLength(10);
  for (const item of study) { expect(item.calls).toBeLessThan(20); expect(item.triangles).toBeLessThan(150000); expect(item.difference, `${item.id}: GPU/baked silhouette`).toBeLessThan(100); }
  await writeFile('artifacts/wrapper-contacts.json', JSON.stringify(study.map(({ id, calls, triangles, difference }) => ({ id, calls, triangles, differentSilhouettePixels: difference })), null, 2));
  await writeFile('artifacts/maximum-spread-contacts.png', Buffer.from(study[0].views[1].split(',')[1], 'base64'));
  await page.setContent(`<html><body style="background:#faf7f2;color:#493e46;font:16px system-ui;margin:28px"><h1>Maximum spread · wrapper contacts</h1><p>24 flowers + 12 fillers · size 1.2 · spread 1.2 · front / side / back / PNG geometry</p><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">${study.map(item => `<section style="background:white;border-radius:16px;padding:12px"><h2>${item.name}</h2><div style="display:flex">${[...item.views, item.exportView].map(src => `<img style="width:25%" src="${src}">`).join('')}</div></section>`).join('')}</div></body></html>`);
  await page.setViewportSize({ width: 1500, height: 1000 }); await page.screenshot({ path: 'artifacts/wrapper-contacts-study.png', fullPage: true });
  expect(errors).toEqual([]);
});
