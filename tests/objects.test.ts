import { describe, expect, it } from 'vitest';
import LZString from 'lz-string';
import { clone, decode, encode, loadDraft, saveDraft, starter, validate, applyPalette, surprise } from '../src/config';
import { clampPosition, createGiftObject, giftAssets, isFrame, frameOrientation, OBJECT_FLOOR, OBJECT_LIMIT, PHOTO_LIMIT, validateGiftObjects } from '../src/giftCatalog';

describe('movable gift objects', () => {
  it('preserves identities, transforms and embedded pictures through drafts and links', () => {
    const config = clone(starter);
    config.objects = giftAssets.slice(0, OBJECT_LIMIT).map(a => createGiftObject(a.id, []));
    config.objects[0].position = [-2.1, -.75, 1.1]; config.objects[0].rotation = Math.PI / 3; config.objects[0].scale = .94;
    config.objects[4].photo = 'data:image/jpeg;base64,/9j/AAAA';
    expect(decode(encode(config))).toEqual(config);
    let saved = ''; expect(saveDraft(config, { setItem: (_key, value) => { saved = value; } })).toBe(true);
    expect(loadDraft({ getItem: () => saved })).toEqual(config);
    expect(applyPalette(config, 'mint').objects).toEqual(config.objects); expect(surprise(config, 77).objects).toEqual(config.objects);
  });
  it('preserves every frame design, orientation, original picture and crop in portable links and drafts', () => {
    for (const asset of giftAssets.filter(a => isFrame(a.id))) for (const orientation of ['portrait', 'landscape'] as const) {
      const config = clone(starter);
      config.objects = [{ ...createGiftObject(asset.id, []), frameOrientation: orientation, photo: 'data:image/jpeg;base64,/9j/AAAA', crop: { mode: 'fill', zoom: 1.5, x: -.4, y: .2 } }];
      expect(decode(encode(config))).toEqual(config);
      expect(loadDraft({ getItem: () => JSON.stringify(config) })).toEqual(config);
      expect(decode(LZString.compressToEncodedURIComponent(JSON.stringify(config)))).toEqual(config);
    }
    expect(frameOrientation('standing-frame')).toBe('portrait'); expect(frameOrientation('landscape-frame')).toBe('landscape');
    expect(decode(encode({ ...clone(starter), objects: [createGiftObject('standing-frame', [])] })).objects[0].frameOrientation).toBeUndefined();
  });
  it('rejects invalid orientations and orientation fields on non-frame objects', () => {
    const object = createGiftObject('golden-frame', []);
    for (const frameOrientation of [null, 'sideways', '', true, 1, {}]) expect(() => validateGiftObjects([{ ...object, frameOrientation }])).toThrow('orientation');
    expect(() => validateGiftObjects([{ ...createGiftObject('cute-puppy', []), frameOrientation: 'landscape' }])).toThrow('orientation');
  });
  it('migrates original version-one links/drafts without objects while keeping bouquet geometry state', () => {
    const legacy: Record<string, unknown> = { ...clone(starter) }; delete legacy.objects;
    expect(decode(LZString.compressToEncodedURIComponent(JSON.stringify(legacy)))).toEqual(starter);
    expect(loadDraft({ getItem: () => JSON.stringify(legacy) })).toEqual(starter);
  });
  it('supports multiple instances of one model, with bounded ground placements', () => {
    const first = createGiftObject('teddy-bear', []), next = createGiftObject('teddy-bear', [first]);
    expect(first.uid).not.toBe(next.uid); expect(first.position).not.toEqual(next.position);
    expect(first.position[1]).toBe(OBJECT_FLOOR); expect(validateGiftObjects([first, next])).toEqual([first, next]);
    expect(clampPosition([100, -100, 100])).toEqual([2.5, OBJECT_FLOOR, 2.5]);
  });
  it('rejects malformed or excessive objects, transforms, duplicate identities and active image URLs', () => {
    const object = createGiftObject('standing-frame', []);
    for (const patch of [{ uid: '<script>' }, { id: 'missing' }, { position: [NaN, 0, 0] }, { position: [0, 0] }, { position: [9, 0, 0] }, { scale: 100 }, { rotation: Infinity }, { rotation: 4 }, { photo: 'https://example.com/photo.jpg' }, { photo: 'data:image/svg+xml,<svg></svg>' }, { photo: `data:image/jpeg;base64,/9j/${'A'.repeat(PHOTO_LIMIT)}` }]) expect(() => validate({ ...clone(starter), objects: [{ ...object, ...patch }] })).toThrow();
    expect(() => validateGiftObjects([object, object])).toThrow();
    expect(() => validateGiftObjects(Array.from({ length: OBJECT_LIMIT + 1 }, () => createGiftObject('cute-puppy', [])))).toThrow();
    expect(() => validateGiftObjects([{ ...object, id: 'cute-kitten', photo: 'data:image/jpeg;base64,/9j/AAAA' }])).toThrow();
    const pictures = Array.from({ length: 3 }, () => ({ ...createGiftObject('standing-frame', []), photo: 'data:image/jpeg;base64,/9j/' + 'A'.repeat(23000) }));
    expect(() => validateGiftObjects(pictures)).toThrow('too large');
  });
});
