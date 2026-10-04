import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

import { giftAssets, isFrame, frameShape, frameOrientation, type FrameOrientation, type GiftAssetId } from './giftCatalog';
export { giftAssets, type GiftAssetId } from './giftCatalog';
type Vec = [number, number, number];
type Finish = 'plush' | 'cream' | 'dark' | 'pink' | 'satin' | 'foil' | 'seam' | 'wood' | 'back' | 'gold' | 'paper';
export interface GiftModelOptions { color?: string; photo?: T.Texture; frameOrientation?: FrameOrientation; }

// Each factory owns its geometries/materials. No global texture, renderer or cache.
class Builder {
  group = new T.Group();
  materials = new Map<string, T.MeshStandardMaterial>();
  mat(color: string, finish: Finish) {
    const key = `${finish}:${color}`;
    if (!this.materials.has(key)) this.materials.set(key, new T.MeshStandardMaterial({
      name: key, color, vertexColors: true, side: T.DoubleSide,
      roughness: { plush: .9, cream: .88, dark: .22, pink: .78, satin: .38, foil: .25, seam: .42, wood: .62, back: .96, gold: .3, paper: .97 }[finish],
      metalness: finish === 'foil' ? .64 : finish === 'gold' ? .7 : finish === 'satin' ? .12 : 0,
    }));
    return this.materials.get(key)!;
  }
  add(geometry: T.BufferGeometry, color: string, finish: Finish, p: Vec = [0, 0, 0], scale: Vec = [1, 1, 1], rotation: Vec = [0, 0, 0], parent = this.group, name = '') {
    if (!geometry.getAttribute('color')) {
      const values = new Float32Array(geometry.getAttribute('position').count * 3); values.fill(1);
      geometry.setAttribute('color', new T.BufferAttribute(values, 3));
    }
    const mesh = new T.Mesh(geometry, this.mat(color, finish));
    mesh.position.set(...p); mesh.scale.set(...scale); mesh.rotation.set(...rotation);
    mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  oval(color: string, finish: Finish, p: Vec, scale: Vec, rotation: Vec = [0, 0, 0], parent = this.group) {
    const small = Math.max(...scale) < .065;
    const geometry = new T.SphereGeometry(1, small ? 16 : 32, small ? 12 : 24);
    const pos = geometry.getAttribute('position'), colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = Math.sin(x * 47 + y * 23 + z * 11) * Math.sin(z * 41 - y * 39);
      const shade = finish === 'plush' ? .96 + .025 * n : 1;
      colors.push(shade, shade, shade);
    }
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    return this.add(geometry, color, finish, p, scale, rotation, parent);
  }
  line(color: string, finish: Finish, points: Vec[], radius: number, parent = this.group, name = '') {
    return this.add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 28, radius, 6, false), color, finish, [0, 0, 0], [1, 1, 1], [0, 0, 0], parent, name);
  }
  box(color: string, finish: Finish, p: Vec, size: Vec, radius = .012, parent = this.group, name = '') {
    const geometry = new RoundedBoxGeometry(...size, 3, radius);
    if (finish === 'wood') {
      const pos = geometry.getAttribute('position'), colors: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        const grain = .88 + .1 * Math.sin((pos.getX(i) + .005 * Math.sin(pos.getY(i) * 12)) * 190) ** 2;
        colors.push(grain, grain, grain);
      }
      geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    }
    return this.add(geometry, color, finish, p, [1, 1, 1], [0, 0, 0], parent, name);
  }
}

function skin(uSteps: number, vSteps: number, point: (u: number, v: number) => Vec) {
  const pos: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= uSteps; i++) for (let j = 0; j <= vSteps; j++) {
    pos.push(...point(i / uSteps, j / vSteps)); uv.push(i / uSteps, j / vSteps);
    if (i < uSteps && j < vSteps) { const k = i * (vSteps + 1) + j; indices.push(k, k + 1, k + vSteps + 1, k + 1, k + vSteps + 2, k + vSteps + 1); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
function eyes(b: Builder, x: number, y: number, z: number, size: number, parent = b.group, iris?: string) {
  for (const s of [-1, 1]) {
    if (iris) b.oval(iris, 'dark', [s * x, y, z - .005], [size * 1.2, size * 1.35, size * .65], [0, s * .12, 0], parent);
    b.oval('#332a27', 'dark', [s * x, y, z + .01], [size * (iris ? .67 : 1), size * 1.12, size * .56], [0, s * .12, 0], parent);
    b.oval('#fff9ed', 'dark', [s * x - size * .23, y + size * .35, z + size * .57], [size * .24, size * .24, size * .12], [0, 0, 0], parent);
    b.oval('#fff9ed', 'dark', [s * x + size * .26, y - size * .27, z + size * .55], [size * .10, size * .10, size * .09], [0, 0, 0], parent);
  }
}
function bow(b: Builder, p: Vec, color: string, size = 1) {
  const parent = new T.Group(); parent.position.set(...p); parent.scale.setScalar(size); b.group.add(parent);
  for (const s of [-1, 1]) {
    b.add(skin(18, 8, (u, v) => {
      const w = Math.sin(u * Math.PI) ** .65;
      return [s * (.015 + .18 * u), (v * 2 - 1) * .09 * w, .025 + .04 * Math.sin(u * Math.PI) + .015 * Math.cos(v * Math.PI * 2) * w];
    }), color, 'satin', [0, 0, 0], [1, 1, 1], [0, 0, s * -.1], parent);
    b.add(skin(12, 6, (u, v) => [s * (.015 + .08 * u) + (v * 2 - 1) * .038, -.025 - .15 * u + .018 * v * u ** 4, .018 + .027 * Math.sin(u * Math.PI)]), color, 'satin', [0, 0, 0], [1, 1, 1], [0, 0, 0], parent);
  }
  b.oval(color, 'satin', [0, 0, .05], [.04, .052, .037], [0, 0, -.16], parent);
}
function teddy(b: Builder, color: string) {
  b.oval(color, 'plush', [0, .56, -.01], [.30, .40, .25]);
  b.oval('#f6e8d2', 'cream', [0, .52, .217], [.205, .27, .046]);
  b.oval(color, 'plush', [0, 1.10, 0], [.37, .33, .29]);
  for (const s of [-1, 1]) {
    b.oval(color, 'plush', [s * .29, 1.37, -.025], [.15, .15, .095]);
    b.oval('#bfa07c', 'cream', [s * .29, 1.38, .056], [.09, .093, .022]);
    b.oval(color, 'plush', [s * .30, .63, .016], [.13, .25, .14], [0, 0, s * .32]);
    b.oval(color, 'plush', [s * .245, .175, .20], [.195, .175, .24], [-.10, s * .12, s * -.10]);
    b.oval('#bfa07c', 'cream', [s * .25, .18, .416], [.126, .126, .027], [-.12, 0, s * -.10]);
    b.oval('#977655', 'cream', [s * .25, .14, .444], [.052, .04, .010]);
    for (let i = 0; i < 3; i++) b.oval('#977655', 'cream', [s * .25 + (i - 1) * .047, .217 + (i === 1 ? .018 : 0), .445], [.019, .025, .01]);
  }
  b.oval('#f6e8d2', 'cream', [0, 1.018, .270], [.197, .13, .095]);
  eyes(b, .135, 1.147, .269, .034);
  b.oval('#674e3e', 'dark', [0, 1.059, .359], [.049, .036, .023]);
  b.line('#795b49', 'cream', [[0, 1.043, .377], [0, 1.002, .366], [0, .978, .359]], .006);
  b.line('#795b49', 'cream', [[-.09, 1.00, .351], [-.065, .975, .357], [0, .969, .36], [.065, .975, .357], [.09, 1.0, .351]], .0055);
  b.line('#c0a88c', 'cream', [[0, .30, .252], [0, .40, .263], [0, .54, .265], [0, .70, .254]], .003);
  for (let i = 0; i < 6; i++) b.line('#c0a88c', 'cream', [[-.009, .35 + i * .055, .266], [.009, .35 + i * .055, .266]], .0023);
  bow(b, [0, .814, .261], '#b57485', .86);
  b.oval(color, 'plush', [0, .31, -.256], [.085, .085, .079]);
}
function puppy(b: Builder, color: string) {
  b.oval(color, 'plush', [0, .48, -.045], [.245, .37, .245]);
  b.oval('#f8e5c7', 'cream', [0, .49, .168], [.16, .255, .048]);
  for (const s of [-1, 1]) {
    b.oval(color, 'plush', [s * .22, .22, -.05], [.17, .22, .205]);
    b.oval(color, 'plush', [s * .138, .28, .169], [.085, .24, .088], [0, 0, s * -.04]);
    b.oval('#efd0a2', 'plush', [s * .145, .089, .225], [.112, .089, .148]);
    b.oval(color, 'plush', [s * .257, .075, -.01], [.125, .075, .14]);
    for (const offset of [-.033, .033]) b.line('#c29464', 'plush', [[s * .145 + offset, .103, .363], [s * .145 + offset, .134, .351]], .0035);
  }
  const head = new T.Group(); head.position.set(0, 1.02, .02); head.rotation.z = -.055; b.group.add(head);
  b.oval(color, 'plush', [0, 0, 0], [.315, .29, .263], [0, 0, 0], head);
  for (const s of [-1, 1]) {
    b.oval('#c78f54', 'plush', [s * .282, -.08, -.007], [.11, .255, .098], [.15, s * .13, s * .15], head);
    b.oval('#d5a16e', 'plush', [s * .315, -.09, .061], [.059, .166, .032], [.1, 0, s * .13], head);
    b.oval('#f4dab3', 'cream', [s * .078, -.105, .246], [.125, .091, .096], [0, 0, 0], head);
  }
  b.oval('#674534', 'dark', [0, -.16, .269], [.087, .057, .054], [0, 0, 0], head);
  b.oval('#e29d9d', 'pink', [0, -.176, .312], [.043, .043, .019], [.15, 0, 0], head);
  b.line('#ba6d7a', 'pink', [[0, -.159, .333], [0, -.185, .332]], .003, head);
  b.oval('#3f302a', 'dark', [0, -.057, .34], [.066, .046, .042], [0, 0, 0], head);
  b.oval('#998373', 'dark', [-.017, -.041, .376], [.015, .006, .005], [0, 0, -.22], head);
  eyes(b, .130, .047, .238, .039, head);
  b.line('#a5784e', 'plush', [[-.173, .116, .216], [-.137, .13, .238], [-.106, .126, .247]], .007, head);
  b.line('#a5784e', 'plush', [[.106, .126, .247], [.137, .13, .238], [.173, .116, .216]], .007, head);
  b.line(color, 'plush', [[0, .25, -.23], [.20, .19, -.30], [.38, .20, -.23], [.43, .29, -.19]], .055);
  b.oval(color, 'plush', [.431, .29, -.19], [.056, .058, .056]);
  b.line('#a5b7a5', 'satin', [[-.17, .776, .077], [0, .756, .18], [.17, .776, .077]], .021);
  b.oval('#d7b267', 'gold', [0, .714, .198], [.032, .041, .012]);
}
function catEar(b: Builder, s: number, parent: T.Group, color: string) {
  const shape = new T.Shape(); shape.moveTo(-.105, -.085);
  shape.quadraticCurveTo(-.126, -.02, -.08, .19); shape.quadraticCurveTo(-.065, .237, -.025, .198);
  shape.quadraticCurveTo(.08, .1, .113, -.073); shape.quadraticCurveTo(.01, -.12, -.105, -.085);
  const geo = new T.ExtrudeGeometry(shape, { depth: .04, bevelEnabled: true, bevelSegments: 4, bevelSize: .018, bevelThickness: .012, curveSegments: 12, steps: 1 });
  const outer = b.add(geo, color, 'plush', [s * .218, .193, -.02], [s, 1, 1], [0, s * .15, s * -.14], parent);
  // Mirror shape in geometry to avoid negative scale winding on GLB export.
  if (s === -1) {
    outer.scale.x = 1; geo.scale(-1, 1, 1);
    // ExtrudeGeometry is nonindexed; reverse each triangle with all attributes.
    for (const attribute of Object.values(geo.attributes)) {
      const a = attribute as T.BufferAttribute;
      for (let i = 0; i < a.count; i += 3) for (let j = 0; j < a.itemSize; j++) {
        const first = i * a.itemSize + j, last = (i + 2) * a.itemSize + j, value = a.array[first];
        a.array[first] = a.array[last]; a.array[last] = value;
      }
    }
    geo.computeVertexNormals();
  }
  const inner = new T.Shape(); inner.moveTo(-.052 * s, -.048); inner.quadraticCurveTo(-.065 * s, .005, -.042 * s, .142); inner.quadraticCurveTo(-.028 * s, .163, -.014 * s, .139); inner.quadraticCurveTo(.05 * s, .045, .055 * s, -.04); inner.closePath();
  b.add(new T.ShapeGeometry(inner, 16), '#eab6ac', 'pink', [s * .218, .193, .036], [1, 1, 1], [0, s * .15, s * -.14], parent);
}
function kitten(b: Builder, color: string) {
  b.oval(color, 'plush', [0, .45, -.055], [.228, .35, .225]);
  b.oval('#f8e9cf', 'cream', [0, .475, .133], [.12, .221, .056]);
  for (const s of [-1, 1]) {
    b.oval(color, 'plush', [s * .19, .19, -.02], [.144, .188, .177]);
    b.oval(color, 'plush', [s * .109, .27, .165], [.073, .222, .077]);
    b.oval('#f4ddbd', 'cream', [s * .11, .07, .213], [.091, .07, .124]);
    for (const offset of [-.027, .027]) b.line('#c8a280', 'cream', [[s * .11 + offset, .084, .33], [s * .11 + offset, .108, .319]], .0025);
    for (let i = 0; i < 2; i++) b.line('#b87d4c', 'plush', [[s * .067, .34 + i * .065, .221], [s * .108, .35 + i * .065, .239], [s * .153, .34 + i * .065, .213]], .014);
  }
  const head = new T.Group(); head.position.set(0, 1.002, .017); b.group.add(head);
  b.oval(color, 'plush', [0, 0, 0], [.31, .27, .247], [0, 0, 0], head);
  catEar(b, -1, head, color); catEar(b, 1, head, color);
  for (const s of [-1, 1]) {
    b.oval('#faecd5', 'cream', [s * .069, -.095, .225], [.109, .079, .054], [0, 0, s * -.07], head);
    for (let i = 0; i < 2; i++) b.line('#b87d4c', 'plush', [[s * .274, -.038 - i * .048, .113], [s * .245, -.016 - i * .049, .148], [s * .207, -.008 - i * .049, .183]], .012, head);
    for (let i = 0; i < 3; i++) b.line('#f8e8cb', 'cream', [[s * .13, -.087 - i * .017, .254], [s * .228, -.072 - i * .032, .253], [s * .329, -.054 - i * .047, .218]], .0024, head);
    for (let i = 0; i < 2; i++) b.oval('#b99b83', 'cream', [s * (.092 + i * .023), -.097 + i * .016, .276], [.004, .004, .002], [0, 0, 0], head);
  }
  eyes(b, .129, .033, .227, .043, head, '#a6b3a0');
  b.oval('#d29198', 'pink', [0, -.065, .288], [.029, .020, .014], [0, 0, 0], head);
  b.line('#966c5b', 'cream', [[0, -.074, .291], [0, -.101, .283], [-.027, -.12, .279], [-.045, -.116, .271]], .004, head);
  b.line('#966c5b', 'cream', [[0, -.101, .283], [.027, -.12, .279], [.045, -.116, .271]], .004, head);
  for (const s of [-1, 0, 1]) {
    const x = s * .056;
    b.line('#b87d4c', 'plush', [[x * 1.35, .203, .155], [x, .175, .188], [x * .6, .138, .212]], .012, head);
  }
  b.line(color, 'plush', [[0, .195, -.23], [.22, .11, -.28], [.38, .10, -.14], [.40, .11, .10], [.35, .18, .19]], .047);
  b.oval('#f3d8b2', 'cream', [.352, .18, .19], [.049, .05, .049]);
  bow(b, [0, .735, .164], '#b7a0bd', .54);
}
function balloon(b: Builder, color: string) {
  // Polar heart outline with two domed surfaces. Inflation thickness tends to zero at the seam.
  const outline = (a: number): Vec => [16 * Math.sin(a) ** 3 * .030, (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * .030, 0];
  const heart = new T.Group(); heart.position.set(.06, 1.94, 0); heart.rotation.z = -.12; b.group.add(heart);
  for (const side of [-1, 1]) b.add(skin(26, 96, (u, v) => {
    const p = outline(v * Math.PI * 2), a = v * Math.PI * 2;
    return [p[0] * u, p[1] * u, side * (.022 + .184 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - .09 * Math.cos(a * 2)))];
  }), color, 'foil', [0, 0, 0], [1, 1, 1], [0, 0, 0], heart);
  const seamPoints: Vec[] = Array.from({ length: 97 }, (_, i) => outline(i / 96 * Math.PI * 2));
  b.line('#ba5f81', 'seam', seamPoints, .010, heart, 'foil-perimeter');
  // Tiny seal crinkles are confined to the outer rim rather than covering the glossy body.
  for (let i = 0; i < 52; i++) {
    const p = outline(i / 52 * Math.PI * 2);
    b.line('#cc7292', 'seam', [[p[0] * .965, p[1] * .965, .055], [p[0], p[1], .017]], .0032, heart);
  }
  b.box(color, 'foil', [0, -.555, 0], [.068, .103, .036], .01, heart);
  b.oval('#bb6f8c', 'seam', [0, -.59, .004], [.035, .018, .025], [0, 0, 0], heart);
  b.line('#b59d7e', 'satin', [[-.012, 1.34, .01], [-.075, 1.07, .014], [.066, .86, .025], [-.041, .55, .02], [-.007, .035, .006]], .008, b.group, 'balloon-string');
  b.line('#c4ab8e', 'satin', [[-.012, 1.345, .018], [.042, 1.22, .018], [.133, 1.14, .006], [.091, 1.05, .032], [.013, 1.10, .05], [.005, 1.19, .027]], .006, b.group);
  b.oval('#cfa26f', 'gold', [-.007, .035, .006], [.07, .035, .049]);
}

export function samplePhotoTexture(aspect = .8) {
  const canvas = document.createElement('canvas'); canvas.width = aspect > 1 ? 800 : 512; canvas.height = Math.round(canvas.width / aspect);
  const c = canvas.getContext('2d')!;
  c.scale(canvas.width / 512, canvas.height / 640);
  const sky = c.createLinearGradient(0, 0, 0, 640); sky.addColorStop(0, '#eccec5'); sky.addColorStop(1, '#fff1d4'); c.fillStyle = sky; c.fillRect(0, 0, 512, 640);
  c.fillStyle = '#fff4d5'; c.beginPath(); c.arc(355, 155, 61, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#aab7a3'; c.beginPath(); c.moveTo(0, 385); c.bezierCurveTo(100, 240, 195, 500, 512, 320); c.lineTo(512, 640); c.lineTo(0, 640); c.fill();
  c.fillStyle = '#718c7e'; c.beginPath(); c.moveTo(0, 493); c.bezierCurveTo(125, 385, 278, 390, 512, 543); c.lineTo(512, 640); c.lineTo(0, 640); c.fill();
  c.fillStyle = '#fff4df'; c.font = 'italic 34px Georgia'; c.textAlign = 'center'; c.fillText('a little memory', 256, 575);
  const t = new T.CanvasTexture(canvas); t.colorSpace = T.SRGBColorSpace; t.name = 'original-sample-landscape'; return t;
}
/** Fits the full uploaded picture within the chosen aperture without stretching. */
export async function photoTextureFromFile(file: File, aspect = .8) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP picture.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Please choose a picture smaller than 15 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas'); canvas.width = aspect > 1 ? 1000 : 800; canvas.height = Math.round(canvas.width / aspect);
    const c = canvas.getContext('2d')!; c.fillStyle = '#fff5e6'; c.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height), w = bitmap.width * scale, h = bitmap.height * scale;
    c.drawImage(bitmap, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.name = 'custom-picture'; return texture;
  } finally { bitmap.close(); }
}
function originalFrame(b: Builder, color: string, photo?: T.Texture) {
  const panel = new T.Group(); panel.position.y = .016; panel.rotation.x = -.12; b.group.add(panel);
  b.box('#605244', 'back', [0, .735, -.045], [.97, 1.34, .043], .006, panel);
  for (const s of [-1, 1]) {
    b.box(color, 'wood', [s * .493, .735, 0], [.144, 1.47, .14], .015, panel);
    b.box(color, 'wood', [0, .735 + s * .665, 0], [.855, .14, .14], .015, panel);
    b.box('#dfbd84', 'gold', [s * .417, .735, .068], [.012, 1.19, .014], .003, panel);
    b.box('#dfbd84', 'gold', [0, .735 + s * .594, .068], [.839, .012, .014], .003, panel);
  }
  // Four mat strips surround a distinct replaceable image mesh.
  for (const s of [-1, 1]) {
    b.box('#fcf2e1', 'paper', [s * .384, .735, .017], [.064, 1.176, .018], .002, panel);
    b.box('#fcf2e1', 'paper', [0, .735 + s * .517, .017], [.712, .144, .018], .002, panel);
  }
  const texture = photo ?? samplePhotoTexture();
  const picture = new T.Mesh(new T.PlaneGeometry(.712, .890), new T.MeshBasicMaterial({ name: 'picture-material', map: texture, toneMapped: false, side: T.FrontSide }));
  picture.name = 'photo-surface'; picture.position.set(0, .735, .029); panel.add(picture);
  // A flat plank extends from the hinge to a second footprint behind the frame.
  const hinge: Vec = [0, 1.03, -.195], foot: Vec = [0, .0155, -.625];
  const midpoint = new T.Vector3(...hinge).add(new T.Vector3(...foot)).multiplyScalar(.5);
  const support = b.box('#79624c', 'back', midpoint.toArray() as Vec, [.26, new T.Vector3(...hinge).distanceTo(new T.Vector3(...foot)), .040], .008, b.group, 'easel-support');
  support.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...hinge).sub(new T.Vector3(...foot)).normalize());
  b.box('#b6a07c', 'gold', hinge, [.285, .060, .065], .010, b.group, 'easel-hinge');
  for (const s of [-1, 1]) {
    b.oval('#71593f', 'dark', [s * .103, 1.031, -.233], [.011, .011, .006]);
    b.box('#8b7760', 'gold', [s * .382, .735, -.074], [.072, .023, .012], .003, panel);
    b.box('#8b7760', 'gold', [0, .735 + s * .577, -.074], [.023, .068, .012], .003, panel);
  }
  b.line('#a68b69', 'back', [[0, .49, -.14], [0, .31, -.497]], .009);
}

function frame(b: Builder, id: GiftAssetId, color: string, options: GiftModelOptions) {
  // Preserve the original frame and its easel exactly for existing bouquets.
  if (id === 'standing-frame' && frameOrientation(id, options.frameOrientation) === 'portrait') { originalFrame(b, color, options.photo); return; }
  const { width: w, height: h, photoWidth: pw, photoHeight: ph, photoY: py, aspect } = frameShape(id, options.frameOrientation);
  const gold = id === 'golden-frame', snapshot = id === 'snapshot-frame';
  const panel = new T.Group(); panel.position.y = .016; panel.rotation.x = -.12; b.group.add(panel);
  const rail = gold ? .10 : .14, center = h / 2;
  b.box('#605244', 'back', [0, center, -.045], [w - .12, h - .12, .043], .006, panel);
  if (snapshot) {
    // The generous lower border gives this frame its instant-photo silhouette.
    const side = (w - pw) / 2, bottom = py - ph / 2, top = h - py - ph / 2;
    for (const s of [-1, 1]) b.box(color, 'paper', [s * (pw + side) / 2, center, 0], [side, h, .10], .007, panel);
    b.box(color, 'paper', [0, bottom / 2, 0], [pw, bottom, .10], .007, panel);
    b.box(color, 'paper', [0, h - top / 2, 0], [pw, top, .10], .007, panel);
    // A very subtle inner bevel catches the light around the photo.
    for (const s of [-1, 1]) {
      b.box('#dfd2be', 'paper', [s * (pw / 2 + .002), py, .052], [.004, ph, .006], .001, panel);
      b.box('#dfd2be', 'paper', [0, py + s * (ph / 2 + .002), .052], [pw, .004, .006], .001, panel);
    }
  } else {
    for (const s of [-1, 1]) {
      b.box(color, gold ? 'gold' : 'wood', [s * (w - rail) / 2, center, 0], [rail, h, .14], .014, panel);
      b.box(color, gold ? 'gold' : 'wood', [0, center + s * (h - rail) / 2, 0], [w - rail * 2, rail, .14], .014, panel);
      const innerW = w - rail * 2, innerH = h - rail * 2, matX = (innerW - pw) / 2, matY = (innerH - ph) / 2;
      b.box('#fcf2e1', 'paper', [s * (pw + matX) / 2, py, .017], [matX, innerH, .018], .002, panel);
      b.box('#fcf2e1', 'paper', [0, py + s * (ph + matY) / 2, .017], [pw, matY, .018], .002, panel);
      b.box('#f0d69e', 'gold', [s * (innerW / 2 + .005), center, .068], [.012, innerH, .014], .003, panel);
      b.box('#f0d69e', 'gold', [0, center + s * (innerH / 2 + .005), .068], [innerW, .012, .014], .003, panel);
      if (gold) {
        b.box('#8e6f3d', 'gold', [s * (w / 2 - .028), center, .061], [.008, h - .06, .008], .002, panel);
        b.box('#8e6f3d', 'gold', [0, center + s * (h / 2 - .028), .061], [w - .06, .008, .008], .002, panel);
        for (const t of [-1, 1]) {
          const x = s * (w / 2 - rail / 2), y = center + t * (h / 2 - rail / 2);
          b.oval('#f8dfa6', 'gold', [x, y, .077], [.032, .032, .012], [0, 0, 0], panel);
          b.box('#8e6f3d', 'gold', [x, y, .088], [.021, .021, .006], .003, panel).rotation.z = Math.PI / 4;
        }
      }
    }
  }
  const picture = new T.Mesh(new T.PlaneGeometry(pw, ph), new T.MeshBasicMaterial({ name: 'picture-material', map: options.photo ?? samplePhotoTexture(aspect), toneMapped: false, side: T.FrontSide }));
  picture.name = 'photo-surface'; picture.position.set(0, py, snapshot ? .053 : .029); panel.add(picture);
  const hinge: Vec = [0, h * .7, -.195], foot: Vec = [0, .0155, -.625];
  const midpoint = new T.Vector3(...hinge).add(new T.Vector3(...foot)).multiplyScalar(.5);
  const support = b.box('#79624c', 'back', midpoint.toArray() as Vec, [.26, new T.Vector3(...hinge).distanceTo(new T.Vector3(...foot)), .040], .008, b.group, 'easel-support');
  support.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...hinge).sub(new T.Vector3(...foot)).normalize());
  b.box('#b6a07c', 'gold', hinge, [.285, .06, .065], .010, b.group, 'easel-hinge');
  b.line('#a68b69', 'back', [[0, h * .33, -.14], [0, h * .21, -.497]], .009);
  for (const s of [-1, 1]) b.box('#8b7760', 'gold', [s * (w / 2 - .18), center, -.074], [.072, .023, .012], .003, panel);
}

function envelope(b: Builder, color: string) {
  b.box(color, 'paper', [0, .545, 0], [1.58, 1.08, .135], .022);
  const face = (points: [number, number][], z: number, tone: string) => {
    const shape = new T.Shape(); points.forEach(([x, y], i) => { if (i) shape.lineTo(x, y); else shape.moveTo(x, y); }); shape.closePath();
    b.add(new T.ShapeGeometry(shape), tone, 'paper', [0, 0, z]);
  };
  face([[-.76, 1.06], [.76, 1.06], [0, .49]], .084, color);
  face([[-.76, 0.025], [.76, .025], [0, .60]], .080, color);
  const crease = '#b08c92';
  for (const sign of [-1, 1]) {
    b.line(crease, 'paper', [[sign * .755, 1.04, .087], [sign * .39, .77, .091], [0, .49, .092]], .004);
    b.line(crease, 'paper', [[sign * .76, .03, .084], [sign * .4, .28, .085], [sign * .12, .47, .086]], .003);
  }
  b.add(new T.CylinderGeometry(.153, .145, .034, 40), '#ad5c72', 'satin', [0, .51, .115], [1, 1, 1], [Math.PI / 2, 0, 0]);
  b.add(new T.TorusGeometry(.125, .006, 8, 40), '#d798a5', 'satin', [0, .51, .135]);
  const heart = new T.Shape(); heart.moveTo(0, -.055); heart.bezierCurveTo(-.10, .012, -.082, .088, -.033, .075); heart.bezierCurveTo(-.012, .072, 0, .058, 0, .043); heart.bezierCurveTo(.014, .084, .073, .09, .078, .04); heart.bezierCurveTo(.09, .005, .032, -.035, 0, -.055);
  b.add(new T.ExtrudeGeometry(heart, { depth: .006, bevelEnabled: true, bevelThickness: .002, bevelSize: .002, bevelSegments: 2, steps: 1, curveSegments: 16 }), '#ebbec6', 'satin', [0, .51, .135]);
}

function finishModel(b: Builder, id: GiftAssetId) {
  b.group.updateMatrixWorld(true);
  const result = new T.Group(); result.name = id;
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  const originals = new Set<T.BufferGeometry>();
  b.group.traverse(obj => {
    if (!(obj instanceof T.Mesh)) return;
    originals.add(obj.geometry);
    if (obj.name) { const m = obj.clone(); m.geometry = obj.geometry.clone(); m.geometry.applyMatrix4(obj.matrixWorld); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); result.add(m); return; }
    const copy = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
    const geometry = copy.index ? copy.toNonIndexed() : copy;
    if (geometry !== copy) copy.dispose();
    // All batches share exactly the same set of attributes.
    if (!batches.has(obj.material)) batches.set(obj.material, []); batches.get(obj.material)!.push(geometry);
  });
  for (const [mat, geometries] of batches) {
    const combined = mergeGeometries(geometries); if (!combined) throw new Error(`Cannot merge ${id}`);
    const indexed = mergeVertices(combined, .00001); combined.dispose();
    const mesh = new T.Mesh(indexed, mat); mesh.name = `${id}-${mat.name}`; mesh.castShadow = mesh.receiveShadow = true; result.add(mesh);
    geometries.forEach(g => g.dispose());
  }
  originals.forEach(g => g.dispose());
  const bounds = new T.Box3().setFromObject(result); result.position.y = -bounds.min.y;
  // Bake ground normalization into every mesh so the exported origin stays on the floor.
  result.children.forEach(obj => { if (obj instanceof T.Mesh) obj.geometry.translate(0, result.position.y, 0); }); result.position.y = 0;
  result.userData = { assetId: id, revision: 2, axis: 'Y-up; front +Z; floor Y=0', static: true };
  return result;
}
export function createGiftModel(id: GiftAssetId, options: GiftModelOptions = {}) {
  const b = new Builder(), entry = giftAssets.find(a => a.id === id);
  if (!entry) throw new Error(`Unknown gift model: ${id}`);
  const color = options.color ?? entry.color;
  switch (id) { case 'teddy-bear': teddy(b, color); break; case 'heart-balloon': balloon(b, color); break; case 'cute-puppy': puppy(b, color); break; case 'cute-kitten': kitten(b, color); break; case 'standing-frame': case 'landscape-frame': case 'golden-frame': case 'snapshot-frame': frame(b, id, color, options); break; case 'sealed-envelope': envelope(b, color); break; }
  const result = finishModel(b, id), tint = new T.Color(color).getHex();
  if (isFrame(id)) { result.userData.photoAspectRatio = frameShape(id, options.frameOrientation).aspect; result.userData.frameOrientation = frameOrientation(id, options.frameOrientation); }
  result.traverse(o => { if (o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial && o.material.color.getHex() === tint) o.material.userData.objectTint = true; });
  return result;
}
/** The model owns the passed photo texture; release it along with the model. */
export function disposeGiftModel(model: T.Object3D) {
  const geos = new Set<T.BufferGeometry>(), mats = new Set<T.Material>(), textures = new Set<T.Texture>();
  model.traverse(obj => { if (obj instanceof T.Mesh) { geos.add(obj.geometry); const materials = Array.isArray(obj.material) ? obj.material : [obj.material]; materials.forEach(m => { mats.add(m); if ((m instanceof T.MeshStandardMaterial || m instanceof T.MeshBasicMaterial) && m.map) textures.add(m.map); }); } });
  geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}
