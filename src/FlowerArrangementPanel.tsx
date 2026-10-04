import { Flower2, Layers3, Leaf, RotateCcw } from 'lucide-react';
import { catalog } from './catalog';
import type { BouquetConfigV1 } from './config';
import { DEFAULT_ARRANGEMENT, defaultFlowerEdit, flowerInstances, FLOWER_EDIT_BOUNDS, type FlowerArrangement, type FlowerEdit, type HeightProfile } from './flowerArrangement';
import { layout } from './layout';

function HeightPresets({ profile, fillers = false, change }: { profile: HeightProfile; fillers?: boolean; change: (profile: HeightProfile) => void }) {
  const Icon = fillers ? Leaf : Flower2;
  return <div className="flower-profile-options" aria-label={fillers ? 'Filler height presets' : 'Flower height presets'}>{(['natural', 'stepped'] as const).map(value => <button key={value} className={profile === value ? 'active' : ''} aria-label={fillers ? `${value === 'natural' ? 'Natural' : 'Stepped'} filler arrangement` : value === 'natural' ? 'Natural dome arrangement' : 'Stepped bouquet arrangement'} aria-pressed={profile === value} onClick={() => change(value)}><div className={`flower-profile-art ${value}`} aria-hidden="true">{[0, 1, 2].map(i => <span key={i}><Icon size={22} strokeWidth={1.3} /><i /></span>)}</div><strong>{value === 'natural' ? fillers ? 'Natural heights' : 'Natural dome' : fillers ? 'Stepped fillers' : 'Stepped bouquet'}</strong><small>{value === 'natural' ? fillers ? 'Gently varied heights' : 'Soft, rounded heights' : 'Low front · higher back'}</small></button>)}</div>;
}
export function FillerArrangementPanel({ config, change }: { config: BouquetConfigV1; change: (patch: Partial<FlowerArrangement>) => void }) {
  return <div className="filler-arranger"><div className="flower-arranger-heading"><Layers3 size={17} /><strong>Give your fillers some depth</strong></div><HeightPresets fillers profile={config.arrangement?.fillerProfile ?? 'natural'} change={fillerProfile => change({ fillerProfile })} /></div>;
}

export function StemVisibility({ config, change }: { config: BouquetConfigV1; change: (patch: Partial<FlowerArrangement>) => void }) {
  return config.wrapper.id === 'gift-bag' ? <p className="stem-bag-note">The bag keeps its stems inside.</p> : <label className="stem-visibility"><span><strong>Show bottom stems</strong><small>Let the stems peek below the paper.</small></span><input type="checkbox" aria-label="Show bottom stems" checked={config.arrangement?.showStems ?? false} onChange={e => change({ showStems: e.target.checked })} /></label>;
}
export function FlowerArrangementPanel({ config, selected, select, change }: { config: BouquetConfigV1; selected: string | null; select: (key: string) => void; change: (patch: Partial<FlowerArrangement>) => void }) {
  const settings = config.arrangement ?? DEFAULT_ARRANGEMENT, flowers = flowerInstances(config.flowers), placements = layout(config).flowers;
  const active = flowers.find(f => f.key === selected) ?? flowers[0];
  const edit = settings.edits.find(e => e.key === active?.key) ?? defaultFlowerEdit(active?.key ?? '');
  const zone = (key: string) => { const z = placements.find(p => p.key === key)?.position[2] ?? 0; return z > .3 ? 'Front' : z < -.3 ? 'Back' : 'Center'; };
  function patch(values: Partial<FlowerEdit>) {
    if (!active) return;
    const next = { ...edit, ...values };
    change({ edits: [...settings.edits.filter(e => e.key !== active.key), next].filter(e => e.height !== 0 || e.size !== 1 || e.x !== 0 || e.z !== 0) });
  }
  return <div className="flower-arranger">
    <div className="flower-arranger-heading"><Layers3 size={17} /><strong>Give every bloom its place</strong></div>
    <HeightPresets profile={settings.profile} change={profile => change({ profile })} />
    {active ? <>
      <label className="individual-flower-select">Choose a flower<select aria-label="Individual flower" value={active.key} onChange={e => select(e.target.value)}>{flowers.map(f => <option key={f.key} value={f.key}>{catalog.flowers.find(c => c.id === f.id)!.name} {f.ordinal + 1} · {zone(f.key)}</option>)}</select></label>
      <p className="flower-arranger-help">Click a bloom in the preview to select it. Adjustments stay with that flower when you shuffle.</p>
      <div className="individual-flower-controls">{([{ key: 'height', label: 'Height' }, { key: 'size', label: 'Size' }, { key: 'x', label: 'Left / right' }, { key: 'z', label: 'Back / front' }] as const).map(control => <label key={control.key}><span>{control.label}<output>{control.key === 'size' ? `${Math.round(edit.size * 100)}%` : `${edit[control.key] > 0 ? '+' : ''}${edit[control.key].toFixed(2)}`}</output></span><input type="range" aria-label={`Individual flower ${control.key === 'x' ? 'horizontal position' : control.key === 'z' ? 'depth' : control.key}`} min={FLOWER_EDIT_BOUNDS[control.key][0]} max={FLOWER_EDIT_BOUNDS[control.key][1]} step="0.01" value={edit[control.key]} onChange={e => patch({ [control.key]: Number(e.target.value) })} /></label>)}</div>
      <div className="flower-reset-actions"><button className="quiet-button" disabled={!settings.edits.some(e => e.key === active.key)} onClick={() => change({ edits: settings.edits.filter(e => e.key !== active.key) })}><RotateCcw size={13} /> Reset this flower</button><button className="quiet-button" disabled={!settings.edits.length} onClick={() => change({ edits: [] })}>Reset all flower edits</button></div>
    </> : <p className="flower-arranger-help">Choose some flowers first, then adjust each bloom here.</p>}
    <StemVisibility config={config} change={change} />
  </div>;
}
