import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createGiftModel, disposeGiftModel, giftAssets, photoTextureFromFile, type GiftAssetId } from './giftModels';
import { isFrame, frameShape } from './giftCatalog';
import './assetStudy.css';

const root = document.getElementById('asset-root')!;
root.innerHTML = `<main class="study"><nav class="study-nav"><a class="brand" href="./">petal<span>pop</span> ✿</a><span>THE OBJECT COLLECTION / 01</span></nav><div class="eyebrow">A little more personality</div><h1>Little extras. Big feelings.</h1><p class="lede">Nine little extras for something truly yours. Turn them around, explore every detail, and put your favorite memory in the frame.</p><div class="workspace"><div class="stage" data-testid="asset-stage"><div class="stage-caption">THE LITTLE OBJECT STUDIO</div><div class="views" role="group" aria-label="Model view">${[['front','Front'],['quarter','¾ view'],['side','Side'],['back','Back']].map(([id,label]) => `<button data-view="${id}" aria-pressed="${id === 'quarter'}">${label}</button>`).join('')}</div><div class="gesture">Drag to turn · scroll or pinch to zoom</div></div><aside class="details"><div class="number" id="asset-number"></div><h2 id="asset-name"></h2><p class="description" id="asset-description"></p><div class="chips"><span>Full 3D</span><span>Original artwork</span><span>GLB download</span></div><div class="detail-spacer"></div><div class="photo-tools" hidden><label class="upload-label">＋ Choose your picture<input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose your picture"></label><p class="photo-note">JPG, PNG or WebP · up to 15 MB<br>Your full picture fits inside the frame.<br>Preview stays on this device.</p><button class="secondary" id="reset-photo">Use sample picture</button></div><button class="download" id="download-model">Download 3D model ↓</button><p class="status" role="status" aria-live="polite"></p></aside></div><div class="cards" role="group" aria-label="Choose an object">${giftAssets.map((a,i) => `<button class="asset-card" data-asset="${a.id}" aria-pressed="${i === 0}"><img src="./models/${a.id}.png" alt="" width="180" height="110"><strong>${a.name}</strong><small>0${i+1} / ${isFrame(a.id) ? 'YOUR PHOTO' : 'LITTLE COMPANION'}</small></button>`).join('')}</div><footer class="study-footer"><span>Made to be seen from every side. A small collection of original, softly styled objects.</span><span><a href="./models/manifest.json">Asset details</a> · <a href="./">Back to bouquet studio</a></span></footer></main>`;

const stage = root.querySelector<HTMLElement>('.stage')!, status = root.querySelector<HTMLElement>('.status')!;
const descriptions: Record<GiftAssetId, string> = {
  'teddy-bear': 'A soft seated teddy with warm cream details, tiny stitched paw pads and a dusty rose bow. A little hug, in 3D.',
  'heart-balloon': 'A plump rose heart with a fine sealed edge, little foil crinkles and a curling ribbon. A little celebration.',
  'cute-puppy': 'A golden little friend with soft floppy ears, a happy pink tongue and a sage collar. Ready to sit beside your flowers.',
  'cute-kitten': 'A curious ginger kitten with tabby markings, pink ears, delicate whiskers and a tail that curls around its side.',
  'standing-frame': 'Your memory, beautifully framed. Warm oak, a soft cream mat and a hinged easel at the back keep it standing.',
  'landscape-frame': 'Room for a bigger memory. A wide oak frame with a cream mat, warm wood grain and a sturdy rear easel.',
  'golden-frame': 'A little golden keepsake. Polished metallic rails, delicate inset trim and decorative corner studs surround your picture.',
  'snapshot-frame': 'A playful instant-photo silhouette, with a soft ivory finish, a generous lower border and its own standing easel.',
  'sealed-envelope': 'A softly folded envelope with a heart stamped into a rose wax seal. Add it in the bouquet studio and tuck a personal, formatted note inside.',
};

try {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D gift object preview'); stage.prepend(renderer.domElement);
  const scene = new T.Scene(); scene.add(new T.HemisphereLight('#fff9ef', '#859477', 2.0));
  const key = new T.DirectionalLight('#fff4e4', 3.1); key.position.set(-3, 5, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 3; key.shadow.camera.bottom = -2; key.shadow.bias = -.0003; key.shadow.normalBias = .016; key.shadow.radius = 5; scene.add(key);
  const fill = new T.DirectionalLight('#e6ecff', 1.35); fill.position.set(4, 3, -2); scene.add(fill);
  const env = new RoomEnvironment(), pmrem = new T.PMREMGenerator(renderer), environment = pmrem.fromScene(env, .04);
  scene.environment = environment.texture; env.dispose(); pmrem.dispose();
  const ground = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: .15 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.position.y = -.005; scene.add(ground);
  const camera = new T.PerspectiveCamera(32, 1, .01, 100), controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false; controls.enablePan = false; controls.minPolarAngle = .12; controls.maxPolarAngle = Math.PI * .51;
  let model: T.Group | undefined, active: GiftAssetId = 'teddy-bear', uploadVersion = 0, disposed = false;
  let distance = 4, center = new T.Vector3(0, .8, 0);
  // Reserve a separate strip for the view buttons so they never cover paws/feet.
  const viewportHeight = () => Math.max(100, stage.clientHeight - 78);
  function render() { if (!disposed && document.visibilityState !== 'hidden') renderer.render(scene, camera); }
  function setView(view: string) {
    const angle = { front: 0, quarter: .48, side: Math.PI / 2, back: Math.PI }[view] ?? .48;
    camera.position.set(center.x + Math.sin(angle) * distance, center.y + distance * .11, center.z + Math.cos(angle) * distance); controls.target.copy(center); controls.update(); render();
    root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  }
  function select(id: GiftAssetId, photo?: T.Texture) {
    if (model) { scene.remove(model); disposeGiftModel(model); }
    active = id; model = createGiftModel(id, { photo }); scene.add(model);
    const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3()); center = bounds.getCenter(new T.Vector3());
    const aspect = stage.clientWidth / viewportHeight();
    distance = Math.max(size.y, size.x / Math.min(aspect, 1)) * 2.55;
    controls.minDistance = distance * .52; controls.maxDistance = distance * 1.9;
    const item = giftAssets.find(a => a.id === id)!;
    root.querySelector('#asset-number')!.textContent = `OBJECT 0${giftAssets.indexOf(item) + 1} / 0${giftAssets.length}`;
    root.querySelector('#asset-name')!.textContent = item.name; root.querySelector('#asset-description')!.textContent = descriptions[id];
    root.querySelector<HTMLElement>('.photo-tools')!.hidden = !isFrame(id);
    root.querySelectorAll<HTMLButtonElement>('[data-asset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.asset === id)));
    stage.dataset.asset = id; stage.dataset.photo = photo ? 'custom' : 'sample'; stage.dataset.ready = 'true'; setView('quarter');
  }
  const observer = new ResizeObserver(() => { renderer.setSize(stage.clientWidth, viewportHeight()); camera.aspect = stage.clientWidth / viewportHeight(); camera.updateProjectionMatrix(); render(); }); observer.observe(stage);
  controls.addEventListener('change', render);
  root.querySelectorAll<HTMLButtonElement>('[data-asset]').forEach(button => button.addEventListener('click', () => { uploadVersion++; select(button.dataset.asset as GiftAssetId); status.textContent = ''; }));
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view!)));
  const upload = root.querySelector<HTMLInputElement>('#photo-upload')!;
  upload.addEventListener('change', async () => {
    const file = upload.files?.[0]; if (!file) return;
    const version = ++uploadVersion; status.textContent = 'Preparing your picture…';
    try {
      const photo = await photoTextureFromFile(file, frameShape(active).aspect);
      if (disposed || version !== uploadVersion || !isFrame(active)) { photo.dispose(); return; }
      select(active, photo); status.textContent = 'Your picture is in the frame. Download includes it.';
    } catch (err) { if (version === uploadVersion) status.textContent = err instanceof Error ? err.message : 'This picture could not be opened.'; }
    finally { upload.value = ''; }
  });
  root.querySelector('#reset-photo')!.addEventListener('click', () => { uploadVersion++; select(active); status.textContent = 'Sample picture restored.'; });
  root.querySelector<HTMLButtonElement>('#download-model')!.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement; button.disabled = true;
    status.textContent = 'Preparing your 3D model…';
    // Export a snapshot so selecting another asset cannot dispose an in-flight export.
    const snapshot = model!.clone(true), geometries: T.BufferGeometry[] = [], materials: T.Material[] = [], textures: T.Texture[] = [];
    snapshot.traverse(obj => { if (obj instanceof T.Mesh) { obj.geometry = obj.geometry.clone(); geometries.push(obj.geometry); const m = (obj.material as T.MeshStandardMaterial).clone(); if (m.map) { m.map = m.map.clone(); textures.push(m.map); } obj.material = m; materials.push(m); } });
    const filename = active;
    try {
      const data = await new GLTFExporter().parseAsync(snapshot, { binary: true });
      const url = URL.createObjectURL(new Blob([data as ArrayBuffer], { type: 'model/gltf-binary' }));
      const link = document.createElement('a'); link.href = url; link.download = `${filename}.glb`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Your model is ready.';
    } catch { status.textContent = 'Could not prepare the download. Please try again.'; }
    finally { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); button.disabled = false; }
  });
  document.addEventListener('visibilitychange', render);
  window.addEventListener('pagehide', () => { disposed = true; uploadVersion++; observer.disconnect(); controls.dispose(); if (model) disposeGiftModel(model); environment.dispose(); ground.geometry.dispose(); (ground.material as T.Material).dispose(); renderer.dispose(); renderer.forceContextLoss(); }, { once: true });
  renderer.setSize(stage.clientWidth, viewportHeight()); camera.aspect = stage.clientWidth / viewportHeight(); camera.updateProjectionMatrix(); select(active);
} catch {
  stage.innerHTML = '<p class="fatal">The 3D preview needs WebGL. Try a browser with graphics acceleration enabled. You can still download the models below.</p>';
  root.querySelectorAll<HTMLButtonElement>('[data-asset]').forEach(button => { button.addEventListener('click', () => { const id = button.dataset.asset!; root.querySelector('#asset-name')!.textContent = giftAssets.find(a => a.id === id)!.name; const download = root.querySelector<HTMLButtonElement>('#download-model')!; download.onclick = () => { const a = document.createElement('a'); a.href = `./models/${id}.glb`; a.download = `${id}.glb`; a.click(); }; }); });
  root.querySelector<HTMLButtonElement>('[data-asset]')!.click();
}
