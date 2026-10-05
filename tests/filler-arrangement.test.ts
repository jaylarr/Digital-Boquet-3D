import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { clone, decode, encode, loadDraft, saveDraft, starter, validate } from '../src/config';
import { DEFAULT_ARRANGEMENT, defaultFlowerEdit, fillerInstances, pruneArrangement } from '../src/flowerArrangement';
import { layout } from '../src/layout';
import { AnimatedBouquet, collisionLayout } from '../src/animation';
import { buildBouquet, disposeModel, filler, wrapper } from '../src/models';
import { wrapperProfile } from '../src/containment';

describe('filler arrangement', () => {
  it('defaults both categories to stepped and preserves neutral and legacy arrangements', () => {
    expect(DEFAULT_ARRANGEMENT.profile).toBe('stepped');
    expect(DEFAULT_ARRANGEMENT.fillerProfile).toBe('stepped');
    const config = clone(starter);
    expect(layout({ ...config, arrangement: { ...DEFAULT_ARRANGEMENT, fillerHeight: 0, fillerSize: 1, fillerSpread: 1, fillerEdits: [] } })).toEqual(layout(config));
    config.arrangement = { profile: 'natural', fillerProfile: 'natural', edits: [], showStems: false };
    expect(decode(encode(config))).toEqual(config);
    expect(decode(encode(starter))).toEqual(starter);
  });

  it('applies bulk filler transforms without altering flowers or individual adjustments', () => {
    const config = clone(starter);
    for (const profile of ['natural', 'stepped'] as const) {
      config.arrangement = { ...DEFAULT_ARRANGEMENT, fillerProfile: profile, fillerEdits: [{ ...defaultFlowerEdit('eucalyptus:1'), height: .2, size: 1.1, x: .1 }] };
      const before = layout(config);
      config.arrangement.fillerHeight = .4; config.arrangement.fillerSize = 1.2; config.arrangement.fillerSpread = 1.2;
      const after = layout(config);
      expect(after.flowers).toEqual(before.flowers);
      after.fillers.forEach((p, i) => {
        expect(p.position[1] - before.fillers[i].position[1]).toBeCloseTo(.4);
        expect(p.scale / before.fillers[i].scale).toBeCloseTo(1.2);
        expect(p.position[0]).toBeCloseTo((before.fillers[i].position[0] - (i === 1 ? .1 : 0)) * 1.2 + (i === 1 ? .1 : 0));
        expect(p.position[2]).toBeCloseTo(before.fillers[i].position[2] * 1.2);
      });
      expect(config.arrangement.fillerEdits![0].height).toBe(.2);
    }
  });

  it('retains the bouquet spread link and targets one stable filler through shuffling', () => {
    const config = clone(starter);
    config.arrangement = { ...DEFAULT_ARRANGEMENT, fillerProfile: 'natural', fillerSpread: 1.2, fillerEdits: [{ ...defaultFlowerEdit('eucalyptus:1'), height: .35, size: 1.4, x: .2, z: -.3 }] };
    for (const seed of [72631, 7, 12345]) {
      config.seed = seed;
      const baseline = layout({ ...config, arrangement: { ...config.arrangement, fillerEdits: [] } });
      const actual = layout(config);
      expect(actual.flowers).toEqual(baseline.flowers);
      for (const p of actual.fillers) {
        const old = baseline.fillers.find(f => f.key === p.key)!;
        if (p.key !== 'eucalyptus:1') expect(p).toEqual(old);
        else {
          expect(p.position[1] - old.position[1]).toBeCloseTo(.35); expect(p.scale / old.scale).toBeCloseTo(1.4);
          expect(p.position[0] - old.position[0]).toBeCloseTo(.2); expect(p.position[2] - old.position[2]).toBeCloseTo(-.3);
        }
      }
    }
    config.arrangement.fillerEdits = []; const before = layout(config); config.spread = 1.2;
    layout(config).fillers.forEach((p, i) => { expect(p.position[0]).toBeCloseTo(before.fillers[i].position[0] * 1.2); expect(p.position[2]).toBeCloseTo(before.fillers[i].position[2] * 1.2); });
  });

  it('updates the stepped tier when an individual filler moves front or back', () => {
    const config = clone(starter), baseline = layout(config);
    const p = baseline.fillers[0], radius = (.59 + Math.sqrt(9) * .11);
    config.arrangement = { ...DEFAULT_ARRANGEMENT, fillerEdits: [{ ...defaultFlowerEdit(p.key!), z: -.2, height: .3 }] };
    const next = layout(config).fillers[0];
    const tier = (z: number) => -.48 * Math.max(-1, Math.min(1, z / radius));
    expect(next.position[1] - p.position[1]).toBeCloseTo(.3 + tier(p.position[2] - .2) - tier(p.position[2]));
  });

  it('round trips all filler settings through links, validation and drafts', () => {
    const config = clone(starter); config.arrangement = { ...DEFAULT_ARRANGEMENT, fillerHeight: -.4, fillerSize: 1.2, fillerSpread: .8, fillerEdits: [{ key: 'eucalyptus:2', height: .7, size: 1.45, x: -.45, z: .45 }] };
    expect(decode(encode(config))).toEqual(config);
    let saved = ''; saveDraft(config, { setItem: (_key, value) => { saved = value; } });
    expect(loadDraft({ getItem: () => saved })).toEqual(config);
  });

  it('rejects invalid filler settings, identities, duplicate edits and excessive edits', () => {
    for (const field of ['fillerHeight', 'fillerSize', 'fillerSpread']) {
      for (const value of [null, '1', NaN, Infinity, {}, -1, 2]) expect(() => validate({ ...starter, arrangement: { ...DEFAULT_ARRANGEMENT, [field]: value } })).toThrow('filler');
    }
    for (const fillerEdits of [null, {}, [null], [defaultFlowerEdit('rose:0')], [defaultFlowerEdit('eucalyptus:12')], [defaultFlowerEdit('eucalyptus:0'), defaultFlowerEdit('eucalyptus:0')], [{ ...defaultFlowerEdit('eucalyptus:0'), x: .46 }], [{ ...defaultFlowerEdit('eucalyptus:0'), size: .59 }], Array.from({ length: 13 }, (_, i) => defaultFlowerEdit(`eucalyptus:${i}`))]) {
      expect(() => validate({ ...starter, arrangement: { ...DEFAULT_ARRANGEMENT, fillerEdits } })).toThrow('filler');
    }
  });

  it('prunes removed filler identities while preserving flower edits and group settings', () => {
    const config = clone(starter); config.arrangement = { ...DEFAULT_ARRANGEMENT, fillerHeight: .4, edits: [defaultFlowerEdit('rose:0')], fillerEdits: [defaultFlowerEdit('eucalyptus:0'), defaultFlowerEdit('eucalyptus:2')] };
    config.fillers[0].count = 1;
    const next = pruneArrangement(config);
    expect(next.arrangement?.fillerEdits).toEqual([defaultFlowerEdit('eucalyptus:0')]); expect(next.arrangement?.edits).toEqual(config.arrangement.edits); expect(next.arrangement?.fillerHeight).toBe(.4);
    expect(validate(config).arrangement?.fillerEdits).toEqual(next.arrangement?.fillerEdits);
    next.fillers = []; const removed = pruneArrangement(next); removed.fillers = clone(starter).fillers;
    expect(removed.arrangement?.fillerEdits).toEqual([]); expect(fillerInstances(removed.fillers)).toHaveLength(3);
  });

  it('reuses filler instances and pick identities and exports adjusted natural fillers', () => {
    const config = clone(starter), engine = new AnimatedBouquet();
    config.flowers = []; config.fillers = [{ id: 'fern', count: 3, color: '#6e9a79' }];
    config.arrangement = { ...DEFAULT_ARRANGEMENT, fillerProfile: 'natural' };
    try {
      engine.sync(config, false); const builds = engine.stats.modelBuilds, selected = engine.stems.find(s => s.key === 'fillers:fern:1');
      const before = buildBouquet(config, collisionLayout(config)), oldBounds = new T.Box3().setFromObject(before); disposeModel(before);
      config.arrangement = { ...config.arrangement, fillerHeight: .7, fillerSize: 1.2, fillerSpread: 1.2, fillerEdits: [{ ...defaultFlowerEdit('fern:1'), height: .7, size: 1.45 }] };
      engine.sync(config, false); expect(engine.stats.modelBuilds).toBe(builds); expect(engine.stems.find(s => s.key === 'fillers:fern:1')).toBe(selected);
      const keys = new Set<string>(); engine.group.traverse(o => { if (o instanceof T.InstancedMesh) for (const key of o.userData.fillerKeys ?? []) if (key) keys.add(key); });
      expect(keys).toEqual(new Set(['fern:0', 'fern:1', 'fern:2']));
      const exported = buildBouquet(config, collisionLayout(config)); expect(new T.Box3().setFromObject(exported).max.y).toBeGreaterThan(oldBounds.max.y + .5); disposeModel(exported);
      config.seed = 555; engine.sync(config, false); expect(engine.stems.find(s => s.key === 'fillers:fern:1')).toBe(selected); expect(engine.stats.modelBuilds).toBe(builds);
    } finally { engine.dispose(); }
  });

  it('keeps extreme adjusted filler export vertices inside physical wrapper walls', () => {
    const config = clone(starter); config.fillers = [{ id: 'eucalyptus', count: 1, color: '#89aaa0' }];
    const ray = new T.Raycaster(), origin = new T.Vector3(), direction = new T.Vector3(), point = new T.Vector3();
    for (const id of ['classic-cone', 'pleated', 'gift-bag']) {
      config.wrapper.id = id; const paper = wrapper(id, '#f0c5a5'), profile = wrapperProfile(paper), walls: T.Object3D[] = [];
      paper.updateMatrixWorld(true); paper.traverse(o => { if (o.userData.wrapperWall) walls.push(o); });
      try {
        for (const fillerProfile of ['natural', 'stepped'] as const) for (const height of [-.4, .7]) {
          config.arrangement = { ...DEFAULT_ARRANGEMENT, fillerProfile, fillerHeight: height, fillerSize: 1.2, fillerSpread: 1.2, fillerEdits: [{ key: 'eucalyptus:0', height, size: 1.45, x: .45, z: -.45 }] };
          const placed = collisionLayout(config).fillers[0], model = filler(placed.id, placed.color);
          model.position.set(...placed.position); model.scale.setScalar(placed.scale); model.rotation.y = placed.turn; model.rotation.z = -placed.position[0] * .18;
          try {
            profile.bake(model); model.updateMatrixWorld(true);
            model.traverse(o => {
              if (!(o instanceof T.Mesh)) return;
              const vertices = o.geometry.getAttribute('position');
              for (let i = 0; i < vertices.count; i += 12) {
                point.fromBufferAttribute(vertices, i).applyMatrix4(o.matrixWorld);
                const radius = Math.hypot(point.x, point.z); if (radius < .001) continue;
                origin.set(0, point.y, 0); direction.set(point.x, 0, point.z).normalize(); ray.set(origin, direction);
                const hit = ray.intersectObjects(walls, false)[0];
                if (hit) expect(radius, `${id}, ${fillerProfile}, height ${height}`).toBeLessThanOrEqual(hit.distance + .0001);
              }
            });
          } finally { disposeModel(model); }
        }
      } finally { disposeModel(paper); }
    }
  });
});
