import * as T from 'three';
import { flower, filler, wrapper, ribbon, effectModel, mergeModel, disposeModel } from './models';
import { catalog, type Category } from './catalog';
let renderer: T.WebGLRenderer | undefined;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;
const cache = new Map<string, string>();
export function thumbnail(category: Category, id: string, color?: string) {
  const c = color ?? catalog[category].find(item => item.id === id)!.color;
  const key = `${category}:${id}:${c}`;
  if (cache.has(key)) return cache.get(key)!;
  if (!renderer) { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); renderer.setSize(224, 224); renderer.setPixelRatio(1); renderer.toneMapping = T.ACESFilmicToneMapping; }
  const source = category === 'flowers' ? flower(id, c) : category === 'fillers' ? filler(id, c) : category === 'wrappers' ? wrapper(id, c) : category === 'ribbons' ? ribbon(id, c) : effectModel(id, c);
  if (category === 'flowers' && id === 'tulip') source.rotation.x = -.95;
  const model = mergeModel(source), scene = new T.Scene(); scene.add(model);
  scene.add(new T.HemisphereLight('#fff9f2', '#817983', 1.65)); const light = new T.DirectionalLight('#fff5e9', 2.5); light.position.set(-3, 5, 4); scene.add(light);
  const rim = new T.DirectionalLight('#e5eaff', 1.8); rim.position.set(4, 2, -3); scene.add(rim);
  const fill = new T.DirectionalLight('#fff4f1', .7); fill.position.set(0, 0, 6); scene.add(fill);
  const bounds = new T.Box3().setFromObject(model), center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
  model.position.sub(center);
  const camera = new T.PerspectiveCamera(35, 1, .01, 30), distance = Math.max(size.x, size.y, size.z) * 2.2;
  camera.position.set(distance * .2, distance * .14, distance); camera.lookAt(0, 0, 0);
  renderer.setClearColor('#ffffff', 0); renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png'); cache.set(key, url); disposeModel(model);
  while (cache.size > 80) cache.delete(cache.keys().next().value!);
  clearTimeout(releaseTimer); releaseTimer = setTimeout(releaseThumbnailRenderer, 1200);
  return url;
}
export function releaseThumbnailRenderer() { renderer?.dispose(); renderer?.forceContextLoss(); renderer = undefined; }
