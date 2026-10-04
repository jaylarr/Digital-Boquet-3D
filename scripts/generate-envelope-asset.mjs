/* global process, console, btoa */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:5193'}/asset-study.html`);
  await page.waitForSelector('[data-ready="true"]');
  const asset = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js');
    const { createGiftModel, disposeGiftModel, giftAssets } = await import('/src/giftModels.ts');
    const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true }); renderer.setSize(480, 420); renderer.toneMapping = T.ACESFilmicToneMapping;
    const scene = new T.Scene(); scene.add(new T.HemisphereLight('#fff9ef', '#859477', 2));
    const key = new T.DirectionalLight('#fff4e4', 3); key.position.set(-3, 5, 4); scene.add(key);
    const model = createGiftModel('sealed-envelope'); scene.add(model);
    const bounds = new T.Box3().setFromObject(model), center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
    const camera = new T.PerspectiveCamera(32, 480 / 420, .01, 100); camera.position.set(.75, center.y + .2, 3.4); camera.lookAt(center); renderer.render(scene, camera);
    const png = renderer.domElement.toDataURL(), glb = new Uint8Array(await new GLTFExporter().parseAsync(model, { binary: true }));
    let binary = ''; for (let i = 0; i < glb.length; i += 32768) binary += String.fromCharCode(...glb.subarray(i, i + 32768));
    const result = { ...giftAssets.find(a => a.id === 'sealed-envelope'), png, glb: btoa(binary), bytes: glb.length, size: size.toArray(), floor: bounds.min.y, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    disposeGiftModel(model); renderer.dispose(); renderer.forceContextLoss(); return result;
  });
  await mkdir('public/models', { recursive: true });
  await writeFile('public/models/sealed-envelope.png', Buffer.from(asset.png.split(',')[1], 'base64'));
  await writeFile('public/models/sealed-envelope.glb', Buffer.from(asset.glb, 'base64'));
  const manifest = JSON.parse(await readFile('public/models/manifest.json', 'utf8'));
  manifest.assets = manifest.assets.filter(a => a.id !== asset.id);
  manifest.assets.push({ id: asset.id, name: asset.name, note: asset.note, color: asset.color, file: `${asset.id}.glb`, thumbnail: `${asset.id}.png`, bytes: asset.bytes, size: asset.size, floor: asset.floor, calls: asset.calls, triangles: asset.triangles, interactive: 'Click to open a formatted note in the bouquet studio' });
  await writeFile('public/models/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ id: asset.id, bytes: asset.bytes, calls: asset.calls, triangles: asset.triangles }));
} finally { await browser.close(); }
