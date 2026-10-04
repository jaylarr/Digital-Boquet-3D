import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { catalog } from '../src/catalog';
import { clone, starter } from '../src/config';
import { AnimatedBouquet, collisionLayout } from '../src/animation';
import { disposeModel, wrapper } from '../src/models';
import { wrapperProfile } from '../src/containment';

describe('wrapper contacts', () => {
  it.each(catalog.wrappers)('keeps the collision field inside the actual $id paper, including its seams and rim', item => {
    const paper = wrapper(item.id, item.color), boundary = wrapperProfile(paper), walls: T.Object3D[] = [];
    paper.updateMatrixWorld(true); paper.traverse(o => { if (o.userData.wrapperWall) walls.push(o); });
    const ray = new T.Raycaster(), origin = new T.Vector3(), direction = new T.Vector3();
    let contacts = 0;
    try {
      for (let column = 0; column < 32; column++) for (let row = 0; row < 32; row++) {
        const angle = (column + .37) / 32 * Math.PI * 2, y = -1.35 + row / 31 * 2.55;
        origin.set(0, y, 0); direction.set(Math.sin(angle), 0, Math.cos(angle)); ray.set(origin, direction);
        const hit = ray.intersectObjects(walls, false)[0]; if (!hit) continue;
        contacts++;
        expect(boundary.limit(direction.x, y, direction.z), `${item.id} at angle ${angle}, y ${y}`).toBeLessThan(hit.distance - .009);
      }
      expect(contacts).toBeGreaterThan(550);
      const config = clone(starter); config.spread = config.size = 1.2; config.wrapper.id = item.id;
      config.flowers = [{ id: 'rose', count: 24, color: '#e8a0af' }]; config.fillers = [{ id: 'fern', count: 12, color: '#86a881' }];
      // The opening releases the heads into the requested maximum spread.
      for (const p of collisionLayout(config).flowers) expect(boundary.limit(...p.position)).toBeGreaterThanOrEqual(Math.hypot(p.position[0], p.position[2]));
    } finally { disposeModel(paper); }
  });
  it('reuses contact fields during warm edits and changes the live field when switching wrapper style', () => {
    const config = clone(starter), engine = new AnimatedBouquet();
    try {
      engine.sync(config, false); const first = engine.boundary.profile, builds = engine.metrics().modelBuilds;
      // Rose/tulip/daisy head instances keep the ordinary cached material and full spread.
      const heads = engine.group.children.filter(o => o instanceof T.InstancedMesh && o.count === 3 && !o.userData.wrapperContact);
      expect(heads.length).toBeGreaterThanOrEqual(3);
      config.spread = 1.2; config.flowers[0].count++; engine.sync(config, true);
      for (let i = 0; i < 80; i++) engine.step(i / 60, 1 / 60, true);
      expect(engine.boundary.profile).toBe(first); expect(engine.metrics().modelBuilds).toBe(builds);
      config.wrapper.id = 'gift-bag'; engine.sync(config, true); expect(engine.boundary.profile).not.toBe(first);
      config.wrapper.id = 'classic-cone'; engine.sync(config, false); expect(engine.boundary.profile).toBe(first);
    } finally { engine.dispose(); }
  });
  it('bakes export contacts without mutating a shared botanical prototype', () => {
    const paper = wrapper('classic-cone', '#f0c5a5'), profile = wrapperProfile(paper), botany = new T.Group();
    const geometry = new T.CylinderGeometry(.012, .012, 2.5, 5, 24), original = geometry.getAttribute('position').array.slice();
    const plant = new T.Mesh(geometry, new T.MeshLambertMaterial()); plant.position.set(.8, -.1, .45); botany.add(plant);
    try {
      profile.bake(botany); expect(plant.geometry).not.toBe(geometry); expect(geometry.getAttribute('position').array).toEqual(original);
      const p = plant.geometry.getAttribute('position'), v = new T.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(plant.matrixWorld); expect(Math.hypot(v.x, v.z)).toBeLessThanOrEqual(profile.limit(v.x, v.y, v.z) + .00001); }
    } finally { geometry.dispose(); disposeModel(botany); disposeModel(paper); }
  });
  it('keeps rendered stem and branch faces inside the paper throughout maximum-spread grow/shrink transitions', () => {
    const engine = new AnimatedBouquet(), config = clone(starter);
    config.flowers = [{ id: 'lavender', count: 24, color: '#a89bbf' }];
    config.fillers = [{ id: 'star-picks', count: 4, color: '#dbb665' }, { id: 'fern', count: 4, color: '#88a783' }, { id: 'ruscus', count: 4, color: '#7ea98c' }];
    config.size = config.spread = 1.2;
    const matrix = new T.Matrix4(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), mid = new T.Vector3();
    const origin = new T.Vector3(), direction = new T.Vector3(), ray = new T.Raycaster();
    try {
      for (const item of catalog.wrappers) {
        config.wrapper.id = item.id; const paper = wrapper(item.id, item.color), walls: T.Object3D[] = [];
        paper.updateMatrixWorld(true); paper.traverse(o => { if (o.userData.wrapperWall) walls.push(o); });
        engine.sync(config, false);
        for (const growth of [1, .6, .3]) {
          engine.stems.forEach(s => { s.growth = growth; s.targetGrowth = growth; }); engine.step(1.2, 1 / 60, true);
          const profile = engine.boundary.profile!;
          engine.group.traverse(object => {
            if (!(object instanceof T.InstancedMesh)) return;
            const p = object.geometry.getAttribute('position'), index = object.geometry.index;
            for (let instance = 0; instance < object.count; instance++) {
              object.getMatrixAt(instance, matrix);
              for (let face = 0; face < (index?.count ?? p.count); face += 3) {
                [a, b, c].forEach((v, i) => { v.fromBufferAttribute(p, index ? index.getX(face + i) : face + i).applyMatrix4(matrix); profile.constrain(v); });
                mid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
                const radius = Math.hypot(mid.x, mid.z);
                if (radius <= profile.limit(mid.x, mid.y, mid.z) + .025) continue;
                origin.set(0, mid.y, 0); direction.set(mid.x, 0, mid.z).normalize(); ray.set(origin, direction);
                const hit = ray.intersectObjects(walls, false)[0];
                if (hit) expect(radius, `${item.id}, growth ${growth}, face at ${mid.toArray()}`).toBeLessThan(hit.distance + .0001);
              }
            }
          });
        }
        disposeModel(paper);
      }
    } finally { engine.dispose(); }
  });
});
