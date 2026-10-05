import { random, type BouquetConfigV1 } from './config.ts';
import { DEFAULT_ARRANGEMENT, fillerInstances, flowerInstances, steppedHeight } from './flowerArrangement.ts';
export interface Placement { id: string; color: string; position: [number, number, number]; scale: number; turn: number; key?: string; }
export function layout(config: BouquetConfigV1): { flowers: Placement[]; fillers: Placement[] } {
  const rng = random(config.seed), entries = flowerInstances(config.flowers);
  for (let i = entries.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [entries[i], entries[j]] = [entries[j], entries[i]]; }
  const radius = (.59 + Math.sqrt(entries.length) * .11) * config.spread;
  const offset = rng() * Math.PI * 2;
  const flowers = entries.map((item, i): Placement => {
    const r = Math.sqrt((i + .3) / Math.max(entries.length, 1)), a = i * 2.399963229728653 + offset;
    const x = Math.cos(a) * r * radius, z = Math.sin(a) * r * radius;
    const edit = config.arrangement?.edits.find(e => e.key === item.key);
    const tier = steppedHeight(config.arrangement?.profile ?? DEFAULT_ARRANGEMENT.profile, z + (edit?.z ?? 0), radius);
    return { key: item.key, id: item.id, color: item.color, position: [x + (edit?.x ?? 0), 1.05 + .38 * Math.sqrt(1 - r * r) + rng() * .06 + tier + (config.arrangement?.height ?? 0) + (edit?.height ?? 0), z + (edit?.z ?? 0)], scale: (.87 + rng() * .13) * config.size * (edit?.size ?? 1), turn: rng() * Math.PI * 2 };
  });
  const fillerEntries = fillerInstances(config.fillers), fillerRadius = radius * (config.arrangement?.fillerSpread ?? 1);
  const fillers = fillerEntries.map((item, i): Placement => {
    const a = i * 2.399963229728653 + offset + .7, r = fillerRadius * (.8 + rng() * .16);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const edit = config.arrangement?.fillerEdits?.find(e => e.key === item.key);
    return { key: item.key, id: item.id, color: item.color, position: [x + (edit?.x ?? 0), 1.2 + rng() * .45 + steppedHeight(config.arrangement?.fillerProfile ?? DEFAULT_ARRANGEMENT.fillerProfile, z + (edit?.z ?? 0), fillerRadius) + (config.arrangement?.fillerHeight ?? 0) + (edit?.height ?? 0), z + (edit?.z ?? 0)], scale: (.85 + rng() * .2) * (config.arrangement?.fillerSize ?? 1) * (edit?.size ?? 1), turn: a };
  });
  return { flowers, fillers };
}
