import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true } });
try {
  const T = await server.ssrLoadModule('three');
  const models = await server.ssrLoadModule('/src/models.ts');
  const { catalog } = await server.ssrLoadModule('/src/catalog.ts');
  const gifts = await server.ssrLoadModule('/src/giftModels.ts');
  const bounds = {};
  const record = (key, model, dispose) => {
    const box = new T.Box3().setFromObject(model);
    bounds[key] = [box.min.toArray(), box.max.toArray()];
    dispose(model);
  };
  for (const category of ['flowers', 'fillers', 'wrappers']) {
    for (const item of catalog[category]) record(`${category}:${item.id}`, models[category === 'flowers' ? 'flower' : category === 'fillers' ? 'filler' : 'wrapper'](item.id, item.color), models.disposeModel);
  }
  for (const wrap of catalog.wrappers) for (const item of catalog.ribbons) record(`ribbons:${wrap.id}:${item.id}`, models.fitRibbon(models.ribbon(item.id, item.color), wrap.id), models.disposeModel);
  for (const item of gifts.giftAssets) {
    const orientations = item.id.includes('frame') ? ['portrait', 'landscape'] : [undefined];
    for (const frameOrientation of orientations) record(`objects:${item.id}:${frameOrientation ?? ''}`, gifts.createGiftModel(item.id, { frameOrientation, photo: new T.Texture() }), gifts.disposeGiftModel);
  }
  await writeFile('src/placement-bounds.json', '{\n' + Object.entries(bounds).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',\n') + '\n}\n');
} finally { await server.close(); }
