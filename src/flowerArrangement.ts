import { catalog } from './catalog.ts';
import type { BouquetConfigV1, Selection } from './config.ts';

export interface FlowerEdit { key: string; height: number; size: number; x: number; z: number; }
export type HeightProfile = 'natural' | 'stepped';
export interface FlowerArrangement { profile: HeightProfile; edits: FlowerEdit[]; showStems: boolean; fillerProfile?: HeightProfile; height?: number; fillerHeight?: number; fillerSize?: number; fillerSpread?: number; fillerEdits?: FlowerEdit[]; }
export const DEFAULT_ARRANGEMENT: FlowerArrangement = { profile: 'stepped', fillerProfile: 'stepped', edits: [], showStems: false };
export const FLOWER_EDIT_BOUNDS = { height: [-.4, .7], size: [.6, 1.45], x: [-.45, .45], z: [-.45, .45] } as const;
export function flowerInstances(flowers: Selection[]) {
  return flowers.flatMap(f => Array.from({ length: f.count }, (_, ordinal) => ({ id: f.id, color: f.color, key: `${f.id}:${ordinal}`, ordinal })));
}
export const fillerInstances = flowerInstances;
export const defaultFlowerEdit = (key: string): FlowerEdit => ({ key, height: 0, size: 1, x: 0, z: 0 });
export const steppedHeight = (profile: HeightProfile | undefined, z: number, radius: number) => profile === 'stepped' ? -.48 * Math.max(-1, Math.min(1, z / radius)) : 0;
export const stemBase = (config: BouquetConfigV1) => config.wrapper.id !== 'gift-bag' && config.arrangement?.showStems ? -1.82 : -1.36;
export function validateArrangement(value: unknown, flowers: Selection[], fillers: Selection[] = []): FlowerArrangement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('This bouquet has an invalid flower arrangement.');
  const v = value as Record<string, unknown>;
  if (!['natural', 'stepped'].includes(v.profile as string) || typeof v.showStems !== 'boolean' || !Array.isArray(v.edits) || v.edits.length > 24) throw new Error('This bouquet has an invalid flower arrangement.');
  if (v.fillerProfile !== undefined && !['natural', 'stepped'].includes(v.fillerProfile as string)) throw new Error('This bouquet has an invalid filler arrangement.');
  if (v.height !== undefined && (typeof v.height !== 'number' || !Number.isFinite(v.height) || v.height < FLOWER_EDIT_BOUNDS.height[0] || v.height > FLOWER_EDIT_BOUNDS.height[1])) throw new Error('This bouquet has an invalid overall flower height.');
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
  const fillerSettings: Partial<FlowerArrangement> = {};
  for (const [field, bounds] of [['fillerHeight', FLOWER_EDIT_BOUNDS.height], ['fillerSize', [.8, 1.2]], ['fillerSpread', [.8, 1.2]]] as const) {
    const number = v[field];
    if (number === undefined) continue;
    if (typeof number !== 'number' || !Number.isFinite(number) || number < bounds[0] || number > bounds[1]) throw new Error('This bouquet has invalid overall filler settings.');
    fillerSettings[field] = number;
  }
  if (v.fillerEdits !== undefined) {
    if (!Array.isArray(v.fillerEdits) || v.fillerEdits.length > 12) throw new Error('This bouquet has an invalid filler arrangement.');
    const liveFillers = new Set(fillerInstances(fillers).map(f => f.key)), seenFillers = new Set<string>();
    fillerSettings.fillerEdits = [];
    for (const entry of v.fillerEdits) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('This bouquet has an invalid filler adjustment.');
      const e = entry as Record<string, unknown>;
      if (typeof e.key !== 'string' || !catalog.fillers.some(f => new RegExp(`^${f.id}:([0-9]|1[01])$`).test(e.key as string)) || seenFillers.has(e.key)) throw new Error('This bouquet has an invalid filler adjustment.');
      seenFillers.add(e.key);
      for (const [key, [min, max]] of Object.entries(FLOWER_EDIT_BOUNDS)) if (typeof e[key] !== 'number' || !Number.isFinite(e[key]) || (e[key] as number) < min || (e[key] as number) > max) throw new Error('This bouquet has invalid filler settings.');
      if (liveFillers.has(e.key)) fillerSettings.fillerEdits.push({ key: e.key, height: e.height as number, size: e.size as number, x: e.x as number, z: e.z as number });
    }
  }
  return { profile: v.profile as HeightProfile, edits, showStems: v.showStems, ...(v.fillerProfile !== undefined ? { fillerProfile: v.fillerProfile as HeightProfile } : {}), ...(v.height !== undefined ? { height: v.height as number } : {}), ...fillerSettings };
}
export function pruneArrangement(config: BouquetConfigV1): BouquetConfigV1 {
  if (!config.arrangement) return config;
  const live = new Set(flowerInstances(config.flowers).map(f => f.key));
  const edits = config.arrangement.edits.filter(e => live.has(e.key));
  const liveFillers = new Set(fillerInstances(config.fillers).map(f => f.key));
  const fillerEdits = config.arrangement.fillerEdits?.filter(e => liveFillers.has(e.key));
  return edits.length === config.arrangement.edits.length && fillerEdits?.length === config.arrangement.fillerEdits?.length ? config : { ...config, arrangement: { ...config.arrangement, edits, ...(fillerEdits !== undefined ? { fillerEdits } : {}) } };
}
