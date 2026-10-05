import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { BouquetConfigV1 } from './config';
import { random } from './config.ts';
import { layout } from './layout.ts';
import { stemBase } from './flowerArrangement.ts';
import { bouquetGround, objectGroundOffset } from './sceneGround.ts';
import { emptyNote, noteText } from './notes.ts';
import { frameOrientation, giftAssets, isFrame, OBJECT_BOUNDS, OBJECT_FLOOR, OBJECT_LIMIT, type GiftObject } from './giftCatalog.ts';
import measuredBounds from './placement-bounds.json' with { type: 'json' };

const bounds: Record<string, number[][]> = measuredBounds;
export const SURPRISE_CLEARANCE = .12;
const FRONT = new Vector3(0, 0, 1);
const unitScale = new Vector3(1, 1, 1);
function localBounds(key: string) { const [min, max] = bounds[key]; return new Box3(new Vector3(...min), new Vector3(...max)); }

/** Measured catalog geometry, with extra space for head contacts and live sway. */
export function surpriseBouquetBounds(config: BouquetConfigV1): Box3[] {
  const result = [localBounds(`wrappers:${config.wrapper.id}`), localBounds(`ribbons:${config.wrapper.id}:${config.ribbon.id}`)];
  const placed = layout(config);
  for (const [category, entries] of [['flowers', placed.flowers], ['fillers', placed.fillers]] as const) for (const p of entries) {
    const [x, , z] = p.position;
    const rotation = category === 'flowers' && p.id !== 'lavender'
      ? new Quaternion().setFromUnitVectors(FRONT, new Vector3(x * .43, p.id === 'tulip' ? .95 : .62, z * .43 + (p.id === 'tulip' ? .28 : .55)).normalize()).multiply(new Quaternion().setFromAxisAngle(FRONT, p.turn * .2))
      : new Quaternion().setFromEuler(new Euler(0, p.turn, -x * .18));
    const matrix = new Matrix4().compose(new Vector3(...p.position), rotation, unitScale.clone().multiplyScalar(p.scale));
    result.push(localBounds(`${category}:${p.id}`).applyMatrix4(matrix).expandByScalar(.35));
    // Conservative stems/leaves proxy includes the individual size and contact displacement.
    const reach = category === 'flowers' ? .7 * p.scale + .2 : .1;
    result.push(new Box3(new Vector3(Math.min(0, x) - reach, stemBase(config) - .03, Math.min(0, z) - reach), new Vector3(Math.max(0, x) + reach, p.position[1] + .2, Math.max(0, z) + reach)));
  }
  return result;
}

export function surpriseObjectBounds(object: GiftObject, config: BouquetConfigV1) {
  const box = localBounds(`objects:${object.id}:${isFrame(object.id) ? frameOrientation(object.id, object.frameOrientation) : ''}`);
  const position = new Vector3(...object.position); position.y += objectGroundOffset(bouquetGround(config));
  return box.applyMatrix4(new Matrix4().compose(position, new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), object.rotation), unitScale.clone().multiplyScalar(object.scale)));
}
export const isPersonalObject = (object: GiftObject) => isFrame(object.id) && !!object.photo || object.id === 'sealed-envelope' && !!noteText(object.note).trim();

/** Bounded, seeded search. Saved heights keep their original floor-relative convention. */
export function arrangeSurpriseObjects(config: BouquetConfigV1, nextSeed: number): GiftObject[] {
  const rng = random(nextSeed ^ 0x57a91d), obstacles = surpriseBouquetBounds(config);
  const personal = config.objects.filter(isPersonalObject);
  const target = Math.max(personal.length, 1 + Math.floor(rng() * 3));
  const candidates: [number, number, number][] = [];
  for (let i = 0; i < 96; i++) {
    const side = rng() < .5 ? -1 : 1;
    candidates.push([side * (1.15 + rng() * 1.35), -.22 + rng() * 2.72, (rng() - .5) * .44]);
  }
  // Grid positions make tight layouts reliable without unbounded random retries.
  for (const z of [2.5, 2, 1.5, 1, .5, 0]) for (const x of [-2.5, 2.5, -2, 2, -1.5, 1.5, -1, 1, -.5, .5, 0]) candidates.push([x, z, 0]);
  const placed: GiftObject[] = [], occupied: Box3[] = [];
  const safe = (box: Box3) => [...obstacles, ...occupied].every(other => !box.clone().expandByScalar(SURPRISE_CLEARANCE).intersectsBox(other));
  const at = (object: GiftObject, candidate: [number, number, number]): GiftObject => ({ ...object, position: [candidate[0], OBJECT_FLOOR, candidate[1]], rotation: candidate[2] });
  let attempts = 0;
  const preserved = [...personal].sort((a, b) => surpriseObjectBounds(b, config).getSize(new Vector3()).lengthSq() - surpriseObjectBounds(a, config).getSize(new Vector3()).lengthSq());
  const placePersonal = (index: number): boolean => {
    if (index === preserved.length) return true;
    for (const candidate of candidates) {
      if (++attempts > 4000) return false;
      const object = at(preserved[index], candidate), box = surpriseObjectBounds(object, config);
      if (!safe(box)) continue;
      placed.push(object); occupied.push(box);
      if (placePersonal(index + 1)) return true;
      placed.pop(); occupied.pop();
    }
    return false;
  };
  if (!placePersonal(0)) throw new Error('Your personal items need more room. Your current bouquet is unchanged.');
  // Return preserved items in their original order, while retaining search placements.
  placed.sort((a, b) => personal.findIndex(o => o.uid === a.uid) - personal.findIndex(o => o.uid === b.uid));
  const pool = [...giftAssets];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  for (let i = 0; placed.length < Math.min(target, OBJECT_LIMIT) && i < pool.length; i++) {
    const asset = pool[i]; let uid = `surprise-${nextSeed.toString(36)}-${i}`;
    while (placed.some(o => o.uid === uid)) uid += '-n';
    const base: GiftObject = { uid, id: asset.id, position: [0, OBJECT_FLOOR, 0], rotation: 0, scale: .55 + rng() * .22, ...(asset.id === 'sealed-envelope' ? { note: emptyNote() } : {}) };
    let found = false;
    for (const scale of [base.scale, .45, OBJECT_BOUNDS.scale[0]]) {
      for (const candidate of candidates) {
        const object = at({ ...base, scale }, candidate), box = surpriseObjectBounds(object, config);
        if (!safe(box)) continue;
        placed.push(object); occupied.push(box); found = true; break;
      }
      if (found) break;
    }
  }
  if (!placed.length) throw new Error('There is no safe space for companions. Your current bouquet is unchanged.');
  return placed;
}
