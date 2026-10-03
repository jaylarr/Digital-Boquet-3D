import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { AnimatedBouquet, collisionLayout, resolveContacts } from '../src/animation';
import { scatterParticles } from '../src/effects';
import { clone, starter } from '../src/config';

describe('cached animated bouquet', () => {
  it('changes quantities using existing GPU models and preserves surviving stem identities', () => {
    const engine = new AnimatedBouquet(), config = clone(starter);
    try {
      engine.sync(config, false); const before = engine.metrics(), first = engine.stems[0];
      config.flowers[0].count++; engine.sync(config, false);
      expect(engine.metrics().modelBuilds).toBe(before.modelBuilds);
      expect(engine.stems.find(s => s.key === first.key)).toBe(first);
      expect(engine.metrics().active).toBe(13);
      config.flowers[0].count--; engine.sync(config, false);
      expect(engine.metrics().visibleStems).toBe(12);
      expect(engine.metrics().modelBuilds).toBe(before.modelBuilds);
    } finally { engine.dispose(); }
  });
  it('grows additions, keeps departing stems during shrink, and handles a rapid re-add', () => {
    const engine = new AnimatedBouquet(), config = clone(starter);
    try {
      engine.sync(config, true); config.flowers[0].count++; engine.sync(config, true);
      const added = engine.stems.find(s => s.key === 'flowers:rose:3')!;
      expect(added.growth).toBeLessThan(.01);
      for (let i = 0; i < 20; i++) engine.step(i / 60, 1 / 60, true);
      expect(added.growth).toBeGreaterThan(.99);
      config.flowers[0].count--; engine.sync(config, true); engine.step(.4, 1 / 60, true);
      expect(added.growth).toBeGreaterThan(0); expect(added.growth).toBeLessThan(.9);
      config.flowers[0].count++; engine.sync(config, true);
      expect(engine.stems.find(s => s.key === added.key)).toBe(added);
      config.flowers[0].count--; engine.sync(config, true);
      for (let i = 0; i < 40; i++) engine.step(.5 + i / 60, 1 / 60, true);
      expect(engine.stems.find(s => s.key === added.key)).toBeUndefined();
    } finally { engine.dispose(); }
  });
  it('sways without building geometry, and paused edits settle without requesting frames forever', () => {
    const engine = new AnimatedBouquet();
    try {
      engine.sync(starter, false); const p = engine.stems[0].position.clone(), builds = engine.metrics().modelBuilds;
      for (let i = 0; i < 60; i++) engine.step(i / 60, 1 / 60, true);
      expect(engine.stems[0].position.distanceTo(p)).toBeGreaterThan(.001);
      expect(engine.metrics().modelBuilds).toBe(builds);
      engine.sync(starter, false); expect(engine.step(0, 1 / 60, false)).toBe(false);
    } finally { engine.dispose(); }
  });
  it('bounds inactive model caches while exploring colors', () => {
    const engine = new AnimatedBouquet(), config = clone(starter);
    try {
      for (let i = 0; i < 12; i++) { config.flowers[0].color = `#${(0xb08090 + i * 112).toString(16)}`; engine.sync(config, false); }
      expect(engine.metrics().cachedModels).toBeLessThanOrEqual(8);
      engine.dispose(); expect(engine.group.children).toHaveLength(0);
    } finally { if (engine.group.children.length) engine.dispose(); }
  });
});
describe('soft botanical contacts and scattered effects', () => {
  it('separates coincident heads with finite bounded deterministic positions', () => {
    const create = () => Array.from({ length: 2 }, () => ({ position: new T.Vector3(), target: new T.Vector3(), radius: .2, growth: 1 }));
    const bodies = create(), copy = create();
    expect(resolveContacts(bodies, 16)).toBeGreaterThan(0); resolveContacts(copy, 16);
    expect(bodies[0].position.distanceTo(bodies[1].position)).toBeGreaterThan(.38);
    expect(bodies[0].position.equals(copy[0].position)).toBe(true);
    bodies.forEach(b => expect(b.position.length()).toBeLessThanOrEqual(.201));
  });
  it('returns repeatable collision-aware arrangements without changing portable state', () => {
    const config = clone(starter);
    expect(collisionLayout(config)).toEqual(collisionLayout(config)); expect(config).toEqual(starter);
  });
  it('scatters effects in a spaced volume with independent phases instead of a shared orbit', () => {
    const particles = scatterParticles('butterflies', 9);
    expect(particles).toEqual(scatterParticles('butterflies', 9));
    const radii = particles.map(p => Math.hypot(p.x, p.z));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(.6);
    expect(new Set(particles.map(p => p.phase))).toHaveLength(9);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]; expect(Math.abs(p.x) >= 1.15 || p.y >= 1.85).toBe(true);
      for (let j = i + 1; j < particles.length; j++) { const q = particles[j]; expect((p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2).toBeGreaterThanOrEqual(.12); }
    }
  });
});
