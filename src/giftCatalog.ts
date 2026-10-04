import { emptyNote, validateNote, type NoteDocument } from './notes.ts';
export const giftAssets = [
  { id: 'teddy-bear', name: 'Cuddle Teddy', note: 'Cream plush, little bow & stitched paws', color: '#dcc6a4', size: [.9, 1.53, .8] },
  { id: 'heart-balloon', name: 'Heart Balloon', note: 'Rose foil, sealed edge & curling string', color: '#db7998', size: [.98, 2.34, .45] },
  { id: 'cute-puppy', name: 'Golden Puppy', note: 'Floppy ears & a very happy little face', color: '#dba769', size: [.9, 1.32, .76] },
  { id: 'cute-kitten', name: 'Ginger Kitten', note: 'Pink ears, tabby stripes & a curled tail', color: '#dca06b', size: [.81, 1.44, .68] },
  { id: 'standing-frame', name: 'Memory Frame', note: 'Oak, cream mat & a real rear easel', color: '#c69a6d', size: [1.14, 1.48, .71] },
  { id: 'sealed-envelope', name: 'Sealed Letter', note: 'A wax-sealed envelope with a personal note inside', color: '#ddb4bb', size: [1.58, 1.1, .22] },
  { id: 'landscape-frame', name: 'Landscape Frame', note: 'Wide oak frame for shared moments & scenery', color: '#aa7953', size: [1.49, 1.16, .71] },
  { id: 'golden-frame', name: 'Golden Frame', note: 'Polished gold, fine trim & decorative corners', color: '#d3ac62', size: [1.15, 1.5, .74] },
  { id: 'snapshot-frame', name: 'Snapshot Frame', note: 'A playful instant-photo border in soft ivory', color: '#f4e9d8', size: [.95, 1.28, .71] },
] as const;
export type GiftAssetId = typeof giftAssets[number]['id'];
export type FrameOrientation = 'portrait' | 'landscape';
export const isFrame = (id: string) => ['standing-frame', 'landscape-frame', 'golden-frame', 'snapshot-frame'].includes(id);
export function frameOrientation(id: string, orientation?: FrameOrientation): FrameOrientation { return orientation ?? (id === 'landscape-frame' ? 'landscape' : 'portrait'); }
/** Shared aperture proportions for the crop preview, live photo and exported picture. */
export function frameShape(id: string, orientation?: FrameOrientation) {
  const landscape = frameOrientation(id, orientation) === 'landscape';
  const photoWidth = landscape ? .890 : .712, photoHeight = landscape ? .712 : .890;
  const snapshot = id === 'snapshot-frame';
  const width = snapshot ? photoWidth + .22 : landscape ? 1.47 : 1.13;
  const height = snapshot ? photoHeight + .38 : landscape ? 1.13 : 1.47;
  return { width, height, photoWidth, photoHeight, photoY: snapshot ? .27 + photoHeight / 2 : height / 2, aspect: photoWidth / photoHeight };
}
export function objectSize(object: Pick<GiftObject, 'id' | 'frameOrientation'>): readonly number[] {
  if (!isFrame(object.id)) return giftAssets.find(a => a.id === object.id)!.size;
  const shape = frameShape(object.id, object.frameOrientation); return [shape.width + .02, shape.height + .03, .74];
}
export interface GiftObject {
  uid: string; id: GiftAssetId; position: [number, number, number]; rotation: number; scale: number;
  color?: string; photo?: string; crop?: PhotoCrop; note?: NoteDocument; frameOrientation?: FrameOrientation;
}
export interface PhotoCrop { mode: 'fit' | 'fill'; zoom: number; x: number; y: number; }
export const DEFAULT_CROP: PhotoCrop = { mode: 'fit', zoom: 1, x: 0, y: 0 };
export const OBJECT_LIMIT = 6, OBJECT_FLOOR = -1.5;
export const OBJECT_BOUNDS = { x: [-2.5, 2.5], y: [OBJECT_FLOOR, 1.5], z: [-1.5, 2.5], scale: [.35, 1.25] } as const;
export const PHOTO_LIMIT = 24000, PHOTO_TOTAL_LIMIT = 48000;
export function clampPosition(position: readonly number[]): GiftObject['position'] {
  return position.map((value, i) => {
    const [min, max] = [OBJECT_BOUNDS.x, OBJECT_BOUNDS.y, OBJECT_BOUNDS.z][i];
    return Math.round(Math.min(max, Math.max(min, value)) * 1000) / 1000;
  }) as GiftObject['position'];
}
export function createGiftObject(id: GiftAssetId, existing: GiftObject[]): GiftObject {
  const slots: GiftObject['position'][] = [[-1.15, OBJECT_FLOOR, .35], [1.15, OBJECT_FLOOR, .35], [-.65, OBJECT_FLOOR, 1.05], [.65, OBJECT_FLOOR, 1.05], [-1.45, OBJECT_FLOOR, -.65], [1.45, OBJECT_FLOOR, -.65]];
  const position = slots.find(slot => existing.every(o => Math.hypot(o.position[0] - slot[0], o.position[2] - slot[2]) > .3)) ?? slots[existing.length % slots.length];
  return { uid: crypto.randomUUID(), id, position: [...position], rotation: isFrame(id) ? -.12 : 0, scale: id === 'heart-balloon' ? .8 : .72, ...(id === 'sealed-envelope' ? { note: emptyNote() } : {}) };
}
export function validateGiftObjects(value: unknown): GiftObject[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > OBJECT_LIMIT) throw new Error('This bouquet has too many objects.');
  const ids = new Set<string>(); let photoTotal = 0;
  return value.map(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('This bouquet contains an invalid object.');
    const o = entry as Record<string, unknown>;
    if (typeof o.uid !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(o.uid) || ids.has(o.uid) || !giftAssets.some(a => a.id === o.id)) throw new Error('This bouquet contains an invalid object.');
    ids.add(o.uid);
    if (!Array.isArray(o.position) || o.position.length !== 3 || o.position.some((n, i) => { const [min, max] = [OBJECT_BOUNDS.x, OBJECT_BOUNDS.y, OBJECT_BOUNDS.z][i]; return typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max; })) throw new Error('This bouquet has an invalid object placement.');
    if (typeof o.rotation !== 'number' || !Number.isFinite(o.rotation) || Math.abs(o.rotation) > Math.PI || typeof o.scale !== 'number' || !Number.isFinite(o.scale) || o.scale < OBJECT_BOUNDS.scale[0] || o.scale > OBJECT_BOUNDS.scale[1]) throw new Error('This bouquet has invalid object settings.');
    if (o.color !== undefined && (typeof o.color !== 'string' || !/^#[a-f0-9]{6}$/i.test(o.color))) throw new Error('This object has an invalid color.');
    if (o.photo !== undefined) {
      if (!isFrame(o.id as string) || typeof o.photo !== 'string' || o.photo.length > PHOTO_LIMIT || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(o.photo)) throw new Error('This bouquet has an invalid frame picture.');
      photoTotal += o.photo.length; if (photoTotal > PHOTO_TOTAL_LIMIT) throw new Error('These pictures are too large to share together. Remove a picture first.');
    }
    let crop: PhotoCrop | undefined;
    if (o.crop !== undefined) {
      const c = o.crop as Record<string, unknown>;
      if (!c || typeof c !== 'object' || Array.isArray(c) || !o.photo || !['fit', 'fill'].includes(c.mode as string) || typeof c.zoom !== 'number' || !Number.isFinite(c.zoom) || c.zoom < 1 || c.zoom > 4 || [c.x, c.y].some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 1)) throw new Error('This frame has an invalid crop.');
      crop = { mode: c.mode as PhotoCrop['mode'], zoom: c.zoom, x: c.x as number, y: c.y as number };
    }
    if (o.note !== undefined && o.id !== 'sealed-envelope') throw new Error('Only an envelope can contain a note.');
    if (o.frameOrientation !== undefined && (!isFrame(o.id as string) || !['portrait', 'landscape'].includes(o.frameOrientation as string))) throw new Error('This frame has an invalid orientation.');
    return { uid: o.uid, id: o.id as GiftAssetId, position: [...o.position] as GiftObject['position'], rotation: o.rotation, scale: o.scale, ...(o.color !== undefined ? { color: o.color as string } : {}), ...(o.photo !== undefined ? { photo: o.photo as string } : {}), ...(crop ? { crop } : {}), ...(o.note !== undefined ? { note: validateNote(o.note) } : {}), ...(o.frameOrientation !== undefined ? { frameOrientation: o.frameOrientation as FrameOrientation } : {}) };
  });
}
