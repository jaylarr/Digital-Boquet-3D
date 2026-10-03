import LZString from 'lz-string';
import { catalog, palettes } from './catalog';
export interface Selection { id: string; count: number; color: string; }
export interface BouquetConfigV1 {
  version: 1; seed: number; flowers: Selection[]; fillers: Selection[];
  wrapper: { id: string; color: string }; ribbon: { id: string; color: string };
  effects: string[]; palette: string; size: number; spread: number;
  gift: { to: string; from: string; message: string };
}
export const DRAFT_KEY = 'petalpop.draft.v1';
export const starter: BouquetConfigV1 = {
  version: 1, seed: 72631,
  flowers: [{ id: 'rose', count: 3, color: '#e886a3' }, { id: 'tulip', count: 3, color: '#dfa4d8' }, { id: 'daisy', count: 3, color: '#fff1dc' }],
  fillers: [{ id: 'eucalyptus', count: 3, color: '#89aaa0' }],
  wrapper: { id: 'classic-cone', color: '#e1bd94' }, ribbon: { id: 'classic-bow', color: '#b77ca8' },
  effects: [], palette: 'sugar', size: 1, spread: 1, gift: { to: '', from: '', message: '' },
};
export const total = (selection: Selection[]) => selection.reduce((n, item) => n + item.count, 0);
export const clone = (config: BouquetConfigV1): BouquetConfigV1 => structuredClone(config);
export function seed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
export function random(seedValue: number) {
  let n = seedValue >>> 0;
  return () => { n += 0x6D2B79F5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const color = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function selection(value: unknown, category: 'flowers' | 'fillers', typeLimit: number, countLimit: number): Selection[] {
  if (!Array.isArray(value) || value.length > typeLimit) throw new Error('This bouquet has too many varieties.');
  const ids = new Set<string>();
  const result = value.map(entry => {
    if (!record(entry) || typeof entry.id !== 'string' || !catalog[category].some(i => i.id === entry.id) || ids.has(entry.id) || !Number.isInteger(entry.count) || (entry.count as number) < 1 || (entry.count as number) > countLimit || !color(entry.color)) throw new Error('This bouquet contains an invalid item.');
    ids.add(entry.id); return { id: entry.id, count: entry.count as number, color: entry.color };
  });
  if (total(result) > countLimit) throw new Error('This bouquet exceeds the stem limit.');
  return result;
}
export function validate(value: unknown): BouquetConfigV1 {
  if (!record(value)) throw new Error('This bouquet link seems broken.');
  if (value.version !== 1) throw new Error('This bouquet uses an unsupported version.');
  if (!Number.isInteger(value.seed) || (value.seed as number) < 0 || (value.seed as number) > 0xffffffff) throw new Error('This bouquet has an invalid arrangement.');
  const flowers = selection(value.flowers, 'flowers', 5, 24), fillers = selection(value.fillers, 'fillers', 3, 12);
  const decor = (entry: unknown, category: 'wrappers' | 'ribbons') => {
    if (!record(entry) || !catalog[category].some(i => i.id === entry.id) || !color(entry.color)) throw new Error('This bouquet contains an invalid decoration.');
    return { id: entry.id as string, color: entry.color };
  };
  if (!Array.isArray(value.effects) || value.effects.length > 2 || new Set(value.effects).size !== value.effects.length || value.effects.some(id => typeof id !== 'string' || !catalog.effects.some(i => i.id === id))) throw new Error('This bouquet has invalid effects.');
  if (!palettes.some(p => p.id === value.palette) || typeof value.size !== 'number' || !Number.isFinite(value.size) || value.size < .8 || value.size > 1.2 || typeof value.spread !== 'number' || !Number.isFinite(value.spread) || value.spread < .8 || value.spread > 1.2) throw new Error('This bouquet has invalid settings.');
  if (!record(value.gift)) throw new Error('This bouquet has an invalid message.');
  const text = (entry: unknown, max: number) => { if (typeof entry !== 'string' || Array.from(entry).length > max) throw new Error('This bouquet’s message is too long.'); return entry; };
  return { version: 1, seed: value.seed as number, flowers, fillers, wrapper: decor(value.wrapper, 'wrappers'), ribbon: decor(value.ribbon, 'ribbons'), effects: value.effects as string[], palette: value.palette as string, size: value.size, spread: value.spread, gift: { to: text(value.gift.to, 50), from: text(value.gift.from, 50), message: text(value.gift.message, 500) } };
}
export function encode(config: BouquetConfigV1) { return LZString.compressToEncodedURIComponent(JSON.stringify(validate(config))); }
export function decode(payload: string) {
  if (!payload || payload.length > 6000 || !/^[A-Za-z0-9+\-$]+$/.test(payload)) throw new Error('This bouquet link seems broken.');
  const text = LZString.decompressFromEncodedURIComponent(payload);
  if (!text || text.length > 12000) throw new Error('This bouquet link seems broken.');
  try { return validate(JSON.parse(text)); } catch (error) { if (error instanceof SyntaxError) throw new Error('This bouquet link seems broken.'); throw error; }
}
export function shareUrl(config: BouquetConfigV1, address = window.location.href) { const url = new URL(address); url.hash = `b=${encode(config)}`; url.search = ''; return url.href; }
export function loadDraft(storage?: Pick<Storage, 'getItem'>) { try { const text = (storage ?? window.localStorage).getItem(DRAFT_KEY); return text ? validate(JSON.parse(text)) : clone(starter); } catch { return clone(starter); } }
export function saveDraft(config: BouquetConfigV1, storage?: Pick<Storage, 'setItem'>) { try { (storage ?? window.localStorage).setItem(DRAFT_KEY, JSON.stringify(config)); return true; } catch { return false; } }
export function applyPalette(config: BouquetConfigV1, id: string): BouquetConfigV1 {
  const p = palettes.find(p => p.id === id)!;
  return { ...config, palette: id, flowers: config.flowers.map((f, i) => ({ ...f, color: p.colors[i % 3] })), fillers: config.fillers.map(f => ({ ...f, color: p.colors[3] })), wrapper: { ...config.wrapper, color: p.colors[4] }, ribbon: { ...config.ribbon, color: p.colors[5] } };
}
const presetData = [
  { name: 'Sweetheart', note: 'A little love letter', palette: 'sugar', flowers: [['rose', 4], ['heart-bloom', 3], ['peony', 3]], fillers: [['babys-breath', 3]], wrapper: 'heart-collar', ribbon: 'heart-knot', effects: ['hearts'] },
  { name: 'Sunny side', note: 'Instant good mood', palette: 'sunshine', flowers: [['sunflower', 4], ['daisy', 5]], fillers: [['wheat', 3], ['bunny-tails', 2]], wrapper: 'classic-cone', ribbon: 'long-tail', effects: ['sparkles'] },
  { name: 'Pastel cloud', note: 'Soft as a daydream', palette: 'lilac', flowers: [['tulip', 4], ['peony', 3], ['hydrangea', 3]], fillers: [['eucalyptus', 3]], wrapper: 'double-cone', ribbon: 'butterfly-bow', effects: ['bubbles'] },
  { name: 'Wildflower wink', note: 'A little beautifully wild', palette: 'mint', flowers: [['daisy', 4], ['lavender', 3], ['smiley-bloom', 2]], fillers: [['fern', 3], ['curly-grass', 2]], wrapper: 'pleated', ribbon: 'twine', effects: ['fireflies'] },
  { name: 'Cosmic crush', note: 'Out of this world', palette: 'sky', flowers: [['heart-bloom', 4], ['lily', 4]], fillers: [['star-picks', 3]], wrapper: 'origami', ribbon: 'star-knot', effects: ['rainbow', 'starburst'] },
  { name: 'Tiny thanks', note: 'Big appreciation', palette: 'berry', flowers: [['rose', 3], ['tulip', 3], ['daisy', 2]], fillers: [['berries', 2], ['ivy', 2]], wrapper: 'gift-bag', ribbon: 'double-bow', effects: ['confetti'] },
];
export const presets = presetData.map((p, index) => ({ name: p.name, note: p.note, config: applyPalette({ ...clone(starter), seed: 4000 + index * 93, flowers: p.flowers.map(([id, count]) => ({ id: id as string, count: count as number, color: '#ffffff' })), fillers: p.fillers.map(([id, count]) => ({ id: id as string, count: count as number, color: '#ffffff' })), wrapper: { id: p.wrapper, color: '#ffffff' }, ribbon: { id: p.ribbon, color: '#ffffff' }, effects: p.effects }, p.palette) }));
export function surprise(config: BouquetConfigV1, nextSeed = seed()) {
  const rng = random(nextSeed), pick = <T,>(array: T[]) => array[Math.floor(rng() * array.length)];
  const flowers = [...catalog.flowers];
  for (let i = flowers.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [flowers[i], flowers[j]] = [flowers[j], flowers[i]]; }
  const result = { ...config, seed: nextSeed, flowers: flowers.slice(0, 2 + Math.floor(rng() * 3)).map(f => ({ id: f.id, count: 2 + Math.floor(rng() * 3), color: f.color })), fillers: [{ id: pick(catalog.fillers).id, count: 2 + Math.floor(rng() * 4), color: '#89aaa0' }], wrapper: { id: pick(catalog.wrappers).id, color: '#ffffff' }, ribbon: { id: pick(catalog.ribbons).id, color: '#ffffff' }, effects: rng() > .5 ? [pick(catalog.effects).id] : [] };
  return applyPalette(result, pick(palettes).id);
}
