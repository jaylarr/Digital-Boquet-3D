import * as T from 'three';
import { type BouquetConfigV1 } from './config';
import { layout, type Placement } from './layout';
import { disposeModel, fitRibbon, mergeModel, previewModel, ribbon, stemLeaf, wrapper } from './models';

const UP = new T.Vector3(0, 1, 0), FRONT = new T.Vector3(0, 0, 1);
type StemCategory = 'flowers' | 'fillers';
interface Batch { key: string; prototype: T.Group; meshes: T.InstancedMesh[]; used: number; }
export interface ContactBody { position: T.Vector3; target: T.Vector3; radius: number; growth: number; }
interface Stem extends ContactBody {
  key: string; category: StemCategory; id: string; color: string; batch: Batch;
  scale: number; targetScale: number; targetGrowth: number; phase: number; turn: number;
  rotation: T.Quaternion; targetRotation: T.Quaternion;
}
export function stablePhase(key: string) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return (hash >>> 0) / 4294967296 * Math.PI * 2;
}

/** Soft head/foliage proxies, rather than expensive per-petal triangle collisions. */
export function resolveContacts(bodies: ContactBody[], iterations = 2) {
  let contacts = 0;
  for (let pass = 0; pass < iterations; pass++) for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j];
    if (a.growth < .15 || b.growth < .15) continue;
    let dx = b.position.x - a.position.x, dy = (b.position.y - a.position.y) * .7, dz = b.position.z - a.position.z;
    const min = a.radius * a.growth + b.radius * b.growth, distanceSq = dx * dx + dy * dy + dz * dz;
    if (distanceSq >= min * min) continue;
    const distance = Math.sqrt(distanceSq);
    if (distance < .00001) { const angle = (i + j * 3) * 2.399963; dx = Math.cos(angle); dz = Math.sin(angle); dy = 0; }
    else { dx /= distance; dy /= distance; dz /= distance; }
    const push = Math.min(.045, (min - distance) * .36);
    a.position.x -= dx * push; a.position.y -= dy * push * .3; a.position.z -= dz * push;
    b.position.x += dx * push; b.position.y += dy * push * .3; b.position.z += dz * push;
    contacts++;
  }
  // Keep contacts within the bouquet's framing and avoid unbounded separation in dense mixes.
  for (const b of bodies) {
    const dx = b.position.x - b.target.x, dy = b.position.y - b.target.y, dz = b.position.z - b.target.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (length > .2) b.position.set(b.target.x + dx / length * .2, b.target.y + dy / length * .2, b.target.z + dz / length * .2);
  }
  return contacts;
}

/** Matte botanical/paper surfaces use cheaper lighting; satin and metallic accents keep PBR. */
export function optimizeMaterials(group: T.Group, economy = false) {
  group.traverse(o => {
    if (!(o instanceof T.Mesh) || !(o.material instanceof T.MeshStandardMaterial)) return;
    const old = o.material;
    old.forceSinglePass = true;
    if (!economy && old.roughness < .5) return;
    o.material = new T.MeshLambertMaterial({ color: old.color, vertexColors: old.vertexColors, side: old.side,
      emissive: old.emissive, emissiveIntensity: old.emissiveIntensity, transparent: old.transparent,
      opacity: old.opacity, depthWrite: old.depthWrite });
    (o.material as T.Material).forceSinglePass = true; old.dispose();
  });
}
function instances(prototype: T.Group, capacity: number) {
  return prototype.children.map(child => {
    const m = child as T.Mesh, inst = new T.InstancedMesh(m.geometry, m.material, capacity);
    inst.instanceMatrix.setUsage(T.DynamicDrawUsage); inst.frustumCulled = false; inst.count = 0; return inst;
  });
}
function clearBatch(batch: Batch, group: T.Group) {
  batch.meshes.forEach(m => { group.remove(m); m.dispose(); }); disposeModel(batch.prototype);
}
export function collisionLayout(config: BouquetConfigV1) {
  const placed = layout(config), entries = [...placed.flowers, ...placed.fillers];
  const bodies = entries.map((p, i) => ({ position: new T.Vector3(...p.position), target: new T.Vector3(...p.position), growth: 1,
    radius: (i >= placed.flowers.length ? .105 : p.id === 'lavender' ? .09 : p.id === 'lily' ? .23 : .245) * p.scale }));
  resolveContacts(bodies, 6);
  entries.forEach((p, i) => { p.position = bodies[i].position.toArray() as [number, number, number]; });
  return placed;
}

export class AnimatedBouquet {
  readonly group = new T.Group();
  readonly stems: Stem[] = [];
  readonly stats = { modelBuilds: 0, updates: 0, updateMs: 0, updateMaxMs: 0, contacts: 0, transitioning: 0, active: 0 };
  private batches = new Map<string, Batch>();
  private decorations = new T.Group();
  private decorKey = '';
  private initialized = false;
  private settleTime = 0;
  private economy = false;
  private stemMeshes: T.InstancedMesh[];
  private stemPrototype: T.Group;
  private leaves: { prototype: T.Group; meshes: T.InstancedMesh[]; used: number }[];
  private dummy = new T.Object3D();
  private endpoint = new T.Vector3();
  private base = new T.Vector3();
  private delta = new T.Vector3();
  private normal = new T.Vector3();
  private sway = new T.Quaternion();
  private euler = new T.Euler();
  constructor() {
    this.stemPrototype = new T.Group();
    const geo = new T.CylinderGeometry(.008, .011, 1, 5, 8, true);
    // A small fixed curve adds a natural bend; the instance follows the moving flower head.
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin((p.getY(i) + .5) * Math.PI) * .018);
    geo.computeVertexNormals();
    this.stemPrototype.add(new T.Mesh(geo, new T.MeshLambertMaterial({ color: '#638450', side: T.DoubleSide })));
    this.stemMeshes = instances(this.stemPrototype, 72); this.group.add(...this.stemMeshes);
    this.leaves = [false, true].map(tulip => { const prototype = stemLeaf(tulip); optimizeMaterials(prototype); const meshes = instances(prototype, 48); this.group.add(...meshes); return { prototype, meshes, used: 0 }; });
    this.group.add(this.decorations);
  }
  sync(config: BouquetConfigV1, animate: boolean) {
    const start = performance.now(), placed = collisionLayout(config), wanted = new Set<string>(), ordinals = new Map<string, number>();
    for (const [category, entries] of [['flowers', placed.flowers], ['fillers', placed.fillers]] as const) for (const p of entries) {
      const kind = `${category}:${p.id}`, ordinal = ordinals.get(kind) ?? 0;
      ordinals.set(kind, ordinal + 1); const key = `${kind}:${ordinal}`; wanted.add(key);
      const batchKey = `${kind}:${p.color}`;
      let batch = this.batches.get(batchKey);
      if (!batch) {
        const prototype = previewModel(category, p.id, p.color); optimizeMaterials(prototype, this.economy);
        const meshes = instances(prototype, category === 'flowers' ? 24 : 12);
        batch = { key: batchKey, prototype, meshes, used: 0 }; this.batches.set(batchKey, batch); this.group.add(...meshes); this.stats.modelBuilds++;
      }
      let stem = this.stems.find(s => s.key === key);
      if (!stem) {
        stem = { key, category, id: p.id, color: p.color, batch, position: new T.Vector3(...p.position), target: new T.Vector3(...p.position),
          radius: 0, growth: this.initialized && animate ? .001 : 1, targetGrowth: 1, scale: p.scale, targetScale: p.scale,
          phase: stablePhase(key), turn: p.turn, rotation: new T.Quaternion(), targetRotation: new T.Quaternion() };
        this.stems.push(stem);
      }
      stem.batch = batch; stem.color = p.color; stem.target.set(...p.position); stem.targetScale = p.scale; stem.turn = p.turn; stem.targetGrowth = 1;
      stem.radius = (category === 'fillers' ? .105 : p.id === 'lavender' ? .09 : p.id === 'lily' ? .23 : .245) * p.scale;
      this.orientation(stem, p);
      if (!this.initialized || !animate) { stem.position.copy(stem.target); stem.rotation.copy(stem.targetRotation); stem.scale = p.scale; stem.growth = 1; }
    }
    for (const stem of this.stems) if (!wanted.has(stem.key)) stem.targetGrowth = 0;
    const decorKey = JSON.stringify([config.wrapper, config.ribbon]);
    if (decorKey !== this.decorKey) {
      this.group.remove(this.decorations); disposeModel(this.decorations);
      const source = new T.Group(); source.add(wrapper(config.wrapper.id, config.wrapper.color));
      source.add(fitRibbon(ribbon(config.ribbon.id, config.ribbon.color), config.wrapper.id));
      this.decorations = mergeModel(source); optimizeMaterials(this.decorations, this.economy); this.group.add(this.decorations); this.decorKey = decorKey;
    }
    this.settleTime = animate ? .4 : 0;
    this.initialized = true; this.stats.updates++; this.stats.updateMs = performance.now() - start;
    this.stats.updateMaxMs = Math.max(this.stats.updateMaxMs, this.stats.updateMs);
    if (!animate) this.step(0, 1, false, true);
  }
  private orientation(stem: Stem, p: Placement) {
    const [x, , z] = p.position;
    if (stem.category === 'flowers' && p.id !== 'lavender') {
      this.normal.set(x * .43, p.id === 'tulip' ? .95 : .62, z * .43 + (p.id === 'tulip' ? .28 : .55)).normalize();
      stem.targetRotation.setFromUnitVectors(FRONT, this.normal);
      this.sway.setFromAxisAngle(FRONT, p.turn * .2); stem.targetRotation.multiply(this.sway);
    } else { this.euler.set(0, p.turn, -x * .18); stem.targetRotation.setFromEuler(this.euler); }
  }
  step(time: number, dt: number, motion: boolean, snap = false) {
    this.settleTime = snap ? 0 : Math.max(0, this.settleTime - dt);
    const blend = snap ? 1 : 1 - Math.exp(-11 * dt), grow = snap ? 1 : 1 - Math.exp(-24 * dt);
    for (let i = this.stems.length - 1; i >= 0; i--) {
      const s = this.stems[i]; s.growth += (s.targetGrowth - s.growth) * grow;
      if (!s.targetGrowth && s.growth < .012) { this.stems.splice(i, 1); continue; }
      s.scale += (s.targetScale - s.scale) * blend; s.rotation.slerp(s.targetRotation, blend);
      const strength = s.category === 'fillers' || s.id === 'lavender' ? .045 : s.id === 'peony' ? .014 : .024;
      const wx = motion ? Math.sin(time * 1.15 + s.phase) * strength + Math.sin(time * .55) * .018 : 0;
      const wz = motion ? Math.cos(time * .95 + s.phase * 1.3) * strength * .65 : 0;
      this.endpoint.copy(s.target); this.endpoint.x += wx; this.endpoint.z += wz;
      s.position.lerp(this.endpoint, blend);
    }
    this.stats.contacts = resolveContacts(this.stems, snap ? 6 : 2);
    for (const b of this.batches.values()) b.used = 0;
    this.leaves.forEach(l => { l.used = 0; });
    let stemIndex = 0, transitioning = 0, active = 0;
    for (const s of this.stems) {
      const growth = Math.max(.001, s.growth), sc = growth * s.scale;
      if (Math.abs(s.targetGrowth - s.growth) > .015 || Math.abs(s.scale - s.targetScale) > .005) transitioning++;
      if (s.targetGrowth) active++;
      this.base.set(s.target.x * .07, -1.36, s.target.z * .07);
      this.dummy.position.copy(this.base).lerp(s.position, growth); this.dummy.quaternion.copy(s.rotation);
      if (motion) { this.euler.set(Math.sin(time * 1.1 + s.phase) * .022, 0, Math.cos(time * .95 + s.phase) * .018); this.sway.setFromEuler(this.euler); this.dummy.quaternion.multiply(this.sway); }
      this.dummy.scale.setScalar(sc); this.dummy.updateMatrix();
      const slot = s.batch.used++; s.batch.meshes.forEach(m => m.setMatrixAt(slot, this.dummy.matrix));
      // Stem and leaf attachment points follow the same moving head, so edits do not detach them.
      this.endpoint.copy(this.base).lerp(s.position, growth);
      if (s.category === 'fillers' || s.id === 'lavender') this.endpoint.y -= .5 * sc;
      else { this.normal.copy(FRONT).applyQuaternion(s.rotation); this.endpoint.addScaledVector(this.normal, -.075 * sc); }
      this.base.set(s.target.x * .07, -1.36, s.target.z * .07);
      this.delta.subVectors(this.endpoint, this.base);
      this.dummy.position.copy(this.base).addScaledVector(this.delta, .5);
      this.dummy.quaternion.setFromUnitVectors(UP, this.normal.copy(this.delta).normalize());
      this.dummy.scale.set(growth, Math.max(.001, this.delta.length()), growth); this.dummy.updateMatrix();
      this.stemMeshes.forEach(m => m.setMatrixAt(stemIndex, this.dummy.matrix)); stemIndex++;
      if (s.category === 'flowers') {
        const l = this.leaves[s.id === 'tulip' ? 1 : 0];
        this.dummy.position.copy(this.base).addScaledVector(this.delta, .73);
        this.euler.set(.12, s.turn, s.target.x > 0 ? -.15 : 1.2); this.dummy.quaternion.setFromEuler(this.euler);
        this.dummy.scale.setScalar(sc); this.dummy.updateMatrix(); l.meshes.forEach(m => m.setMatrixAt(l.used, this.dummy.matrix)); l.used++;
      }
    }
    this.stemMeshes.forEach(m => { m.count = stemIndex; m.instanceMatrix.needsUpdate = true; });
    this.leaves.forEach(l => l.meshes.forEach(m => { m.count = l.used; m.instanceMatrix.needsUpdate = true; }));
    const idle: Batch[] = [];
    for (const b of this.batches.values()) {
      b.meshes.forEach(m => { m.count = b.used; m.visible = b.used > 0; m.instanceMatrix.needsUpdate = true; });
      if (!b.used) idle.push(b);
    }
    // Bound GPU cache growth when exploring colors or many presets.
    while (idle.length > 4) { const b = idle.shift()!; clearBatch(b, this.group); this.batches.delete(b.key); }
    this.stats.transitioning = transitioning; this.stats.active = active;
    return transitioning > 0 || this.settleTime > 0;
  }
  lowerQuality() {
    this.economy = true;
    optimizeMaterials(this.decorations, true);
    for (const b of this.batches.values()) {
      optimizeMaterials(b.prototype, true);
      b.meshes.forEach((m, i) => { m.material = (b.prototype.children[i] as T.Mesh).material; });
    }
  }
  metrics() { return { ...this.stats, cachedModels: this.batches.size, visibleStems: this.stems.length }; }
  dispose() {
    for (const b of this.batches.values()) clearBatch(b, this.group);
    this.batches.clear();
    this.stemMeshes.forEach(m => m.dispose()); disposeModel(this.stemPrototype);
    this.leaves.forEach(l => { l.meshes.forEach(m => m.dispose()); disposeModel(l.prototype); });
    disposeModel(this.decorations); this.group.clear(); this.stems.length = 0;
  }
}
