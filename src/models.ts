import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type BouquetConfigV1 } from './config';
import { layout } from './layout';
import { wrapperProfile } from './containment';
import { stemBase } from './flowerArrangement';

type Vec = [number, number, number];
type Finish = 'petal' | 'leaf' | 'paper' | 'satin' | 'metal' | 'glass';
const TAU = Math.PI * 2;
let previewDetail = false;
const geometries = new Map<string, T.BufferGeometry>();
function cached(key: string, create: () => T.BufferGeometry) {
  if (!geometries.has(key)) geometries.set(key, create()); return geometries.get(key)!;
}
function tint(color: string, amount: number) { return `#${new T.Color(color).lerp(new T.Color(amount > 0 ? '#ffffff' : '#482738'), Math.abs(amount)).getHexString()}`; }
function material(color: string, finish: Finish) {
  return new T.MeshStandardMaterial({ color, side: T.DoubleSide,
    roughness: { petal: .63, leaf: .58, paper: .88, satin: .32, metal: .28, glass: .12 }[finish],
    metalness: finish === 'metal' ? .65 : finish === 'satin' ? .22 : 0,
    transparent: finish === 'glass', opacity: finish === 'glass' ? .27 : 1, depthWrite: finish !== 'glass' });
}
function add(g: T.Group, geometry: T.BufferGeometry, color: string, p: Vec = [0, 0, 0], scale: Vec = [1, 1, 1], rotation: Vec = [0, 0, 0], finish: Finish = 'petal') {
  const m = new T.Mesh(geometry, material(color, finish)); m.material.vertexColors = !!geometry.getAttribute('color');
  m.position.set(...p); m.scale.set(...scale); m.rotation.set(...rotation); g.add(m); return m;
}
function ball(g: T.Group, color: string, p: Vec, scale: Vec, finish: Finish = 'petal') {
  const small = Math.max(...scale) < .1;
  const key = small ? (previewDetail ? 'preview-seed' : 'seed') : (previewDetail ? 'preview-sphere' : 'sphere');
  const segments = small ? (previewDetail ? 4 : 5) : (previewDetail ? 10 : 16);
  const rows = small ? (previewDetail ? 2 : 3) : (previewDetail ? 7 : 12);
  return add(g, cached(key, () => new T.SphereGeometry(1, segments, rows)), color, p, scale, [0, 0, 0], finish);
}
function tube(g: T.Group, color: string, start: Vec, end: Vec, thickness = .012, finish: Finish = 'leaf') {
  const a = new T.Vector3(...start), b = new T.Vector3(...end), d = b.clone().sub(a);
  const long = d.length() > .3;
  const m = add(g, cached(long ? 'branch-stem' : 'stem', () => new T.CylinderGeometry(.8, 1, 1, 6, long ? 8 : 1)), color, a.add(b).multiplyScalar(.5).toArray() as Vec, [thickness, d.length(), thickness], [0, 0, 0], finish);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); return m;
}
function curve(g: T.Group, color: string, points: Vec[], radius = .01, finish: Finish = 'leaf', segments = 18) {
  return add(g, new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), segments, radius, 5, false), color, [0, 0, 0], [1, 1, 1], [0, 0, 0], finish);
}

// Thin cupped surfaces replace the old ellipsoid petals. Shared attributes allow batching.
function surface(uSteps: number, vSteps: number, point: (u: number, v: number) => Vec, shade?: (u: number, v: number) => number) {
  if (previewDetail) { const tiny = uSteps <= 4 && vSteps <= 4; uSteps = Math.max(3, Math.round(uSteps * .7)); vSteps = tiny ? 2 : Math.max(3, Math.round(vSteps * .7)); }
  const positions: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= uSteps; i++) for (let j = 0; j <= vSteps; j++) {
    const u = i / uSteps, v = j / vSteps, c = shade?.(u, v) ?? 1;
    positions.push(...point(u, v)); uv.push(u, v); colors.push(c, c, c);
    if (i < uSteps && j < vSteps) { const k = i * (vSteps + 1) + j; indices.push(k, k + vSteps + 1, k + 1, k + 1, k + vSteps + 1, k + vSteps + 2); }
  }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}
function petalGeometry(length: number, width: number, cup = .07, curl = 0, pointed = false, ruffle = 0, detail = 8) {
  return surface(detail, detail <= 4 ? 4 : 6, (u, v) => {
    const s = v * 2 - 1, profile = Math.pow(Math.sin(Math.PI * u), pointed ? 1 : .55);
    return [s * width * profile, length * u, cup * Math.sin(u * Math.PI * .85) + cup * s * s * profile + curl * u ** 4 + ruffle * Math.sin(v * Math.PI * 7 + u * 4) * u ** 3];
  }, (u, v) => (.7 + .3 * u) * (1 - .06 * Math.abs(v * 2 - 1)));
}
function petal(g: T.Group, color: string, length: number, width: number, angle: number, radius = 0, z = 0, cup = .07, curl = 0, pointed = false, ruffle = 0, detail = 8) {
  return add(g, petalGeometry(length, width, cup, curl, pointed, ruffle, detail), color, [Math.sin(angle) * radius, Math.cos(angle) * radius, z], [1, 1, 1], [0, 0, -angle]);
}
function leaf(g: T.Group, color: string, p: Vec, length: number, width: number, angle: number, twist = 0, lobed = false) {
  const geometry = lobed ? surface(10, 6, (u, v) => { const s = v * 2 - 1; return [s * width * Math.sin(Math.PI * u) ** .65 * (.7 + .3 * Math.cos(u * Math.PI * 6)), length * u, .045 * Math.sin(Math.PI * u) + .025 * Math.abs(s)]; }) : petalGeometry(length, width, .025, -.04, true);
  const group = new T.Group(); add(group, geometry, color, [0, 0, 0], [1, 1, 1], [0, 0, 0], 'leaf');
  curve(group, tint(color, .25), [[0, 0, .004], [0, length * .5, .031], [0, length, -.036]], .0025, 'leaf', 8);
  group.position.set(...p); group.rotation.set(.12, twist, angle); g.add(group); return group;
}
function emblem(kind: 'heart' | 'star' | 'sparkle') {
  return cached(kind, () => {
    const s = new T.Shape();
    if (kind === 'heart') { s.moveTo(0, -.8); s.bezierCurveTo(-.3, -.46, -1.05, .08, -.86, .57); s.bezierCurveTo(-.65, 1.03, -.12, .91, 0, .55); s.bezierCurveTo(.12, .91, .65, 1.03, .86, .57); s.bezierCurveTo(1.05, .08, .3, -.46, 0, -.8); }
    else { const points = kind === 'sparkle' ? 8 : 10; for (let i = 0; i < points; i++) { const a = Math.PI / 2 + i * TAU / points, r = i % 2 ? (kind === 'sparkle' ? .2 : .44) : 1; if (!i) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); }
    const geo = new T.ExtrudeGeometry(s, { depth: .06, bevelEnabled: true, bevelSize: .035, bevelThickness: .035, bevelSegments: 2, curveSegments: 12, steps: 1 }); geo.translate(0, 0, -.03); return geo;
  });
}
function face(g: T.Group, r: number, z = .08) {
  for (const s of [-1, 1]) { ball(g, '#553746', [s * r * .33, r * .16, z], [.013, .022, .009]); ball(g, '#df8e9e', [s * r * .56, -r * .07, z - .007], [.027, .013, .01]); }
  curve(g, '#553746', [[-r * .32, -r * .09, z], [0, -r * .3, z + .006], [r * .32, -r * .09, z]], .008, 'petal', 10);
}
function calyx(g: T.Group, radius = .09) {
  ball(g, '#527647', [0, 0, -.075], [radius, radius, .065], 'leaf');
  for (let i = 0; i < 5; i++) petal(g, '#638c52', .15, .026, i * TAU / 5, .025, -.085, -.03, -.04, true, 0, 4);
}
function pollen(g: T.Group, radius: number, count: number, color: string, depth: number) {
  if (previewDetail) count = Math.ceil(count * .65);
  ball(g, tint(color, -.2), [0, 0, depth - .018], [radius, radius, .052]);
  for (let i = 0; i < count; i++) { const r = radius * Math.sqrt((i + .4) / count), a = i * 2.399963; ball(g, i % 3 ? color : tint(color, .18), [Math.cos(a) * r, Math.sin(a) * r, depth + .035 * Math.sqrt(1 - (r / radius) ** 2)], [.012, .012, .012]); }
}
function rosePetal(g: T.Group, color: string, angle: number, radius: number, height: number, opening: number, z: number, ruffle = .008) {
  add(g, surface(8, 8, (u, v) => {
    const s = v * 2 - 1, a = angle + s * opening * .5 + .12 * u;
    const r = (radius * (.2 + .8 * Math.sin(u * Math.PI * .52)) + .027 * u ** 5) * (1 - .3 * s * s * u);
    return [Math.sin(a) * r, Math.cos(a) * r, z + height * u * (.66 + .34 * Math.sin(v * Math.PI) ** .6) - .038 * u ** 5 + ruffle * Math.sin(v * 17 + angle) * u ** 4];
  }, u => .76 + .24 * u), color);
}
export function flower(id: string, color: string) {
  const g = new T.Group(); g.name = id;
  if (!['lavender', 'heart-bloom', 'smiley-bloom'].includes(id)) calyx(g);
  switch (id) {
    case 'rose': {
      const layers = [{ n: 8, r: .31, h: .15, z: -.075 }, { n: 7, r: .245, h: .23, z: -.07 }, { n: 6, r: .17, h: .27, z: -.045 }, { n: 5, r: .105, h: .28, z: -.02 }, { n: 3, r: .052, h: .265, z: .015 }];
      layers.forEach((l, j) => { for (let i = 0; i < l.n; i++) rosePetal(g, tint(color, j === 0 ? .12 : -j * .015), i * TAU / l.n + j * .63, l.r, l.h, TAU / l.n * 1.55, l.z, .004); });
      add(g, surface(56, 4, (u, v) => { const a = u * TAU * 2.6, r = .007 + u * .062; return [Math.sin(a) * r, Math.cos(a) * r, .292 - u * .055 - (1 - v) * .075]; }), tint(color, -.08)); break;
    }
    case 'tulip':
      // Six overlapping tepals form a hollow goblet with an open, softly notched rim.
      for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3 + layer * Math.PI / 3;
        add(g, surface(12, 10, (u, v) => { const s = v * 2 - 1, theta = a + s * .84, r = .055 + .21 * Math.sin(u * Math.PI * .79) + layer * .009;
          return [Math.cos(theta) * r, Math.sin(theta) * r, -.13 + .54 * u - .055 * s * s * u ** 3 + .012 * Math.cos(s * TAU) * u ** 6];
        }, (u, v) => (.65 + .35 * u) * (.96 + .04 * Math.cos(v * TAU * 3))), tint(color, layer ? .06 : 0));
      }
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6, p: Vec = [Math.cos(a) * .052, Math.sin(a) * .052, .16]; tube(g, '#a3a357', [0, 0, -.07], p, .005); ball(g, '#71522e', p, [.013, .022, .012]); }
      ball(g, '#bec27b', [0, 0, .18], [.017, .017, .024]); break;
    case 'daisy':
    case 'smiley-bloom': {
      const smile = id === 'smiley-bloom', n = smile ? 13 : 21;
      for (let i = 0; i < n; i++) petal(g, i % 3 ? color : tint(color, .12), smile ? .245 : .255, smile ? .065 : .038, i * TAU / n, .073, -.015 + i % 2 * .014, .024, -.045);
      if (smile) { ball(g, '#f1c553', [0, 0, .022], [.143, .143, .05]); face(g, .143, .073); } else pollen(g, .092, 55, '#e8b746', .035); break;
    }
    case 'sunflower':
      for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 22; i++) petal(g, layer ? color : tint(color, -.12), .24 - layer * .025, .046, i * TAU / 22 + layer * .14, .125, -.035 + layer * .024, .025, -.065, true);
      pollen(g, .158, 140, '#78502c', .06);
      for (let i = 0; i < 44; i++) { const a = i * TAU / 44; ball(g, '#ba8439', [Math.cos(a) * .151, Math.sin(a) * .151, .068], [.009, .009, .012]); } break;
    case 'peony':
      for (let layer = 0; layer < 5; layer++) { const n = 10 + layer * 2; for (let i = 0; i < n; i++) rosePetal(g, tint(color, .14 - layer * .025), i * TAU / n + layer * .7, .34 - layer * .058, .17 + layer * .025, 1.12 - layer * .12, -.06 + layer * .022, .022); }
      for (let i = 0; i < 16; i++) { const a = i * 2.399; petal(g, tint(color, .08), .13, .045, a, .014, .24 + i % 3 * .012, .065, -.018, false, .016); }
      break;
    case 'lily':
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6; petal(g, i % 2 ? color : tint(color, .08), .45, i % 2 ? .10 : .13, a, .015, -.06, .135, -.2, true);
        petal(g, tint(color, -.18), .235, .012, a, .017, -.053, .115, -.08, true);
        for (let j = 0; j < 5; j++) { const r = .105 + j * .022, offset = j % 2 ? -.024 : .025; ball(g, '#b67b8b', [Math.sin(a) * r + Math.cos(a) * offset, Math.cos(a) * r - Math.sin(a) * offset, -.049 + .135 * Math.sin(r / .45 * Math.PI * .85)], [.004, .006, .003]); }
        const tip: Vec = [Math.sin(a) * .09, Math.cos(a) * .09, .235]; curve(g, '#99a067', [[0, 0, -.045], [tip[0] * .4, tip[1] * .4, .13], tip], .0045, 'leaf', 8);
        ball(g, '#a96732', tip, [.015, .035, .012]).rotation.z = -a;
      }
      tube(g, '#79965a', [0, 0, 0], [.016, -.015, .285], .006); ball(g, '#adc47f', [.016, -.015, .285], [.014, .014, .01]); break;
    case 'lavender':
      curve(g, '#638454', [[0, -.55, 0], [.018, -.1, 0], [0, .49, 0]], .009);
      for (let i = 0; i < 10; i++) for (let j = 0; j < 5; j++) {
        const a = j * TAU / 5 + i * .7, r = .073 * (1 - i * .065), floret = new T.Group();
        for (let k = 0; k < 3; k++) petal(floret, tint(color, i % 3 * .08), .063, .022, k * TAU / 3, .004, 0, .018, -.006, false, 0, 4);
        floret.position.set(Math.cos(a) * r, -.14 + i * .061, Math.sin(a) * r); floret.rotation.set(.5, a, -.3); g.add(floret);
      }
      for (const s of [-1, 1]) leaf(g, '#729369', [0, -.43, 0], .27, .018, s * .52); break;
    case 'hydrangea':
      for (let i = 0; i < 20; i++) {
        const z = 1 - (i + .5) / 20 * 1.4, a = i * 2.399963, r = Math.sqrt(1 - z * z), floret = new T.Group();
        for (let j = 0; j < 4; j++) petal(floret, tint(color, (i % 4) * .065), .105, .054, j * Math.PI / 2 + .2, .009, 0, .018, -.007, false, .003, 4);
        ball(floret, '#d7e2bc', [0, 0, .014], [.012, .012, .012]); floret.position.set(Math.cos(a) * r * .20, Math.sin(a) * r * .20, z * .20);
        floret.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(Math.cos(a) * r, Math.sin(a) * r, z)); g.add(floret);
      } break;
    case 'heart-bloom':
      add(g, emblem('heart'), color, [0, .015, 0], [.29, .31, .8], [0, 0, -.08], 'satin');
      curve(g, tint(color, .5), [[-.19, .12, .067], [-.18, .19, .067], [-.13, .21, .067]], .009, 'satin'); calyx(g, .05); break;
  }
  return g;
}

export function filler(id: string, color: string) {
  const g = new T.Group(); g.name = id;
  const green = ['eucalyptus', 'fern', 'ruscus', 'ivy', 'curly-grass'].includes(id) ? tint(color, -.16) : '#739065';
  if (id !== 'curly-grass') curve(g, green, [[0, -.62, 0], [.025, -.1, -.01], [0, .43, 0]], .009);
  switch (id) {
    case 'babys-breath':
      for (let i = 0; i < 7; i++) {
        const a = i * 2.399, x = Math.cos(a) * .21, y = .05 + i * .047, z = Math.sin(a) * .15;
        curve(g, green, [[0, -.35 + i * .035, 0], [x * .55, y - .12, z * .6], [x, y, z]], .004, 'leaf', 6);
        for (let j = 0; j < 3; j++) {
          const b = j * TAU / 3 + i, p: Vec = [x + Math.cos(b) * .075, y + .055 + j * .017, z + Math.sin(b) * .055]; tube(g, green, [x, y, z], p, .0028);
          const bloom = new T.Group();
          for (let k = 0; k < 5; k++) petal(bloom, color, .025, .015, k * TAU / 5, .003, 0, .007, 0, false, 0, 3);
          ball(bloom, '#c4b87e', [0, 0, .006], [.006, .006, .006]); bloom.position.set(...p); bloom.rotation.set(-.4, b, 0); g.add(bloom);
        }
      } break;
    case 'eucalyptus':
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
        const size = .2 - i * .016;
        const geo = surface(6, 12, (u, v) => { const a = v * TAU, r = Math.sin(u * Math.PI / 2); return [Math.cos(a) * size * r * .65, size * .47 + Math.sin(a) * size * r * .54, .024 * (1 - r * r) + .009 * Math.sin(a * 2)]; });
        add(g, geo, tint(color, i % 2 * .09), [s * .025, -.4 + i * .135, 0], [1, 1, 1], [.2 + i * .09, s * .36, s * -.96], 'leaf');
      } break;
    case 'fern':
      for (let i = 0; i < 12; i++) for (const s of [-1, 1]) leaf(g, tint(color, i % 3 * .055), [.015, -.43 + i * .072, 0], .26 * Math.sin((i + 2) / 15 * Math.PI) * (1 - i * .025), .023, s * -1.06, s * .15, true);
      leaf(g, color, [0, .35, 0], .14, .02, 0); break;
    case 'ruscus':
      for (let i = 0; i < 7; i++) { const s = i % 2 ? 1 : -1, y = -.4 + i * .12; tube(g, green, [0, y, 0], [s * .075, y + .045, 0], .005); leaf(g, tint(color, i % 2 * .07), [s * .075, y + .045, 0], .225 - i * .01, .07, s * -.9, s * .25); } break;
    case 'ivy':
      for (let i = 0; i < 6; i++) {
        const s = i % 2 ? 1 : -1, y = -.44 + i * .15; tube(g, green, [0, y, 0], [s * .12, y + .025, .015], .004);
        const l = leaf(g, tint(color, i % 2 * .09), [s * .12, y + .025, .015], .22, .13, s * -.9, .2, true);
        for (const sign of [-1, 1]) curve(l, tint(color, .28), [[0, .02, .014], [sign * .055, .08, .05], [sign * .085, .11, .045]], .002, 'leaf', 5);
      } break;
    case 'wheat':
      for (let i = 0; i < 9; i++) for (const s of [-1, 1]) { const y = -.12 + i * .065, x = s * (.035 - i * .002); ball(g, tint(color, i % 2 * .12), [x, y, .005], [.026, .055, .023]).rotation.z = s * -.43; curve(g, tint(color, .12), [[x, y, 0], [x + s * .04, y + .1, 0], [x + s * .07, y + .21, -.015]], .0018, 'leaf', 6); } break;
    case 'berries':
      for (let i = 0; i < 11; i++) { const a = i * 2.399, p: Vec = [Math.cos(a) * .18, -.12 + i * .045, Math.sin(a) * .12]; curve(g, '#866a53', [[0, -.27, 0], [p[0] * .5, p[1] - .06, p[2] * .5], p], .006, 'leaf', 7); ball(g, tint(color, i % 3 * .055), p, [.058, .064, .058], 'satin'); ball(g, '#77534c', [p[0], p[1] + .061, p[2]], [.015, .008, .015]); }
      leaf(g, '#6b8755', [0, -.27, 0], .25, .06, -.8); break;
    case 'bunny-tails':
      for (const s of [-1, 0, 1]) {
        const y = s ? .1 : .3, x = s * .15; curve(g, '#a89f70', [[0, -.62, 0], [x * .5, -.18, 0], [x, y, 0]], .005); ball(g, color, [x, y, 0], [.065, .155, .062]);
        for (let i = 0; i < 65; i++) { const a = i * 2.399, t = (i + .5) / 65 * 2 - 1, r = Math.sqrt(1 - t * t); tube(g, tint(color, .18), [x + Math.cos(a) * r * .053, y + t * .142, Math.sin(a) * r * .052], [x + Math.cos(a) * r * .079, y + t * .166 + .015, Math.sin(a) * r * .078], .0018, 'petal'); }
      } break;
    case 'curly-grass':
      for (let j = 0; j < 5; j++) add(g, surface(24, 2, (u, v) => { const a = u * 5.7 + j * 1.4, r = .025 + u * .15; return [Math.sin(a) * r + (v - .5) * .025 * (1 - u), -.63 + u * 1.23 - .13 * u ** 5, Math.cos(a) * r]; }), tint(color, j % 2 * .1), [0, 0, 0], [1, 1, 1], [0, 0, 0], 'leaf'); break;
    case 'star-picks':
      for (const [x, y, a] of [[-.17, .19, -.2], [.13, .42, .2]]) { tube(g, '#b69b60', [0, -.62, 0], [x, y, 0], .006, 'metal'); add(g, emblem('star'), color, [x, y, 0], [.13, .13, .35], [0, .16, a], 'metal'); add(g, emblem('star'), tint(color, .4), [x, y, .026], [.071, .071, .12], [0, .16, a], 'metal'); } break;
  }
  return g;
}

interface WrapSheet {
  angle: number; span: number; top: number; slope?: number; offset?: number;
  curl?: number; scallops?: number; pleats?: number; tissue?: number; facets?: boolean; petal?: boolean;
}
// The waist stays at ribbon height. Each sheet has its own diagonal edge and a short folded skirt.
function wrapPoint(sheet: WrapSheet, u: number, v: number): Vec {
  const s = v * 2 - 1, a = sheet.angle + (v - .5) * sheet.span;
  const pleat = sheet.pleats ? 1 - 4 * Math.abs(((v * sheet.pleats) % 1) - .5) : 0;
  const scallop = sheet.scallops ? Math.cos(v * TAU * sheet.scallops) * .055 : 0;
  const tissue = sheet.tissue ?? 0;
  const edge = sheet.top + (sheet.slope ?? 0) * s + scallop
    + (sheet.petal ? .22 * Math.sin(v * Math.PI) ** 1.4 : .04 * Math.sin(v * Math.PI))
    + tissue * Math.sin(v * TAU * 4.5 + sheet.angle);
  const y = -1.43 + (edge + 1.43) * u;
  const aboveTie = Math.max(0, (y + .62) / 1.48), belowTie = Math.max(0, (y + 1.43) / .81);
  const r = y < -.62 ? .20 + .14 * belowTie + .055 * Math.sin(belowTie * Math.PI) : .34 + .76 * aboveTie ** .74;
  const gather = Math.sin(a * 7 + .4) * .018 * Math.exp(-(((y + .62) / .24) ** 2));
  const wrinkle = tissue * Math.sin(v * TAU * 6 + u * 3) * Math.max(0, (u - .42) / .58) ** 1.8;
  const radial = r + (sheet.offset ?? 0) * Math.max(.15, aboveTie) + gather
    + pleat * .065 * Math.max(.1, aboveTie) + wrinkle + (sheet.curl ?? .025) * u ** 14;
  return [Math.sin(a) * radial, y - (sheet.curl ?? .025) * .55 * u ** 14, Math.cos(a) * radial * .96];
}
function wrapSheet(g: T.Group, color: string, sheet: WrapSheet, finish: Finish = 'paper') {
  const segments = sheet.facets ? 6 : sheet.pleats ? sheet.pleats * 8 : 32;
  const wall = add(g, surface(14, segments, (u, v) => wrapPoint(sheet, u, v), (u, v) => {
    const crease = sheet.pleats ? Math.cos(v * TAU * sheet.pleats) * .045 : Math.cos(v * Math.PI * 3 + sheet.angle) * .025;
    return .91 + .09 * u + crease * Math.sin(u * Math.PI);
  }), color, [0, 0, 0], [1, 1, 1], [0, 0, 0], finish);
  wall.userData.wrapperWall = true;
  // A narrow turned-over hem gives paper thickness without a heavy extruded shell.
  const hem = add(g, surface(2, segments, (u, v) => {
    const p = wrapPoint(sheet, .974 + u * .026, v), a = sheet.angle + (v - .5) * sheet.span;
    p[0] += Math.sin(a) * .006; p[2] += Math.cos(a) * .006; return p;
  }), tint(color, .14), [0, 0, 0], [1, 1, 1], [0, 0, 0], finish);
  hem.userData.wrapperWall = true;
}
function floristSheets(g: T.Group, color: string, options: Partial<WrapSheet> & { lift?: number } = {}, finish: Finish = 'paper') {
  const { lift = 0, ...shape } = options;
  // Raised back, opened sides, then a low diagonal crossover at the front.
  wrapSheet(g, tint(color, .18), { angle: Math.PI, span: 3.5, top: .86 + lift, slope: -.1, ...shape }, finish);
  wrapSheet(g, color, { angle: -1.10, span: 2.1, top: .55 + lift, slope: -.32, offset: .026, ...shape }, finish);
  wrapSheet(g, tint(color, .06), { angle: 1.08, span: 2.1, top: .48 + lift, slope: .30, offset: .052, ...shape }, finish);
  wrapSheet(g, color, { angle: .13, span: 2.12, top: .14 + lift, slope: -.33, offset: .074, ...shape }, finish);
}
export function wrapper(id: string, color: string) {
  const g = new T.Group(); g.name = id; const light = tint(color, .36), dark = tint(color, -.12);
  if (id === 'gift-bag') {
    const bagPoint = (u: number, v: number): Vec => {
      const a = v * TAU, sx = Math.sin(a), sz = Math.cos(a), width = .63 + .11 * u ** 3, depth = .44 + .17 * u ** 3;
      return [Math.sign(sx) * Math.abs(sx) ** .34 * width, -1.43 + u * 1.75, Math.sign(sz) * Math.abs(sz) ** .34 * depth];
    };
    const wall = add(g, surface(12, 64, bagPoint, (u, v) => .88 + .1 * u + .025 * Math.cos(v * TAU * 4)), color, [0, 0, 0], [1, 1, 1], [0, 0, 0], 'paper');
    const hem = add(g, surface(2, 64, (u, v) => { const p = bagPoint(.966 + u * .034, v); p[0] *= 1.005; p[2] *= 1.008; return p; }), light, [0, 0, 0], [1, 1, 1], [0, 0, 0], 'paper');
    wall.userData.wrapperWall = hem.userData.wrapperWall = true;
    add(g, new T.BoxGeometry(1.19, .018, .8), dark, [0, -1.43, 0], [1, 1, 1], [0, 0, 0], 'paper');
    for (const z of [-.585, .585]) {
      curve(g, dark, [[-.29, .24, z], [-.30, .58, z], [0, .72, z], [.30, .58, z], [.29, .24, z]], .013, 'paper', 24);
      for (const x of [-.29, .29]) ball(g, tint(color, -.22), [x, .24, z], [.022, .025, .007], 'paper');
    }
    // Only the upper tissue emerges from the opening; it never penetrates the bag walls.
    for (let i = 0; i < 3; i++) {
      const sheet: WrapSheet = { angle: Math.PI + i * 2.15, span: 2.65, top: .45 + i * .045, tissue: .065, curl: .06 };
      add(g, surface(8, 24, (u, v) => {
        const a = sheet.angle + (v - .5) * sheet.span, r = .46 + u * .35 + .04 * Math.sin(v * TAU * 4) * u;
        return [Math.sin(a) * r, .30 + u * (.38 + .1 * Math.sin(v * TAU * 3 + i)), Math.cos(a) * r * .72];
      }, u => .9 + .1 * u), light, [0, 0, 0], [1, 1, 1], [0, 0, 0], 'paper');
    }
  } else if (id === 'double-cone') {
    floristSheets(g, light, { lift: .13, offset: -.035, curl: .045 });
    floristSheets(g, color, { curl: .04 });
  } else if (id === 'ruffled') {
    for (let layer = 0; layer < 3; layer++) floristSheets(g, tint(color, .15 + layer * .1), { offset: -.05 + layer * .048, lift: -.1 + layer * .09, tissue: .038 + layer * .012, curl: .075 });
  } else if (id === 'pleated') {
    wrapSheet(g, light, { angle: Math.PI, span: 3.95, top: .91, slope: -.05, pleats: 9, curl: .016 });
    wrapSheet(g, color, { angle: 0, span: 3.0, top: .11, slope: -.28, curl: .035 });
  } else if (id === 'origami') {
    floristSheets(g, color, { facets: true, curl: 0 });
    wrapSheet(g, light, { angle: -.38, span: 1.52, top: .02, slope: .38, offset: .1, facets: true, curl: 0 });
  } else if (id === 'petal-collar') {
    for (let i = 0; i < 7; i++) wrapSheet(g, tint(color, i % 2 ? .16 : .02), { angle: i * TAU / 7, span: TAU / 7 + .28, top: .45 - .17 * Math.cos(i * TAU / 7), offset: i % 2 * .038, petal: true, curl: .085 });
  } else if (id === 'frosted') {
    // An opaque inner paper wrap and a restrained translucent sleeve keep it readable at low quality.
    floristSheets(g, light, { lift: -.2, offset: -.04, curl: .018 });
    floristSheets(g, color, { lift: .02, offset: .09, curl: .035 }, 'glass');
  } else {
    floristSheets(g, color, { scallops: id === 'scalloped' ? 4 : id === 'heart-collar' ? 3 : 0, curl: id === 'scalloped' ? .055 : .035 });
    if (id === 'heart-collar') for (const a of [-1.1, -.58, .05, .67, 1.15]) {
      const sheet: WrapSheet = { angle: .13, span: 2.12, top: .14, slope: -.33, offset: .074, scallops: 3, curl: .035 };
      const v = Math.max(.02, Math.min(.98, .5 + (a - sheet.angle) / sheet.span)), p = wrapPoint(sheet, .89, v);
      add(g, emblem('heart'), tint(color, -.19), [p[0] * 1.008, p[1] - .005, p[2] * 1.008], [.068, .072, .045], [0, a, -.08], 'paper');
    }
  }
  return g;
}

export function fitRibbon(bow: T.Group, wrapperId: string) {
  const bag = wrapperId === 'gift-bag';
  bow.position.set(0, -.62, bag ? .55 : .42);
  bow.scale.set(bag ? 1.45 : .85, 1, bag ? 1.06 : .85);
  // Center the belt on the wrapper, independently of the bow's projecting loops.
  bow.children[0].position.z = .5 - bow.position.z / bow.scale.z;
  return bow;
}

function strip(g: T.Group, color: string, points: Vec[], width: number, twist = 0, fork = false) {
  const path = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
  return add(g, surface(24, 4, (u, v) => {
    const t = fork ? u - .045 * (1 - Math.abs(v * 2 - 1)) * u ** 14 : u, p = path.getPoint(t), tangent = path.getTangent(t);
    const normal = new T.Vector3(-tangent.y, tangent.x, 0).normalize(); normal.applyAxisAngle(tangent, Math.sin(u * Math.PI) * twist);
    p.addScaledVector(normal, (v - .5) * width * (.76 + .24 * Math.sin(u * Math.PI))); p.z += .015 * Math.sin(v * Math.PI); return p.toArray() as Vec;
  }), color, [0, 0, 0], [1, 1, 1], [0, 0, 0], 'satin');
}
function bowLoop(g: T.Group, color: string, sign: number, scale = 1, y = 0, cord = false) {
  const points: Vec[] = [[sign * .018, y, .085], [sign * .19 * scale, y + .16 * scale, .01], [sign * .38 * scale, y + .13 * scale, .04], [sign * .32 * scale, y - .015, .15], [sign * .05, y - .022, .1]];
  if (cord) curve(g, color, points, .009, 'paper', 24); else strip(g, color, points, .105 * scale, .65 * sign);
}
function ribbonTail(g: T.Group, color: string, sign: number, length = .49) { strip(g, color, [[sign * .025, 0, .04], [sign * .12, -.15, .12], [sign * .14, -length * .65, .09], [sign * .24, -length, .12]], .14, sign * .6, true); }
export function ribbon(id: string, color: string) {
  const g = new T.Group(); g.name = id;
  add(g, surface(56, 3, (u, v) => { const a = u * TAU; return [Math.sin(a) * .49, (v - .5) * (id === 'twine' ? .018 : .095), -.5 + Math.cos(a) * .49]; }), color, [0, 0, 0], [1, 1, 1], [0, 0, 0], id === 'twine' ? 'paper' : 'satin');
  if (id === 'satin-sash') { strip(g, color, [[-.26, .17, -.03], [-.08, .03, .08], [.08, -.19, .15], [.17, -.58, .1]], .24, .4, true); strip(g, tint(color, .13), [[.05, .02, .08], [-.13, -.15, .11], [-.19, -.37, .05]], .15, -.35, true); }
  else if (id === 'twine') { bowLoop(g, color, -1, .78, 0, true); bowLoop(g, color, 1, .78, 0, true); for (const s of [-1, 1]) curve(g, color, [[s * .02, 0, .09], [s * .1, -.17, .05], [s * .17, -.4, .09]], .009, 'paper'); ball(g, color, [0, 0, .09], [.03, .035, .025], 'paper'); }
  else if (id === 'rosette') { for (let i = 0; i < 12; i++) rosePetal(g, color, i * 2.399, .055 + i * .009, .07, 1.5, .07); ribbonTail(g, color, -1); ribbonTail(g, color, 1, .4); }
  else if (id === 'curly') { for (let j = 0; j < 4; j++) { const points: Vec[] = Array.from({ length: 40 }, (_, i) => { const t = i / 39; return [(j - 1.5) * .085 + Math.sin(t * 15 + j) * (.03 + t * .035), -t * (.56 + j * .045), .07 + Math.cos(t * 15 + j) * .075]; }); strip(g, j % 2 ? tint(color, .18) : color, points, .036, .2); } bowLoop(g, color, -1, .5); bowLoop(g, color, 1, .5); }
  else {
    for (const s of [-1, 1]) { bowLoop(g, color, s, id === 'butterfly-bow' ? 1.25 : 1); if (id === 'double-bow' || id === 'butterfly-bow') bowLoop(g, tint(color, .12), s, .7, -.08); ribbonTail(g, color, s, id === 'long-tail' ? (s < 0 ? .88 : .76) : s < 0 ? .48 : .41); }
    if (id === 'heart-knot' || id === 'star-knot') add(g, emblem(id === 'heart-knot' ? 'heart' : 'star'), tint(color, .08), [0, .01, .16], [.095, .095, .25], [0, 0, 0], id === 'star-knot' ? 'metal' : 'satin');
    else add(g, new T.SphereGeometry(1, 16, 10), color, [0, .005, .13], [.059, .071, .042], [0, .2, -.12], 'satin');
  }
  return g;
}

export function effectModel(id: string, color: string) {
  const g = new T.Group(); g.name = id;
  if (id === 'hearts') add(g, emblem('heart'), color, [0, 0, 0], [.115, .115, .35], [0, .12, -.12], 'satin');
  else if (id === 'sparkles') { add(g, emblem('sparkle'), color, [0, 0, 0], [.13, .17, .16], [0, 0, 0], 'metal'); add(g, emblem('sparkle'), tint(color, .35), [.13, .11, 0], [.045, .06, .12], [0, 0, .15], 'metal'); }
  else if (id === 'starburst') { add(g, emblem('star'), color, [0, 0, 0], [.095, .095, .25], [0, 0, .2], 'metal'); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; tube(g, tint(color, .22), [Math.cos(a) * .125, Math.sin(a) * .125, 0], [Math.cos(a) * .18, Math.sin(a) * .18, 0], .005, 'metal'); } }
  else if (id === 'bubbles') { ball(g, color, [0, 0, 0], [.14, .14, .14], 'glass'); curve(g, '#fff8ff', [[-.105, .02, .085], [-.086, .075, .084], [-.035, .109, .08]], .007, 'satin', 12); curve(g, tint(color, .2), [[.098, -.035, .089], [.071, -.088, .08], [.026, -.108, .081]], .003, 'satin', 10); }
  else if (id === 'petals') { petal(g, color, .19, .076, .6, 0, 0, .055, -.03, false, .007); g.position.y = -.08; }
  else if (id === 'fireflies') {
    const m = ball(g, '#ffe5a0', [0, 0, 0], [.028, .028, .028]);
    m.material.emissive.set('#ffce6e'); m.material.emissiveIntensity = 1.6;
    add(g, emblem('sparkle'), '#f8d68c', [.055, .035, 0], [.025, .034, .08], [0, 0, .2], 'metal');
  }
  else if (id === 'butterflies') {
    for (const s of [-1, 1]) {
      const wing = new T.Group(); wing.name = s < 0 ? 'left-wing' : 'right-wing'; petal(wing, color, .19, .079, s * .95, 0, 0, .025, -.01); petal(wing, tint(color, -.12), .13, .063, s * 2.05, 0, -.005, .02);
      curve(wing, tint(color, -.3), [[0, 0, .01], [s * .07, .055, .025], [s * .13, .098, .013]], .003, 'petal', 7);
      for (let i = 0; i < 3; i++) ball(wing, '#f6eaca', [s * (.105 + i * .014), .055 + i * .022, .025], [.007, .01, .004]); wing.rotation.y = s * -.4; g.add(wing);
      curve(g, '#51423f', [[s * .008, .06, .018], [s * .025, .094, .019], [s * .04, .099, .017]], .0025, 'leaf', 6);
    }
    ball(g, '#51423f', [0, 0, .012], [.012, .077, .013]);
  } else if (id === 'confetti') { strip(g, color, [[-.055, -.06, 0], [0, 0, .025], [.02, .07, -.008]], .053, 1); add(g, emblem('sparkle'), '#e4bd73', [.075, .06, -.008], [.033, .033, .1], [0, 0, .2], 'metal'); }
  else if (id === 'happy-faces') { ball(g, '#f2c750', [0, 0, 0], [.13, .13, .054], 'satin'); face(g, .14, .056); }
  else if (id === 'rainbow') { ['#dea2b6', '#eac39a', '#eddb97', '#b4cfb4', '#adc5dd', '#c6b4d7'].forEach((c, i) => add(g, new T.TorusGeometry(1.9 + i * .071, .032, 6, 56, Math.PI), c, [0, -.2, -.7], [1, 1, 1], [0, 0, 0], 'satin')); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) ball(g, '#faf3ef', [s * (1.95 + i * .105), -.2 + (i === 1 ? .045 : 0), -.69], [.14, .10 + (i === 1 ? .035 : 0), .075]); }
  return g;
}

// Bake color into vertices while preserving satin, paper, foliage, alpha and emission.
export function mergeModel(source: T.Group) {
  source.updateMatrixWorld(true);
  const buckets = new Map<string, { material: T.MeshStandardMaterial; parts: T.BufferGeometry[] }>();
  const originals = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
  source.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const m = object.material as T.MeshStandardMaterial;
    const key = [m.roughness, m.metalness, m.opacity, m.transparent, m.depthWrite, m.emissive.getHex(), m.emissiveIntensity, !!object.geometry.index].join(':');
    if (!buckets.has(key)) { const baked = m.clone(); baked.color.set('#ffffff'); baked.vertexColors = true; buckets.set(key, { material: baked, parts: [] }); }
    const geo = object.geometry.clone(); geo.applyMatrix4(object.matrixWorld);
    const p = geo.getAttribute('position'), previous = geo.getAttribute('color'), colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { colors[i * 3] = m.color.r * (previous ? previous.getX(i) : 1); colors[i * 3 + 1] = m.color.g * (previous ? previous.getY(i) : 1); colors[i * 3 + 2] = m.color.b * (previous ? previous.getZ(i) : 1); }
    geo.setAttribute('color', new T.BufferAttribute(colors, 3)); buckets.get(key)!.parts.push(geo); originals.add(object.geometry); materials.add(m);
  });
  const result = new T.Group();
  for (const { material: m, parts } of buckets.values()) { const merged = mergeGeometries(parts); if (!merged) { parts.forEach(p => p.dispose()); m.dispose(); throw new Error('Incompatible procedural model attributes'); } result.add(new T.Mesh(merged, m)); parts.forEach(p => p.dispose()); }
  materials.forEach(m => m.dispose()); const shared = new Set(geometries.values()); originals.forEach(g => { if (!shared.has(g)) g.dispose(); }); return result;
}
export function disposeModel(model: T.Group) { model.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); (o.material as T.Material).dispose(); } }); }

/** Lower subdivision for the interactive viewport; PNG exports retain the full models. */
export function previewModel(category: 'flowers' | 'fillers', id: string, color: string) {
  previewDetail = true;
  try { return mergeModel(category === 'flowers' ? flower(id, color) : filler(id, color)); }
  finally { previewDetail = false; }
}
export function stemLeaf(tulip: boolean) {
  const g = new T.Group();
  leaf(g, '#6d925d', [0, 0, 0], tulip ? .53 : .31, tulip ? .06 : .085, -.65);
  return mergeModel(g);
}
export function buildBouquet(config: BouquetConfigV1, placed = layout(config)) {
  const g = new T.Group(), prototypes = new Map<string, T.Group>(), paper = wrapper(config.wrapper.id, config.wrapper.color);
  const boundary = wrapperProfile(paper);
  for (const [category, entries] of [['flowers', placed.flowers], ['fillers', placed.fillers]] as const) entries.forEach(p => {
    const [x, y, z] = p.position, upright = category === 'flowers' && p.id === 'lavender';
    const normal = new T.Vector3(x * .43, p.id === 'tulip' ? .95 : .62, z * .43 + (p.id === 'tulip' ? .28 : .55)).normalize();
    const end: Vec = category === 'flowers' && !upright ? [x - normal.x * .08, y - normal.y * .08, z - normal.z * .08] : [x, y - .45 * p.scale, z];
    const base: Vec = [x * .07, stemBase(config), z * .07];
    curve(g, '#638450', [base, [x * .54, .2, z * .54], end], .011, 'leaf', 32);
    if (category === 'flowers') {
      const custom = config.arrangement && (config.arrangement.edits.length || config.arrangement.profile === 'stepped' || config.arrangement.showStems);
      const attachment = custom ? new T.Vector3(...base).lerp(new T.Vector3(...end), .73).toArray() as Vec : [x * .72, .62, z * .72] as Vec;
      leaf(g, '#6d925d', attachment, (p.id === 'tulip' ? .53 : .31) * (custom ? p.scale : 1), (p.id === 'tulip' ? .06 : .085) * (custom ? p.scale : 1), (x > 0 ? -1 : 1) * .65, p.turn);
    }
    const key = `${category}:${p.id}:${p.color}`;
    if (!prototypes.has(key)) prototypes.set(key, category === 'flowers' ? flower(p.id, p.color) : filler(p.id, p.color));
    const model = prototypes.get(key)!.clone(); model.position.set(x, y, z); model.scale.setScalar(p.scale);
    if (category === 'flowers' && !upright) model.traverse(o => { if (o instanceof T.Mesh) o.userData.wrapperContact = false; });
    if (category === 'flowers' && !upright) { model.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), normal); model.rotateZ(p.turn * .2); }
    else { model.rotation.y = p.turn; model.rotation.z = -x * .18; } g.add(model);
  });
  boundary.bake(g);
  g.add(paper); g.add(fitRibbon(ribbon(config.ribbon.id, config.ribbon.color), config.wrapper.id)); return mergeModel(g);
}
