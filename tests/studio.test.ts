import { describe, expect, it } from 'vitest';
import LZString from 'lz-string';
import { DesignHistory } from '../src/designHistory';
import { photoPlacement } from '../src/objectPhotos';
import { clone, decode, encode, starter, validate } from '../src/config';
import { createGiftObject, DEFAULT_CROP } from '../src/giftCatalog';

describe('studio history', () => {
  it('groups a continuous drag and branches cleanly after undo', () => {
    const h = new DesignHistory(0); h.update(1); h.begin(); for (let i = 2; i <= 100; i++) h.update(i); h.end();
    expect(h.past).toEqual([0, 1]); h.undo(); expect(h.current).toBe(1); h.redo(); expect(h.current).toBe(100);
    h.undo(); h.update(7); expect(h.future).toEqual([]); h.undo(); expect(h.current).toBe(1); h.undo(); expect(h.current).toBe(0);
  });
  it('bounds memory, keeps photos by reference, skips no-ops and clears history on gift navigation', () => {
    const h = new DesignHistory(starter, 3), photo = 'data:image/jpeg;base64,/9j/AAAA';
    h.update(c => ({ ...c, objects: [{ ...createGiftObject('standing-frame', []), photo }] }));
    for (let n = 1; n <= 6; n++) h.update(c => ({ ...c, seed: n }));
    expect(h.past.length).toBe(3); expect(h.past.every(c => c.objects === h.current.objects)).toBe(true);
    h.update(c => c); expect(h.past.length).toBe(3); h.replace(starter); expect(h.past).toEqual([]); expect(h.future).toEqual([]);
  });
});
describe('photo framing and migration', () => {
  it('fits the whole picture and fills/pans to the edges without revealing empty gaps', () => {
    expect(photoPlacement(720, 360, 320, 400)).toMatchObject({ x: 0, y: 120, w: 320, h: 160, panX: 0, panY: 0 });
    const left = photoPlacement(720, 360, 320, 400, { mode: 'fill', zoom: 1, x: 1, y: 1 }); expect(left.x).toBe(0); expect(left.y).toBe(0);
    const right = photoPlacement(720, 360, 320, 400, { mode: 'fill', zoom: 1, x: -1, y: -1 }); expect(right.x + right.w).toBe(320); expect(right.y + right.h).toBe(400);
    const portrait = photoPlacement(400, 1200, 320, 400, { mode: 'fill', zoom: 2, x: -1, y: 1 }); expect(portrait.x + portrait.w).toBe(320); expect(portrait.y).toBe(0);
    const landscape = photoPlacement(400, 1200, 400, 320, { mode: 'fill', zoom: 1, x: 0, y: -1 }); expect(landscape.x).toBe(0); expect(landscape.y + landscape.h).toBe(320);
    expect(photoPlacement(1000, 800, 400, 320)).toMatchObject({ x: 0, y: 0, w: 400, h: 320 });
  });
  it('round-trips a recroppable source, object tint, Unicode text, and legacy links', () => {
    const c = clone(starter); c.gift.title = '小花 🌷'; c.objects = [{ ...createGiftObject('standing-frame', []), color: '#ECAACA', photo: 'data:image/jpeg;base64,/9j/AAAA', crop: { mode: 'fill', zoom: 2.31, x: -.6, y: .4 } }];
    expect(decode(encode(c))).toEqual(c);
    expect(decode(LZString.compressToEncodedURIComponent(JSON.stringify(c)))).toEqual(c);
    const legacy = LZString.compressToEncodedURIComponent(JSON.stringify(starter)); expect(encode(starter).length).toBeLessThan(legacy.length * .7);
  });
  it('rejects invalid crops and colors in both drafts and links', () => {
    const object = { ...createGiftObject('standing-frame', []), photo: 'data:image/jpeg;base64,/9j/AAAA' };
    for (const crop of [null, { ...DEFAULT_CROP, zoom: 0 }, { ...DEFAULT_CROP, mode: 'stretch' }, { ...DEFAULT_CROP, x: Infinity }, { ...DEFAULT_CROP, y: 1.1 }, { ...DEFAULT_CROP, zoom: 5 }]) expect(() => validate({ ...starter, objects: [{ ...object, crop }] })).toThrow();
    expect(() => validate({ ...starter, objects: [{ ...object, color: 'red' }] })).toThrow();
    expect(() => validate({ ...starter, objects: [{ ...object, photo: undefined, crop: DEFAULT_CROP }] })).toThrow();
    expect(() => decode('c.' + LZString.compressToEncodedURIComponent(JSON.stringify([2])))).toThrow();
  });
});
