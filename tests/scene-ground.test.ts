import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { clone, starter, encode, decode } from '../src/config';
import { DEFAULT_ARRANGEMENT, stemBase } from '../src/flowerArrangement';
import { createGiftObject, OBJECT_FLOOR } from '../src/giftCatalog';
import { ObjectScene } from '../src/objectScene';
import { bouquetGround } from '../src/sceneGround';

describe('bouquet and object ground', () => {
  it('follows exposed stems and keeps a bag or an object-only scene on its original base', () => {
    const config = clone(starter);
    expect(bouquetGround(config)).toBe(OBJECT_FLOOR);
    config.arrangement = { ...DEFAULT_ARRANGEMENT, showStems: true };
    expect(bouquetGround(config)).toBeCloseTo(stemBase(config) - .02);
    config.wrapper.id = 'gift-bag'; expect(bouquetGround(config)).toBe(OBJECT_FLOOR);
    config.wrapper.id = starter.wrapper.id; config.flowers = []; config.fillers = [];
    expect(bouquetGround(config)).toBe(OBJECT_FLOOR);
  });
  it('moves object bases with the ground without rebuilding geometry or changing saved height offsets', () => {
    const config = clone(starter), object = createGiftObject('teddy-bear', []);
    config.objects = [object, { ...createGiftObject('cute-kitten', [object]), position: [1, OBJECT_FLOOR + .6, .5] }];
    const saved = structuredClone(config.objects), engine = new ObjectScene(() => {}, () => {}, new T.Texture());
    try {
      engine.sync(config.objects, bouquetGround(config));
      const model = engine.entries.get(object.uid)!.model;
      expect(new T.Box3().setFromObject(model).min.y).toBeCloseTo(OBJECT_FLOOR);
      config.arrangement = { ...DEFAULT_ARRANGEMENT, showStems: true };
      const ground = bouquetGround(config); engine.sync(config.objects, ground);
      expect(new T.Box3().setFromObject(model).min.y).toBeCloseTo(ground);
      expect(new T.Box3().setFromObject(engine.entries.get(config.objects[1].uid)!.model).min.y).toBeCloseTo(ground + .6);
      expect(engine.builds).toBe(2); expect(engine.entries.get(object.uid)!.model).toBe(model);
      expect(config.objects).toEqual(saved); expect(decode(encode(config)).objects).toEqual(saved);
      engine.sync(config.objects, OBJECT_FLOOR);
      expect(new T.Box3().setFromObject(model).min.y).toBeCloseTo(OBJECT_FLOOR);
    } finally { engine.dispose(); }
  });
});
