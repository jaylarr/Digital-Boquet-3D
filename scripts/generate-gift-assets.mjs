/* global process, console, btoa */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:5190'}/asset-study.html`);
  await page.waitForSelector('[data-ready="true"]');
  const assets = await page.evaluate(async () => {
    const threeUrl = '/node_modules/.vite/deps/three.js', modelUrl = '/src/giftModels.ts';
    const exporterUrl = '/node_modules/three/examples/jsm/exporters/GLTFExporter.js', loaderUrl = '/node_modules/three/examples/jsm/loaders/GLTFLoader.js', envUrl = '/node_modules/three/examples/jsm/environments/RoomEnvironment.js';
    const T = await import(threeUrl), { createGiftModel, disposeGiftModel, giftAssets } = await import(modelUrl);
    const { GLTFExporter } = await import(exporterUrl), { GLTFLoader } = await import(loaderUrl), { RoomEnvironment } = await import(envUrl);
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); renderer.setSize(480, 540); renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene(); scene.add(new T.HemisphereLight('#fff9ef', '#859477', 2));
    const key = new T.DirectionalLight('#fff4e4', 3.1); key.position.set(-3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 3; key.shadow.camera.bottom = -3; key.shadow.normalBias = .015; key.shadow.bias = -.0003; scene.add(key);
    const fill = new T.DirectionalLight('#e6ecff', 1.35); fill.position.set(4, 3, -2); scene.add(fill);
    const env = new RoomEnvironment(), pmrem = new T.PMREMGenerator(renderer), environment = pmrem.fromScene(env, .04); scene.environment = environment.texture; env.dispose(); pmrem.dispose();
    const ground = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: .14 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.005; ground.receiveShadow = true; scene.add(ground);
    const camera = new T.PerspectiveCamera(32, 480 / 540, .01, 100), result = [];
    function base64(bytes) { let text = ''; for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(text); }
    for (const item of giftAssets) {
      const model = createGiftModel(item.id); scene.add(model);
      const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
      const distance = Math.max(size.y, size.x * 1.13, size.z * 1.13) * 2.12, views = [];
      for (const angle of [0, .52, Math.PI / 2, Math.PI]) {
        camera.position.set(center.x + Math.sin(angle) * distance, center.y + distance * .095, center.z + Math.cos(angle) * distance); camera.lookAt(center);
        renderer.setClearColor('#eeeee5', 1); renderer.render(scene, camera); views.push(renderer.domElement.toDataURL('image/png'));
      }
      const glb = await new GLTFExporter().parseAsync(model, { binary: true });
      const reloaded = await new GLTFLoader().parseAsync(glb, '');
      const reloadSize = new T.Box3().setFromObject(reloaded.scene).getSize(new T.Vector3());
      if (size.distanceTo(reloadSize) > .0001) throw new Error(`${item.id} export bounds changed`);
      result.push({ ...item, revision: model.userData.revision, photoAspectRatio: model.userData.photoAspectRatio, frameOrientation: model.userData.frameOrientation, views, glb: base64(new Uint8Array(glb)), bytes: glb.byteLength, size: size.toArray(), floor: bounds.min.y, calls: renderer.info.render.calls - 1, triangles: renderer.info.render.triangles - 2, reloaded: true });
      scene.remove(model); disposeGiftModel(model); disposeGiftModel(reloaded.scene);
    }
    environment.dispose(); ground.geometry.dispose(); ground.material.dispose(); renderer.dispose(); renderer.forceContextLoss(); return result;
  });
  await mkdir('public/models', { recursive: true }); await mkdir('artifacts/gift-models', { recursive: true });
  const labels = ['Front', 'Three-quarter', 'Side', 'Back'];
  for (const asset of assets) {
    await writeFile(`public/models/${asset.id}.glb`, Buffer.from(asset.glb, 'base64'));
    await writeFile(`public/models/${asset.id}.png`, Buffer.from(asset.views[1].split(',')[1], 'base64'));
    for (let i = 0; i < labels.length; i++) await writeFile(`artifacts/gift-models/${asset.id}-${i}.png`, Buffer.from(asset.views[i].split(',')[1], 'base64'));
    await page.setContent(`<html><body style="margin:0;padding:24px;background:#f9f7ef;color:#464c40;font:16px system-ui"><h1 style="font-weight:500">${asset.name} · revision ${asset.revision}</h1><div style="display:flex">${asset.views.map((src, i) => `<div style="width:25%;text-align:center"><img src="${src}" style="width:100%;display:block"><p>${labels[i]}</p></div>`).join('')}</div></body></html>`);
    await page.setViewportSize({ width: 1600, height: 630 }); await page.screenshot({ path: `artifacts/gift-models/${asset.id}-study.png`, fullPage: true });
  }
  await page.setContent(`<html><body style="margin:0;padding:24px;background:#f9f7ef;color:#464c40;font:16px system-ui"><h1 style="font-weight:500">Little extras · original 3D asset study</h1><p>Front / three-quarter / side / back · real model renders</p>${assets.map(asset => `<section><h2 style="font-weight:500;font-size:20px;margin:20px 0 10px">${asset.name}</h2><div style="display:flex">${asset.views.map(src => `<img src="${src}" style="width:25%;display:block">`).join('')}</div></section>`).join('')}</body></html>`);
  await page.setViewportSize({ width: 1280, height: 900 }); await page.screenshot({ path: 'artifacts/gift-models/contact-sheet.png', fullPage: true });
  const manifest = { revision: Math.max(...assets.map(a => a.revision)), generated: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), units: 'Decorative scene units; Y up; front +Z; ground Y=0', static: true, assets: assets.map(({ id, name, note, color, bytes, size, floor, calls, triangles, reloaded, photoAspectRatio, frameOrientation }) => ({ id, name, note, color, file: `${id}.glb`, thumbnail: `${id}.png`, bytes, size, floor, calls, triangles, reloaded, ...(photoAspectRatio ? { photoSurface: 'photo-surface', photoAspectRatio, frameOrientation, photoFit: 'contain' } : {}) })) };
  await writeFile('public/models/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2)); if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
