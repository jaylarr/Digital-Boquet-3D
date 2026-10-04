import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { clone, decode, encode, loadDraft, saveDraft, starter, validate } from '../src/config';
import { DEFAULT_ARRANGEMENT, defaultFlowerEdit, flowerInstances, pruneArrangement, stemBase } from '../src/flowerArrangement';
import { layout } from '../src/layout';
import { AnimatedBouquet } from '../src/animation';
import { buildBouquet, disposeModel } from '../src/models';

describe('individual flower arrangement', () => {
  it('moves all flower heights together in both profiles while preserving individual edits and fillers', () => {
    const config = clone(starter);
    for (const profile of ['natural', 'stepped'] as const) {
      config.arrangement = { ...DEFAULT_ARRANGEMENT, profile, edits: [{ ...defaultFlowerEdit('rose:1'), height: .2, x: .1, size: 1.2 }] };
      const original = layout(config);
      for (const height of [-.4, .35, .7]) {
        config.arrangement.height = height;
        const adjusted = layout(config);
        for (const [i, flower] of adjusted.flowers.entries()) {
          expect(flower.position[1] - original.flowers[i].position[1]).toBeCloseTo(height);
          expect({ ...flower, position: [flower.position[0], original.flowers[i].position[1], flower.position[2]] }).toEqual(original.flowers[i]);
        }
        expect(adjusted.fillers).toEqual(original.fillers);
        expect(config.arrangement.edits[0].height).toBe(.2);
      }
    }
    expect(layout({ ...clone(starter), arrangement: { ...DEFAULT_ARRANGEMENT, height: 0 } })).toEqual(layout(starter));
  });
  it('persists optional overall height in drafts and both encodings and rejects malformed values', () => {
    const config = clone(starter); config.arrangement = { ...DEFAULT_ARRANGEMENT, height: .36 };
    expect(decode(encode(config))).toEqual(config);
    let saved = ''; saveDraft(config, { setItem: (_key, value) => { saved = value; } }); expect(loadDraft({ getItem: () => saved })).toEqual(config);
    for (const height of [null, '.3', NaN, Infinity, -.41, .71, {}]) expect(() => validate({ ...config, arrangement: { ...config.arrangement, height } })).toThrow('overall flower height');
    const old = { ...clone(starter), arrangement: DEFAULT_ARRANGEMENT }; expect(decode(encode(old))).toEqual(old); expect(validate(old).arrangement).not.toHaveProperty('height');
  });
  it('updates every cached bloom and full-detail export when the overall height changes', () => {
    const config = clone(starter); config.fillers = []; config.flowers = [{ id: 'rose', count: 3, color: '#e886a3' }];
    const engine = new AnimatedBouquet(); engine.sync(config, false);
    const blooms = engine.stems.filter(s => s.category === 'flowers'), previous = blooms.map(s => s.target.y), builds = engine.stats.modelBuilds;
    const original = buildBouquet(config), before = new T.Box3().setFromObject(original); disposeModel(original);
    config.arrangement = { ...DEFAULT_ARRANGEMENT, height: .5 }; engine.sync(config, false);
    expect(engine.stats.modelBuilds).toBe(builds);
    blooms.forEach((bloom, i) => { expect(engine.stems).toContain(bloom); expect(bloom.target.y - previous[i]).toBeCloseTo(.5); });
    const exported = buildBouquet(config); expect(new T.Box3().setFromObject(exported).max.y - before.max.y).toBeCloseTo(.5);
    disposeModel(exported); engine.dispose();
  });
  it('preserves old layouts and stores all new settings through drafts and portable links', () => {
    expect(layout({ ...clone(starter), arrangement: DEFAULT_ARRANGEMENT })).toEqual(layout(starter));
    expect(decode(encode(starter))).toEqual(starter);
    const config = clone(starter); config.arrangement = { profile: 'stepped', showStems: true, edits: [{ key: 'rose:1', height: .4, size: 1.25, x: -.2, z: .3 }] };
    expect(decode(encode(config))).toEqual(config);
    let saved = ''; saveDraft(config, { setItem: (_key, v) => { saved = v; } }); expect(loadDraft({ getItem: () => saved })).toEqual(config);
  });
  it('lowers front flowers and elevates back flowers while preserving the center and arrangement seed', () => {
    const config = clone(starter); config.flowers = [{ id: 'rose', color: '#e886a3', count: 24 }];
    const before = layout(config).flowers; config.arrangement = { ...DEFAULT_ARRANGEMENT, profile: 'stepped' }; const after = layout(config).flowers;
    for (const [i, p] of after.entries()) {
      expect(p.key).toBe(before[i].key); expect(p.position[0]).toBe(before[i].position[0]); expect(p.position[2]).toBe(before[i].position[2]); expect(p.scale).toBe(before[i].scale);
      if (p.position[2] > .3) expect(p.position[1]).toBeLessThan(before[i].position[1]);
      if (p.position[2] < -.3) expect(p.position[1]).toBeGreaterThan(before[i].position[1]);
      if (Math.abs(p.position[2]) < .1) expect(Math.abs(p.position[1] - before[i].position[1])).toBeLessThan(.04);
    }
    const mean = (items: typeof after) => items.reduce((n, p) => n + p.position[1], 0) / items.length;
    expect(mean(after.filter(p => p.position[2] < -.3)) - mean(after.filter(p => p.position[2] > .3))).toBeGreaterThan(.4);
  });
  it('targets one stable flower identity, keeps settings through shuffle, and prunes removed flowers', () => {
    const config = clone(starter); config.arrangement = { ...DEFAULT_ARRANGEMENT, edits: [{ ...defaultFlowerEdit('rose:1'), height: .35, size: 1.4, x: .2, z: -.3 }] };
    for (const seed of [72631, 7, 12345]) {
      config.seed = seed; const baseline = layout({ ...config, arrangement: undefined }).flowers, actual = layout(config).flowers;
      for (const p of actual) { const old = baseline.find(f => f.key === p.key)!; if (p.key === 'rose:1') { expect(p.position[1] - old.position[1]).toBeCloseTo(.35); expect(p.scale / old.scale).toBeCloseTo(1.4); expect(p.position[0] - old.position[0]).toBeCloseTo(.2); expect(p.position[2] - old.position[2]).toBeCloseTo(-.3); } else expect(p).toEqual(old); }
    }
    config.flowers[0].count = 1; expect(pruneArrangement(config).arrangement!.edits).toEqual([]);
    expect(flowerInstances(config.flowers).every(f => f.key !== 'rose:1')).toBe(true);
  });
  it('updates instance transforms without rebuilding models and keeps identities through shuffling', () => {
    const engine = new AnimatedBouquet(), config = clone(starter); engine.sync(config, false); const builds = engine.stats.modelBuilds;
    const flower = engine.stems.find(s => s.key === 'flowers:rose:1')!;
    config.arrangement = { ...DEFAULT_ARRANGEMENT, edits: [{ ...defaultFlowerEdit('rose:1'), height: .5, size: 1.3 }] }; engine.sync(config, false);
    expect(engine.stems.find(s => s.key === 'flowers:rose:1')).toBe(flower); expect(engine.stats.modelBuilds).toBe(builds);
    const target = layout(config).flowers.find(f => f.key === 'rose:1')!; expect(flower.targetScale).toBe(target.scale);
    config.seed = 555; engine.sync(config, false); expect(engine.stems.find(s => s.key === 'flowers:rose:1')).toBe(flower); expect(engine.stats.modelBuilds).toBe(builds); engine.dispose();
  });
  it('shows the stem bundle below paper in live and export geometry while bag bottoms stay enclosed', () => {
    const config = clone(starter), engine = new AnimatedBouquet();
    for (const showStems of [false, true]) {
      config.arrangement = { ...DEFAULT_ARRANGEMENT, showStems }; engine.sync(config, false);
      const live = new T.Box3().setFromObject(engine.group), exported = buildBouquet(config), full = new T.Box3().setFromObject(exported);
      if (showStems) { expect(live.min.y).toBeLessThan(-1.78); expect(full.min.y).toBeLessThan(-1.78); } else { expect(live.min.y).toBeGreaterThan(-1.5); expect(full.min.y).toBeGreaterThan(-1.5); }
      disposeModel(exported);
    }
    config.wrapper.id = 'gift-bag'; expect(stemBase(config)).toBe(-1.36); engine.sync(config, false); expect(new T.Box3().setFromObject(engine.group).min.y).toBeGreaterThan(-1.5);
    const bag = buildBouquet(config); expect(new T.Box3().setFromObject(bag).min.y).toBeGreaterThan(-1.5); disposeModel(bag); engine.dispose();
  });
  it('rejects unbounded edits, duplicate identities, unknown flowers and malformed settings', () => {
    for (const arrangement of [null, { ...DEFAULT_ARRANGEMENT, profile: 'unknown' }, { ...DEFAULT_ARRANGEMENT, showStems: 'yes' }, { ...DEFAULT_ARRANGEMENT, edits: [{ ...defaultFlowerEdit('rose:0'), size: Infinity }] }, { ...DEFAULT_ARRANGEMENT, edits: [{ ...defaultFlowerEdit('rose:0'), height: .71 }] }, { ...DEFAULT_ARRANGEMENT, edits: [{ ...defaultFlowerEdit('rose:0'), x: -.46 }] }, { ...DEFAULT_ARRANGEMENT, edits: [defaultFlowerEdit('rose:0'), defaultFlowerEdit('rose:0')] }, { ...DEFAULT_ARRANGEMENT, edits: [defaultFlowerEdit('evil:0')] }, { ...DEFAULT_ARRANGEMENT, edits: [defaultFlowerEdit('rose:24')] }]) expect(() => validate({ ...starter, arrangement })).toThrow();
  });
  it('steps fillers independently, keeps their seed and cached models, and retains natural legacy layouts', () => {
    const config = clone(starter); config.fillers = [{ id: 'eucalyptus', count: 6, color: '#89aaa0' }, { id: 'wheat', count: 6, color: '#d5b475' }];
    const natural = layout(config), engine = new AnimatedBouquet(); engine.sync(config, false); const builds = engine.stats.modelBuilds;
    config.arrangement = { ...DEFAULT_ARRANGEMENT, fillerProfile: 'natural' }; expect(layout(config)).toEqual(natural);
    config.arrangement.fillerProfile = 'stepped'; const stepped = layout(config); expect(stepped.flowers).toEqual(natural.flowers);
    for (const [i, p] of stepped.fillers.entries()) {
      const old = natural.fillers[i]; expect(p.position[0]).toBe(old.position[0]); expect(p.position[2]).toBe(old.position[2]); expect(p.scale).toBe(old.scale); expect(p.turn).toBe(old.turn);
      if (p.position[2] > .3) expect(p.position[1]).toBeLessThan(old.position[1]);
      if (p.position[2] < -.3) expect(p.position[1]).toBeGreaterThan(old.position[1]);
      if (Math.abs(p.position[2]) < .1) expect(Math.abs(p.position[1] - old.position[1])).toBeLessThan(.06);
    }
    expect(stepped.fillers.some(p => p.position[2] > .3)).toBe(true); expect(stepped.fillers.some(p => p.position[2] < -.3)).toBe(true);
    engine.sync(config, false); expect(engine.stats.modelBuilds).toBe(builds); expect(engine.stems.filter(s => s.category === 'fillers').some(s => s.target.y > 1.8)).toBe(true);
    config.arrangement.profile = 'stepped'; expect(layout(config).fillers).toEqual(stepped.fillers); engine.dispose();
  });
  it('round-trips optional filler heights without changing older arrangements and rejects unknown profiles', () => {
    const config = clone(starter); config.arrangement = { ...DEFAULT_ARRANGEMENT, profile: 'stepped' }; expect(decode(encode(config))).toEqual(config);
    config.arrangement.fillerProfile = 'stepped'; expect(decode(encode(config))).toEqual(config);
    let saved = ''; saveDraft(config, { setItem: (_key, v) => { saved = v; } }); expect(loadDraft({ getItem: () => saved })).toEqual(config);
    for (const fillerProfile of [null, 'other', 1, {}, true]) expect(() => validate({ ...config, arrangement: { ...config.arrangement, fillerProfile } })).toThrow('filler arrangement');
  });
});
