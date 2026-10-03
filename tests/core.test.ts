import { describe, it, expect } from 'vitest';
import LZString from 'lz-string';
import * as T from 'three';
import { catalog } from '../src/catalog';
import { clone, decode, encode, loadDraft, saveDraft, shareUrl, starter, surprise, total, validate, presets } from '../src/config';
import { layout } from '../src/layout';
import { buildBouquet, disposeModel, effectModel, filler, flower, mergeModel, ribbon, wrapper } from '../src/models';

describe('portable bouquets', () => {
  it('round trips every design value and Unicode gift text', () => {
    const config = { ...clone(presets[4].config), size: 1.2, spread: .8, gift: { to: '小花 🌷', from: 'Arjay 🫶', message: 'Happy birthday! 🎉\n你好 — a little bloom for you. 👩🏽‍🌾' } };
    expect(decode(encode(config))).toEqual(config);
    const url = new URL(shareUrl(config, 'https://example.com/petalpop/?old=yes#old'));
    expect(url.pathname).toBe('/petalpop/'); expect(url.search).toBe(''); expect(decode(url.hash.slice(3))).toEqual(config);
  });
  it('supports maximum text limits including emoji', () => {
    const config = clone(starter); config.gift = { to: '🌷'.repeat(50), from: '你'.repeat(50), message: '🌹'.repeat(500) };
    expect(decode(encode(config))).toEqual(config);
    config.gift.message += 'x'; expect(() => validate(config)).toThrow('too long');
  });
  it.each(['', '!bad', 'abc', 'a'.repeat(6001)])('rejects broken payload %s', payload => expect(() => decode(payload)).toThrow());
  it('rejects unsupported versions without changing the source', () => {
    const next = { ...clone(starter), version: 2 }; expect(() => decode(LZString.compressToEncodedURIComponent(JSON.stringify(next)))).toThrow('unsupported version'); expect(starter.version).toBe(1);
  });
  it('rejects unknown IDs, duplicates, negative and excessive stem counts', () => {
    const bad = clone(starter); bad.flowers[0].id = 'not-a-flower'; expect(() => validate(bad)).toThrow();
    bad.flowers = [{ id: 'rose', count: 25, color: '#ffffff' }]; expect(() => validate(bad)).toThrow();
    bad.flowers[0].count = -1; expect(() => validate(bad)).toThrow();
    bad.flowers = [clone(starter).flowers[0], clone(starter).flowers[0]]; expect(() => validate(bad)).toThrow();
    bad.flowers = catalog.flowers.slice(0, 6).map(i => ({ id: i.id, count: 1, color: i.color })); expect(() => validate(bad)).toThrow();
    bad.flowers = starter.flowers; bad.effects = ['sparkles', 'hearts', 'bubbles']; expect(() => validate(bad)).toThrow();
  });
  it('rejects unsafe colors, nonfinite settings, invalid text and bad seeds', () => {
    for (const changes of [{ size: NaN }, { spread: Infinity }, { seed: -1 }, { seed: .5 }, { wrapper: { id: 'classic-cone', color: 'url(evil)' } }, { gift: { to: 3, from: '', message: '' } }]) expect(() => validate({ ...clone(starter), ...changes })).toThrow();
  });
  it('falls back safely when draft storage is inaccessible or corrupt', () => {
    expect(loadDraft({ getItem: () => { throw new Error('blocked'); } })).toEqual(starter);
    expect(loadDraft({ getItem: () => '{invalid' })).toEqual(starter);
    expect(saveDraft(starter, { setItem: () => { throw new Error('quota'); } })).toBe(false);
  });
  it('validates every preset and 100 deterministic random bouquets', () => {
    presets.forEach(p => expect(validate(p.config)).toEqual(p.config));
    for (let i = 0; i < 100; i++) { const c = surprise(starter, i); expect(validate(c)).toEqual(c); expect(c.gift).toEqual(starter.gift); expect(total(c.flowers)).toBeLessThanOrEqual(24); expect(c).toEqual(surprise(starter, i)); }
  });
});
describe('original 3D catalog and placement', () => {
  it('retains botanical color gradients and translucent finishes after batching', () => {
    const rose = mergeModel(flower('rose', '#e886a3'));
    const shades = new Set<string>();
    rose.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      const material = o.material as T.MeshStandardMaterial, colors = o.geometry.getAttribute('color');
      expect(material.vertexColors).toBe(true); expect(colors.count).toBe(o.geometry.getAttribute('position').count);
      for (let i = 0; i < colors.count; i++) shades.add(`${colors.getX(i).toFixed(3)}:${colors.getY(i).toFixed(3)}:${colors.getZ(i).toFixed(3)}`);
    });
    expect(shades.size).toBeGreaterThan(20);
    const sleeve = mergeModel(wrapper('frosted', '#c0d8df'));
    const finishes = sleeve.children.map(o => (o as T.Mesh).material as T.MeshStandardMaterial);
    expect(finishes.some(m => m.transparent && m.opacity < 1 && !m.depthWrite)).toBe(true);
    expect(finishes.some(m => !m.transparent && m.opacity === 1)).toBe(true);
    disposeModel(rose); disposeModel(sleeve);
  });
  it('provides ten renderable and geometrically distinct variants per category', () => {
    for (const [category, entries] of Object.entries(catalog)) {
      expect(entries).toHaveLength(10); expect(new Set(entries.map(i => i.id)).size).toBe(10);
      const signatures = new Set<string>();
      entries.forEach(item => {
        const create = category === 'flowers' ? flower : category === 'fillers' ? filler : category === 'wrappers' ? wrapper : category === 'ribbons' ? ribbon : effectModel;
        const g = mergeModel(create(item.id, '#e886a3')); expect(g.children.length).toBeGreaterThan(0);
        let vertices = 0, checksum = 0;
        g.traverse(o => { if (o instanceof T.Mesh) { const p = o.geometry.getAttribute('position'); vertices += p.count; let finite = true; for (let i = 0; i < p.count; i++) { finite = finite && Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)); checksum += (p.getX(i) * 3 + p.getY(i) * 7 + p.getZ(i) * 11) * (i % 7 + 1); } expect(finite).toBe(true); } });
        signatures.add(`${vertices}:${checksum.toFixed(4)}`); disposeModel(g);
      });
      if (category !== 'effects') expect(signatures.size, category).toBe(10);
    }
  });
  it('preserves arrangements across reloads and text changes', () => {
    expect(layout(starter)).toEqual(layout(decode(encode(starter))));
    expect(layout({ ...clone(starter), gift: { to: 'Different', from: '', message: 'Text only' } })).toEqual(layout(starter));
    expect(layout({ ...clone(starter), seed: 555 })).not.toEqual(layout(starter));
  });
  it.each(catalog.flowers)('builds maximum $id bouquets within geometry and draw-call limits', item => {
      const config = { ...clone(starter), flowers: [{ id: item.id, count: 24, color: item.color }], fillers: [{ id: 'fern', count: 12, color: '#89aaa0' }], size: 1.2, spread: .8 };
      const positions = layout(config); expect(positions.flowers).toHaveLength(24); expect(positions.fillers).toHaveLength(12);
      const g = buildBouquet(config), bounds = new T.Box3().setFromObject(g); expect(bounds.min.y).toBeGreaterThan(-2); expect(bounds.max.y).toBeLessThan(3); expect(g.children.length).toBeLessThan(20);
      let triangles = 0;
      g.traverse(o => { if (o instanceof T.Mesh) triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3; });
      expect(triangles, item.id).toBeLessThan(350000); disposeModel(g);
  });
});
