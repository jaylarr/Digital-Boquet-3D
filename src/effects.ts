import * as T from 'three';
import { random } from './config';
import { catalog } from './catalog';
import { disposeModel, effectModel, mergeModel } from './models';
import { optimizeMaterials, stablePhase } from './animation';

export const bursts = new Set(['confetti', 'starburst', 'happy-faces']);
export interface Particle { x: number; y: number; z: number; phase: number; speed: number; size: number; drift: number; }
interface EffectPart { mesh: T.InstancedMesh; prototype: T.Group; wing: number; }
export interface EffectEntry { id: string; particles: Particle[]; parts: EffectPart[]; }
export interface Effects { group: T.Group; entries: EffectEntry[]; dispose: () => void; lowerQuality: () => void; }

/** Independent dimensions and phases, plus rejection spacing, avoid rings and spirals. */
export function scatterParticles(id: string, count: number): Particle[] {
  const rng = random(Math.floor(stablePhase(id) * 1000000) + 973), particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      x = (rng() * 2 - 1) * 2.05; y = -.1 + rng() * 2.5; z = -.65 + rng() * 1.35;
      if (Math.abs(x) < 1.15 && y < 1.85) continue;
      if (particles.some(p => (x - p.x) ** 2 + (y - p.y) ** 2 + (z - p.z) ** 2 < .12)) continue;
      break;
    }
    particles.push({ x, y, z, phase: rng() * Math.PI * 2, speed: .09 + rng() * .12, size: .62 + rng() * .45, drift: .07 + rng() * .11 });
  }
  return particles;
}
export function makeEffects(ids: string[], low: boolean): Effects {
  const group = new T.Group(), entries: EffectEntry[] = [];
  for (const id of ids) {
    const count = id === 'rainbow' ? 1 : id === 'butterflies' ? 3 : bursts.has(id) ? (low ? 9 : 12) : low ? 6 : 9;
    const source = effectModel(id, catalog.effects.find(e => e.id === id)!.color), models: { model: T.Group; wing: number }[] = [];
    if (id === 'butterflies') {
      const body = new T.Group();
      for (const child of [...source.children]) {
        if (child.name === 'left-wing' || child.name === 'right-wing') models.push({ model: mergeModel(child as T.Group), wing: child.name === 'left-wing' ? -1 : 1 });
        else body.add(child);
      }
      models.push({ model: mergeModel(body), wing: 0 });
    } else models.push({ model: mergeModel(source), wing: 0 });
    const parts: EffectPart[] = [];
    for (const { model, wing } of models) {
      optimizeMaterials(model);
      for (const child of model.children) {
        const m = child as T.Mesh, mesh = new T.InstancedMesh(m.geometry, m.material, count);
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; group.add(mesh); parts.push({ mesh, prototype: model, wing });
      }
    }
    entries.push({ id, particles: scatterParticles(id, count), parts });
  }
  return { group, entries,
    lowerQuality: () => {
      for (const e of entries) for (const prototype of new Set(e.parts.map(p => p.prototype))) {
        optimizeMaterials(prototype, true);
        const matching = e.parts.filter(p => p.prototype === prototype);
        matching.forEach((p, i) => { p.mesh.material = (prototype.children[i] as T.Mesh).material; });
      }
    },
    dispose: () => { for (const e of entries) { e.parts.forEach(p => p.mesh.dispose()); new Set(e.parts.map(p => p.prototype)).forEach(disposeModel); } group.clear(); },
  };
}
const dummy = new T.Object3D(), orientation = new T.Quaternion(), wingRotation = new T.Quaternion(), Y = new T.Vector3(0, 1, 0);
export function updateEffects(entries: EffectEntry[], time: number, staticFrame: boolean) {
  for (const e of entries) {
    const burst = bursts.has(e.id); e.parts.forEach(p => { p.mesh.visible = !burst || time < 3 || staticFrame; });
    for (let i = 0; i < e.particles.length; i++) {
      const p = e.particles[i], t = time * p.speed;
      dummy.position.set(p.x + Math.sin(t * 1.7 + p.phase) * p.drift, p.y + Math.sin(t * 2.1 + p.phase * 1.3) * .12, p.z + Math.cos(t * 1.2 + p.phase) * .09);
      dummy.rotation.set(.08 * Math.sin(t + p.phase), .22 * Math.sin(t * 1.4 + p.phase), .11 * Math.sin(t * 1.9 + p.phase));
      dummy.scale.setScalar(p.size);
      if (e.id === 'hearts' || e.id === 'bubbles') {
        const cycle = (p.phase / (Math.PI * 2) + time * p.speed / 3) % 1;
        dummy.position.y = .15 + cycle * 2.35;
        if (Math.abs(p.x) < 1.15) dummy.position.x = Math.sign(p.x || 1) * (1.3 + Math.sin(t + p.phase) * .1);
        dummy.scale.setScalar(p.size * Math.min(1, cycle * 12, (1 - cycle) * 12));
      }
      if (e.id === 'petals') {
        const cycle = (p.phase / (Math.PI * 2) + time * p.speed / 2) % 1;
        dummy.position.y = 2.6 - cycle * 2.7; dummy.rotation.x = time * .55 + p.phase;
        if (Math.abs(p.x) < 1.15) dummy.position.x = Math.sign(p.x || 1) * 1.35;
        dummy.scale.setScalar(p.size * Math.min(1, cycle * 10, (1 - cycle) * 10));
      }
      if (e.id === 'fireflies') dummy.scale.setScalar(p.size * (.8 + Math.sin(time * 1.6 + p.phase) * .18));
      if (e.id === 'butterflies') {
        dummy.position.x += Math.sin(time * .38 + p.phase) * .14;
        dummy.position.y += Math.sin(time * .7 + p.phase) * .11;
        dummy.scale.setScalar(p.size * 1.3);
      }
      if (e.id === 'rainbow') { dummy.position.set(0, .8, -.1); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); }
      if (burst) {
        const age = Math.min(time, 2.8), spread = 1 - Math.exp(-age * 3);
        dummy.position.set(p.x * (.7 + spread * .45), p.y + Math.sin(p.phase) * age * .25 - age * age * .12, p.z);
        dummy.rotation.z = time * (.5 + p.speed) + p.phase;
        dummy.scale.setScalar(p.size * (staticFrame ? 1 : Math.min(1, (3 - age) * 2)));
      }
      orientation.copy(dummy.quaternion);
      for (const part of e.parts) {
        dummy.quaternion.copy(orientation);
        if (part.wing) { wingRotation.setFromAxisAngle(Y, part.wing * (.2 + Math.sin(time * 5 + p.phase) * .65)); dummy.quaternion.multiply(wingRotation); }
        dummy.updateMatrix(); part.mesh.setMatrixAt(i, dummy.matrix);
      }
    }
    e.parts.forEach(p => { p.mesh.instanceMatrix.needsUpdate = true; });
  }
}
