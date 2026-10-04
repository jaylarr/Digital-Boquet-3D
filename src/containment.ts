import * as T from 'three';

const ANGLES = 64, ROWS = 96, TAU = Math.PI * 2, CLEARANCE = .065;
const RELEASE_CURVE = 40;
const profiles = new Map<string, WrapperProfile>();

/** A small polar collision field, sampled from the actual paper triangles once per style. */
export class WrapperProfile {
  readonly data = new Float32Array(ANGLES * ROWS * 4);
  readonly minY: number;
  readonly maxY: number;
  readonly step: number;
  readonly release = new T.Vector2();
  constructor(paper: T.Group) {
    const triangles: number[][] = [], point = new T.Vector3();
    let low = Infinity, high = -Infinity;
    paper.updateMatrixWorld(true);
    paper.traverse(object => {
      if (!(object instanceof T.Mesh) || !object.userData.wrapperWall) return;
      const positions = object.geometry.getAttribute('position'), index = object.geometry.index;
      for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
        const triangle: number[] = [];
        for (let j = 0; j < 3; j++) {
          point.fromBufferAttribute(positions, index ? index.getX(i + j) : i + j).applyMatrix4(object.matrixWorld);
          triangle.push(point.x, point.y, point.z); low = Math.min(low, point.y); high = Math.max(high, point.y);
        }
        triangles.push(triangle);
      }
    });
    if (!triangles.length) throw new Error('Wrapper has no collision walls');
    this.minY = low; this.maxY = high + .35; this.step = (this.maxY - low) / (ROWS - 1);
    for (let column = 0; column < ANGLES; column++) {
      const a = column / ANGLES * TAU, sin = Math.sin(a), cos = Math.cos(a);
      const radii = new Float64Array(ROWS).fill(Infinity);
      let rimY = low;
      for (const t of triangles) {
        // Slice by the vertical plane through this ray. Each cut is a line in radius/height.
        const cut: number[][] = [];
        for (let edge = 0; edge < 3; edge++) {
          const i = edge * 3, j = ((edge + 1) % 3) * 3;
          const p = t[i] * cos - t[i + 2] * sin, q = t[j] * cos - t[j + 2] * sin;
          if (Math.abs(p) < 1e-8) cut.push([t[i] * sin + t[i + 2] * cos, t[i + 1]]);
          if (p * q < 0) {
            const f = p / (p - q), x = t[i] + (t[j] - t[i]) * f, z = t[i + 2] + (t[j + 2] - t[i + 2]) * f;
            cut.push([x * sin + z * cos, t[i + 1] + (t[j + 1] - t[i + 1]) * f]);
          }
        }
        if (cut.length < 2 || cut.some(p => p[0] <= 0)) continue;
        const first = cut.reduce((a, b) => a[1] < b[1] ? a : b), last = cut.reduce((a, b) => a[1] > b[1] ? a : b);
        rimY = Math.max(rimY, last[1]);
        const height = last[1] - first[1]; if (height < 1e-8) continue;
        const start = Math.max(0, Math.ceil((first[1] - low) / this.step - 1e-7));
        const end = Math.min(ROWS - 1, Math.floor((last[1] - low) / this.step + 1e-7));
        for (let row = start; row <= end; row++) {
          const f = (low + row * this.step - first[1]) / height;
          radii[row] = Math.min(radii[row], first[0] + (last[0] - first[0]) * f);
        }
      }
      const lastRow = Math.max(0, Math.floor((rimY - low) / this.step));
      // Missing rows at sheet seams use the smaller neighboring bound.
      for (let row = 0; row <= lastRow; row++) if (!Number.isFinite(radii[row])) {
        let next = row + 1; while (next <= lastRow && !Number.isFinite(radii[next])) next++;
        radii[row] = Math.min(row ? radii[row - 1] : .18, next <= lastRow ? radii[next] : .18);
      }
      const rimRadius = radii[lastRow], slope = lastRow ? Math.max(0, Math.min(2, (rimRadius - radii[lastRow - 1]) / this.step)) : 0;
      for (let row = 0; row < ROWS; row++) {
        const above = Math.max(0, low + row * this.step - rimY);
        // A smooth continuation above the opening releases stems into the full flower spread.
        const radius = row <= lastRow ? radii[row] : rimRadius + slope * above + RELEASE_CURVE * above * above;
        const offset = (row * ANGLES + column) * 4;
        this.data[offset] = Math.max(.06, radius - CLEARANCE); this.data[offset + 3] = 1;
      }
    }
    // Above every physical rim all columns use an increasing quadratic. Its common lower
    // bound skips texture lookups for the flower canopy while retaining exact contacts below.
    const releaseRow = Math.ceil((high - low) / this.step);
    let radius = Infinity;
    for (let column = 0; column < ANGLES; column++) radius = Math.min(radius, this.data[(releaseRow * ANGLES + column) * 4]);
    this.release.set(low + releaseRow * this.step, radius);
  }
  limit(x: number, y: number, z: number) {
    if (y >= this.maxY) return Infinity;
    const angle = ((Math.atan2(x, z) / TAU + 1) % 1) * ANGLES, column = Math.floor(angle);
    const height = Math.max(0, (y - this.minY) / this.step), row = Math.min(ROWS - 2, Math.floor(height)), f = height - row;
    const radius = (c: number) => this.data[(row * ANGLES + c) * 4] * (1 - f) + this.data[((row + 1) * ANGLES + c) * 4] * f;
    return Math.min(radius(column), radius((column + 1) % ANGLES));
  }
  constrain(point: T.Vector3) {
    const radius = Math.hypot(point.x, point.z), above = point.y - this.release.x;
    if (above >= 0 && radius <= this.release.y + RELEASE_CURVE * above * above) return point;
    const limit = this.limit(point.x, point.y, point.z);
    if (radius > limit) { point.x *= limit / radius; point.z *= limit / radius; }
    return point;
  }
  /** Bake the same deformation into the full-detail PNG models before material batching. */
  bake(botanical: T.Group) {
    botanical.updateMatrixWorld(true);
    const point = new T.Vector3(), inverse = new T.Matrix4();
    botanical.traverse(object => {
      if (!(object instanceof T.Mesh) || object.userData.wrapperContact === false) return;
      // Prototypes and primitive geometries can be shared by many flowers or future exports.
      object.geometry = object.geometry.clone(); inverse.copy(object.matrixWorld).invert();
      const p = object.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        point.fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld); this.constrain(point); point.applyMatrix4(inverse);
        p.setXYZ(i, point.x, point.y, point.z);
      }
      object.geometry.computeVertexNormals(); object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere();
    });
  }
}

export function wrapperProfile(paper: T.Group) {
  let profile = profiles.get(paper.name);
  if (!profile) { profile = new WrapperProfile(paper); profiles.set(paper.name, profile); }
  return profile;
}

/** GPU vertex contacts keep edits and sway allocation-free; no per-frame mesh rebuilding. */
export class WrapperBoundary {
  profile?: WrapperProfile;
  private texture = new T.DataTexture(new Float32Array(ANGLES * ROWS * 4), ANGLES, ROWS, T.RGBAFormat, T.FloatType);
  private uniforms = { wrapperField: { value: this.texture }, wrapperRange: { value: new T.Vector2() }, wrapperRelease: { value: new T.Vector2() } };
  constructor() { this.texture.minFilter = this.texture.magFilter = T.NearestFilter; this.texture.generateMipmaps = false; }
  set(paper: T.Group) {
    this.profile = wrapperProfile(paper); this.texture.image.data = this.profile.data; this.texture.needsUpdate = true;
    this.uniforms.wrapperRange.value.set(this.profile.minY, 1 / this.profile.step);
    this.uniforms.wrapperRelease.value.copy(this.profile.release);
  }
  bind(botanical: T.Group) {
    botanical.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      object.userData.wrapperContact = true;
      const materials: T.Material[] = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material.customProgramCacheKey = () => 'wrapper-vertex-contact-v1';
        material.onBeforeCompile = shader => {
          Object.assign(shader.uniforms, this.uniforms);
          shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
uniform sampler2D wrapperField;
uniform vec2 wrapperRange;
uniform vec2 wrapperRelease;
vec3 wrapperContact(vec3 p) {
  float height = max(0.0, (p.y - wrapperRange.x) * wrapperRange.y);
  float radius = length(p.xz);
  if (height >= ${ROWS - 1}.0 || radius < 0.00001) return p;
  float above = p.y - wrapperRelease.x;
  if (above >= 0.0 && radius <= wrapperRelease.y + ${RELEASE_CURVE}.0 * above * above) return p;
  float row = min(${ROWS - 2}.0, floor(height));
  float column = floor(fract(atan(p.x, p.z) / 6.28318530718 + 1.0) * ${ANGLES}.0);
  float nextColumn = mod(column + 1.0, ${ANGLES}.0);
  vec2 lo = vec2((column + 0.5) / ${ANGLES}.0, (row + 0.5) / ${ROWS}.0);
  vec2 hi = vec2((nextColumn + 0.5) / ${ANGLES}.0, lo.y);
  float f = height - row;
  float a = mix(texture2D(wrapperField, lo).r, texture2D(wrapperField, lo + vec2(0.0, 1.0 / ${ROWS}.0)).r, f);
  float b = mix(texture2D(wrapperField, hi).r, texture2D(wrapperField, hi + vec2(0.0, 1.0 / ${ROWS}.0)).r, f);
  p.xz *= min(1.0, min(a, b) / max(radius, 0.00001));
  return p;
}`);
          shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition.xyz = wrapperContact(mvPosition.xyz);
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`);
          shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
#if defined(USE_ENVMAP) || defined(DISTANCE) || defined(USE_SHADOWMAP) || defined(USE_TRANSMISSION) || NUM_SPOT_LIGHT_COORDS > 0
  vec4 worldPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    worldPosition = instanceMatrix * worldPosition;
  #endif
  worldPosition.xyz = wrapperContact(worldPosition.xyz);
  worldPosition = modelMatrix * worldPosition;
#endif`);
        };
        material.needsUpdate = true;
      }
    });
  }
  dispose() { this.texture.dispose(); }
}
