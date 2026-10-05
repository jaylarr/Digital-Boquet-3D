import { describe, expect, it } from 'vitest';
import { Box3, Texture, Vector3 } from 'three';
import { clone, decode, encode, starter, surprise, validate } from '../src/config';
import { arrangeSurpriseObjects, isPersonalObject, surpriseBouquetBounds, surpriseObjectBounds, SURPRISE_CLEARANCE } from '../src/surprisePlacement';
import { createGiftObject, giftAssets, isFrame, OBJECT_FLOOR, type GiftObject } from '../src/giftCatalog';
import { bouquetGround } from '../src/sceneGround';
import { buildBouquet, disposeModel } from '../src/models';
import { createGiftModel, disposeGiftModel } from '../src/giftModels';
import { catalog } from '../src/catalog';
import { collisionLayout } from '../src/animation';
import { DEFAULT_ARRANGEMENT } from '../src/flowerArrangement';

function assertSafe(config: typeof starter) {
  const obstacles = surpriseBouquetBounds(config), boxes: Box3[] = [];
  for (const object of config.objects) {
    const box = surpriseObjectBounds(object, config);
    expect(object.position[1]).toBe(OBJECT_FLOOR);
    expect(box.min.y).toBeCloseTo(bouquetGround(config), 5);
    for (const other of [...obstacles, ...boxes]) expect(box.clone().expandByScalar(SURPRISE_CLEARANCE).intersectsBox(other)).toBe(false);
    boxes.push(box);
  }
}
const personal = (id: GiftObject['id'], uid: string): GiftObject => ({ ...createGiftObject(id, []), uid, ...(isFrame(id) ? { photo: 'data:image/jpeg;base64,/9j/AAAA', crop: { mode: 'fill' as const, zoom: 1.4, x: .2, y: -.3 }, frameOrientation: 'landscape' as const } : { note: { align: 'center' as const, runs: [{ text: 'For you 🌷', bold: true, color: '#aabbcc' }] } }) });

describe('safe surprise companions', () => {
  it('generates deterministic, grounded, spaced scenes with every current object type', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 180; seed++) {
      const result = surprise(starter, seed);
      expect(result).toEqual(surprise(starter, seed)); expect(validate(result)).toEqual(result);
      expect(result.objects.length).toBeGreaterThanOrEqual(1); expect(result.objects.length).toBeLessThanOrEqual(3);
      assertSafe(result); result.objects.forEach(o => seen.add(o.id));
    }
    expect([...seen].sort()).toEqual(giftAssets.map(o => o.id).sort());
  });
  it('preserves personal content, orientations, identities and scales while replacing other objects', () => {
    const input = clone(starter); input.objects = [personal('golden-frame', 'photo'), personal('sealed-envelope', 'letter'), createGiftObject('teddy-bear', [])];
    const before = clone(input), result = surprise(input, 100);
    for (const original of input.objects.filter(isPersonalObject)) {
      const current = result.objects.find(o => o.uid === original.uid)!;
      expect({ ...current, position: original.position, rotation: original.rotation }).toEqual(original);
    }
    expect(result.objects.some(o => o.uid === input.objects[2].uid)).toBe(false);
    expect(input).toEqual(before); expect(decode(encode(result))).toEqual(result); assertSafe(result);
  });
  it('retains more than three personal items and respects the six-object limit', () => {
    const input = clone(starter); input.objects = Array.from({ length: 6 }, (_, i) => ({ ...personal('sealed-envelope', `note-${i}`), scale: .35 }));
    const result = surprise(input, 22); expect(result.objects.map(o => o.uid)).toEqual(input.objects.map(o => o.uid)); assertSafe(result);
  });
  it('places around large bouquets, wraps and exposed-stem ground levels', () => {
    for (const wrap of catalog.wrappers) for (const showStems of [false, true]) {
      const input = { ...clone(starter), size: 1.2, spread: 1.2, flowers: [{ id: 'sunflower', color: '#ffffff', count: 24 }], fillers: [{ id: 'fern', color: '#ffffff', count: 12 }], wrapper: { id: wrap.id, color: wrap.color }, arrangement: { ...DEFAULT_ARRANGEMENT, showStems } };
      const result = { ...input, objects: arrangeSurpriseObjects(input, 42) }; assertSafe(result);
    }
  });
  it('rejects an impossible preserved layout without mutating the source', () => {
    const input = clone(starter); input.arrangement = { ...DEFAULT_ARRANGEMENT, height: -.4, edits: [{ key: 'rose:0', x: 1, z: 1, height: -.5, size: 1.4 }] };
    input.objects = Array.from({ length: 6 }, (_, i) => ({ ...personal('landscape-frame', `large-${i}`), scale: 1.25 }));
    const before = clone(input);
    expect(() => arrangeSurpriseObjects(input, 7)).toThrow('current bouquet is unchanged'); expect(input).toEqual(before);
  });
  it('distinguishes blank samples from uploaded pictures and written notes', () => {
    expect(isPersonalObject(createGiftObject('standing-frame', []))).toBe(false);
    expect(isPersonalObject({ ...createGiftObject('sealed-envelope', []), note: { align: 'left', runs: [{ text: ' \n ' }] } })).toBe(false);
    expect(isPersonalObject(personal('sealed-envelope', 'written'))).toBe(true);
  });
  it('measured object bounds contain the actual geometry for every frame orientation', () => {
    for (const asset of giftAssets) for (const frameOrientation of isFrame(asset.id) ? ['portrait', 'landscape'] as const : [undefined]) {
      const object: GiftObject = { ...createGiftObject(asset.id, []), frameOrientation, rotation: .2 };
      const model = createGiftModel(asset.id, { frameOrientation, photo: new Texture() });
      model.position.set(...object.position); model.rotation.y = object.rotation; model.scale.setScalar(object.scale);
      const actual = new Box3().setFromObject(model);
      expect(surpriseObjectBounds(object, starter).expandByScalar(.00001).containsBox(actual)).toBe(true);
      disposeGiftModel(model);
    }
  });
  it.each(Array.from({ length: 15 }, (_, seed) => seed))('companions avoid independently rendered, contact-adjusted bouquet bounds for seed %i', seed => {
      const config = surprise(starter, seed);
      const model = buildBouquet(config, collisionLayout(config));
      const boxes: Box3[] = []; model.traverse(node => { if (node.type === 'Mesh') boxes.push(new Box3().setFromObject(node)); });
      for (const object of config.objects) for (const box of boxes) expect(surpriseObjectBounds(object, config).intersectsBox(box)).toBe(false);
      expect(new Box3().setFromObject(model).getSize(new Vector3()).length()).toBeGreaterThan(0); disposeModel(model);
  }, 15000);
});
