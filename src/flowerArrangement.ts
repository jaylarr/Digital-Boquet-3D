import { catalog } from './catalog.ts';
import type { BouquetConfigV1, Selection } from './config.ts';

export interface FlowerEdit { key: string; height: number; size: number; x: number; z: number; }
export type HeightProfile = 'natural' | 'stepped';
export interface FlowerArrangement { profile: HeightProfile; edits: FlowerEdit[]; showStems: boolean; fillerProfile?: HeightProfile; }
export const DEFAULT_ARRANGEMENT: FlowerArrangement = { profile: 'natural', edits: [], showStems: false };
export const FLOWER_EDIT_BOUNDS = { height: [-.4, .7], size: [.6, 1.45], x: [-.45, .45], z: [-.45, .45] } as const;
export function flowerInstances(flowers: Selection[]) {
  return flowers.flatMap(f => Array.from({ length: f.count }, (_, ordinal) => ({ id: f.id, color: f.color, key: `${f.id}:${ordinal}`, ordinal })));
}
export const defaultFlowerEdit = (key: string): FlowerEdit => ({ key, height: 0, size: 1, x: 0, z: 0 });
export const steppedHeight = (profile: HeightProfile | undefined, z: number, radius: number) => profile === 'stepped' ? -.48 * Math.max(-1, Math.min(1, z / radius)) : 0;
export const stemBase = (config: BouquetConfigV1) => config.wrapper.id !== 'gift-bag' && config.arrangement?.showStems ? -1.82 : -1.36;
export function validateArrangement(value: unknown, flowers: Selection[]): FlowerArrangement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('This bouquet has an invalid flower arrangement.');
  const v = value as Record<string, unknown>;
  if (!['natural', 'stepped'].includes(v.profile as string) || typeof v.showStems !== 'boolean' || !Array.isArray(v.edits) || v.edits.length > 24) throw new Error('This bouquet has an invalid flower arrangement.');
  if (v.fillerProfile !== undefined && !['natural', 'stepped'].includes(v.fillerProfile as string)) throw new Error('This bouquet has an invalid filler arrangement.');
  const seen = new Set<string>(), live = new Set(flowerInstances(flowers).map(f => f.key));
  const edits: FlowerEdit[] = [];
  for (const entry of v.edits) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('This bouquet has an invalid flower adjustment.');
    const e = entry as Record<string, unknown>;
    if (typeof e.key !== 'string' || !catalog.flowers.some(f => new RegExp(`^${f.id}:([0-9]|1[0-9]|2[0-3])$`).test(e.key as string)) || seen.has(e.key)) throw new Error('This bouquet has an invalid flower adjustment.');
    seen.add(e.key);
    for (const [key, [min, max]] of Object.entries(FLOWER_EDIT_BOUNDS)) if (typeof e[key] !== 'number' || !Number.isFinite(e[key]) || (e[key] as number) < min || (e[key] as number) > max) throw new Error('This bouquet has invalid flower settings.');
    // Removed blooms do not pass their old settings to newly added flowers.
    if (live.has(e.key)) edits.push({ key: e.key, height: e.height as number, size: e.size as number, x: e.x as number, z: e.z as number });
  }
  return { profile: v.profile as HeightProfile, edits, showStems: v.showStems, ...(v.fillerProfile !== undefined ? { fillerProfile: v.fillerProfile as HeightProfile } : {}) };
}
export function pruneArrangement(config: BouquetConfigV1): BouquetConfigV1 {
  if (!config.arrangement) return config;
  const live = new Set(flowerInstances(config.flowers).map(f => f.key));
  const edits = config.arrangement.edits.filter(e => live.has(e.key));
  return edits.length === config.arrangement.edits.length ? config : { ...config, arrangement: { ...config.arrangement, edits } };
}
