import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { createGiftModel, disposeGiftModel, giftAssets } from '../src/giftModels';
import { isFrame, frameShape, objectSize } from '../src/giftCatalog';

describe('gift object geometry', () => {
  for (const asset of giftAssets) it(`${asset.id} has finite geometry, a grounded origin and a bounded rendering cost`, () => {
    const model = createGiftModel(asset.id, { photo: new T.Texture() });
    try {
      const bounds = new T.Box3().setFromObject(model);
      expect(Math.abs(bounds.min.y)).toBeLessThan(.00001);
      expect(bounds.max.y).toBeGreaterThan(1); expect(bounds.max.y).toBeLessThan(3);
      let calls = 0, triangles = 0;
      model.traverse(obj => {
        if (!(obj instanceof T.Mesh)) return;
        calls++; const p = obj.geometry.getAttribute('position');
        expect(p.array.every((value: number) => Number.isFinite(value))).toBe(true);
        triangles += (obj.geometry.index?.count ?? p.count) / 3;
      });
      expect(calls).toBeLessThan(20); expect(triangles).toBeLessThan(45000);
      if (isFrame(asset.id)) {
        expect(model.getObjectByName('photo-surface')).toBeDefined();
        const support = model.getObjectByName('easel-support')!;
        const supportBounds = new T.Box3().setFromObject(support);
        expect(supportBounds.min.z).toBeLessThan(-.6); expect(supportBounds.min.y).toBeLessThan(.06);
      }
    } finally { disposeGiftModel(model); }
  });
  for (const asset of giftAssets.filter(a => isFrame(a.id))) it(`${asset.id} changes aperture and silhouette with orientation while staying grounded`, () => {
    for (const frameOrientation of ['portrait', 'landscape'] as const) {
      const model = createGiftModel(asset.id, { photo: new T.Texture(), frameOrientation });
      try {
        const bounds = new T.Box3().setFromObject(model), actual = bounds.getSize(new T.Vector3());
        const shape = frameShape(asset.id, frameOrientation), estimate = objectSize({ id: asset.id, frameOrientation });
        expect(Math.abs(bounds.min.y)).toBeLessThan(.00001);
        expect(actual.x).toBeCloseTo(shape.width, 2); expect(actual.y).toBeLessThanOrEqual(estimate[1]);
        expect(model.userData.photoAspectRatio).toBeCloseTo(frameOrientation === 'landscape' ? 1.25 : .8);
        expect(model.userData.frameOrientation).toBe(frameOrientation);
        const picture = model.getObjectByName('photo-surface') as T.Mesh;
        const uv = picture.geometry.getAttribute('uv'); expect(uv.count).toBe(4);
        expect(new T.Box3().setFromObject(picture).getSize(new T.Vector3()).x).toBeCloseTo(shape.photoWidth);
        expect(model.getObjectByName('easel-support')).toBeDefined();
      } finally { disposeGiftModel(model); }
    }
  });
});
