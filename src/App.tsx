import { lazy, memo, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Flower2, Leaf, PackageOpen, Ribbon, Sparkles, Gift, Shuffle, RotateCcw, Download, Share2, Check, Plus, Minus, X, Copy, ArrowLeft, Heart, Pause, Play, MousePointer2, WandSparkles, ChevronDown, Send, RefreshCw, Shapes, Undo2, Redo2, Compass, Mail } from 'lucide-react';
import { catalog, findItem, palettes, type Category, type CatalogItem } from './catalog';
import { applyPalette, clone, decode, GIFT_BODY_LIMIT, GIFT_TITLE_LIMIT, loadDraft, presets, saveDraft, seed, starter, surprise, total, type BouquetConfigV1 } from './config';
import type { ViewerHandle, ViewDirection } from './Viewer';
import { giftCard } from './export';
import renderedCatalog from './catalog-thumbnails.json';
import { ObjectsPanel } from './ObjectsPanel';
import { giftAssets, OBJECT_LIMIT, type GiftObject } from './giftCatalog';
import { ColorControl } from './ColorControl';
import { useDesignHistory } from './useDesignHistory';
import { createShareLink, openSharedBouquet } from './sharing';
import { EnvelopeNote, type NoteOrigin } from './EnvelopeNote';
import { FillerArrangementPanel, FlowerArrangementPanel, StemVisibility } from './FlowerArrangementPanel';
import { DEFAULT_ARRANGEMENT, flowerInstances, pruneArrangement, type FlowerArrangement } from './flowerArrangement';
import { MobileStudioNav, scrollStudioTo } from './MobileStudioNav';
import { useMobileFlowerWorkspace } from './useMobileFlowerWorkspace';

const Viewer = lazy(() => import('./Viewer'));
const staticThumbnails: Record<string, string> = renderedCatalog;
type Tab = Category | 'gift' | 'objects';
const tabs = [{ id: 'flowers', name: 'Flowers', icon: Flower2 }, { id: 'fillers', name: 'Fillers', icon: Leaf }, { id: 'wrappers', name: 'Wrap', icon: PackageOpen }, { id: 'ribbons', name: 'Ribbon', icon: Ribbon }, { id: 'effects', name: 'Effects', icon: Sparkles }, { id: 'objects', name: 'Objects', icon: Shapes }, { id: 'gift', name: 'Gift', icon: Gift }] as const;
const titles: Record<Tab, [string, string]> = { flowers: ['Pick your petals', 'Mix up to 5 varieties. Every bloom belongs.'], fillers: ['The little extras', 'Mix up to 3 varieties for a little more texture.'], wrappers: ['Give them a hug', 'A lovely home for your little blooms.'], ribbons: ['Tie it all together', 'The cutest finishing touch.'], effects: ['A sprinkle of magic', 'Choose up to 2 effects. Tiny things, big joy.'], objects: ['Little companions', 'Add up to 6 objects. Move them, turn them, make it yours.'], gift: ['Make it personal', 'A few words can mean a whole lot.'] };
function initialState() {
  if (window.location.hash) {
    if (window.location.hash.startsWith('#s=')) return { config: loadDraft(), mode: 'gift' as const, error: '' };
    try { if (!window.location.hash.startsWith('#b=')) throw new Error('This bouquet link seems broken.'); return { config: decode(window.location.hash.slice(3)), mode: 'gift' as const, error: '' }; }
    catch (e) { return { config: loadDraft(), mode: 'editor' as const, error: (e as Error).message }; }
  }
  return { config: loadDraft(), mode: 'editor' as const, error: '' };
}
const Thumb = memo(function Thumb({ category, item, color }: { category: Category; item: CatalogItem; color?: string }) {
  const [url, setUrl] = useState('');
  const prebuilt = staticThumbnails[`${category}:${item.id}:${color ?? item.color}`];
  useEffect(() => {
    if (prebuilt) return;
    let live = true;
    const timer = window.setTimeout(() => { import('./thumbnails').then(module => { if (live) { try { setUrl(module.thumbnail(category, item.id, color)); } catch { /* Text labels remain available without WebGL. */ } } }).catch(() => {}); }, 20);
    return () => { live = false; clearTimeout(timer); };
  }, [category, item.id, color, prebuilt]);
  const src = prebuilt ? `${import.meta.env.BASE_URL}${prebuilt}` : url;
  return src ? <img className="catalog-image" src={src} width={224} height={224} decoding="async" alt="" draggable={false} /> : <Flower2 className="thumbnail-placeholder" strokeWidth={1} aria-hidden="true" />;
});
function Modal({ title, children, onClose, className = '' }: { title: string; children: React.ReactNode; onClose: () => void; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); const node = dialog.current; return () => { node?.close(); }; }, []);
  return <dialog ref={dialog} className={`modal ${className}`} aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <div className="modal-top"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>{children}
  </dialog>;
}
function GiftCopyFields({ gift, onChange }: { gift: BouquetConfigV1['gift']; onChange: (patch: Partial<BouquetConfigV1['gift']>) => void }) {
  const id = useId();
  return <div className="gift-fields gift-copy-fields">
    <div className="gift-copy-field"><label htmlFor={`${id}-title`}>Title</label><input id={`${id}-title`} value={gift.title} placeholder="A little joy, just for you" aria-describedby={`${id}-title-count`} onChange={e => onChange({ title: Array.from(e.target.value).slice(0, GIFT_TITLE_LIMIT).join('') })} /><span id={`${id}-title-count`} className="character-count">{Array.from(gift.title).length}/{GIFT_TITLE_LIMIT}</span></div>
    <div className="gift-copy-field"><label htmlFor={`${id}-body`}>Body</label><textarea id={`${id}-body`} rows={4} value={gift.message} placeholder="Saw these and thought of you…" aria-describedby={`${id}-body-count`} onChange={e => onChange({ message: Array.from(e.target.value).slice(0, GIFT_BODY_LIMIT).join('') })} /><span id={`${id}-body-count`} className="character-count">{Array.from(gift.message).length}/{GIFT_BODY_LIMIT}</span></div>
  </div>;
}
function PreviewUnavailable({ config, retry }: { config: BouquetConfigV1; retry: () => void }) {
  return <div className="scene-fallback"><Flower2 size={38} /><h3>The 3D preview is unavailable</h3><p>{config.flowers.map(f => `${f.count} ${findItem('flowers', f.id).name}`).join(' · ') || 'Your bouquet is ready for its first flower.'}</p><p>You can keep editing and sharing. PNG downloads need a working 3D preview.</p><button className="quiet-button" onClick={retry}><RefreshCw size={16} /> Try the preview again</button></div>;
}
export default function App() {
  const [initial] = useState(initialState), [mode, setMode] = useState<'editor' | 'gift'>(initial.mode);
  const { config, setConfig, replaceConfig, beginEdit, endEdit, undo, redo, canUndo, canRedo } = useDesignHistory(initial.config);
  const [direction, setDirection] = useState<ViewDirection>('Front');
  const [loadingShared, setLoadingShared] = useState(() => window.location.hash.startsWith('#s='));
  const [link, setLink] = useState<{ config: BouquetConfigV1; url: string; short: boolean } | null>(null);
  const rangeEditing = useRef(false), studioScroll = useRef(0);
  const [tab, setTab] = useState<Tab>('flowers'), [error, setError] = useState(initial.error), [opened, setOpened] = useState(false);
  const [modal, setModal] = useState<'presets' | 'share' | null>(null), [notice, setNotice] = useState(''), [shareCopied, setShareCopied] = useState(false);
  const linkPending = modal === 'share' && link?.config !== config;
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [exporting, setExporting] = useState(false), [replay, setReplay] = useState(0);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches), [motionEnabled, setMotionEnabled] = useState(true);
  const [storageAvailable, setStorageAvailable] = useState(true), viewer = useRef<ViewerHandle | null>(null), shareInput = useRef<HTMLInputElement>(null);
  const [selectedObject, setSelectedObject] = useState<string | null>(null), [placing, setPlacing] = useState(false);
  const [arrangingFlowers, setArrangingFlowers] = useState(false), [selectedFlower, setSelectedFlower] = useState<string | null>(null);
  const [flowerScope, setFlowerScope] = useState<'all' | 'individual'>('all'), [flowerFocus, setFlowerFocus] = useState(true);
  const flowerFocused = useMobileFlowerWorkspace(mode === 'editor' && !loadingShared && tab === 'flowers' && arrangingFlowers && flowerFocus);
  const flowers = flowerInstances(config.flowers), activeFlower = flowers.find(f => f.key === selectedFlower) ?? flowers[0];
  const selectFlower = useCallback((key: string) => { setSelectedFlower(key); setSelectedObject(null); setPlacing(false); setArrangingFlowers(true); setFlowerScope('individual'); setFlowerFocus(true); setTab('flowers'); requestAnimationFrame(() => document.getElementById('panel-flowers')?.scrollTo({ top: 0 })); }, []);
  const [openEnvelope, setOpenEnvelope] = useState<{ uid: string; origin?: NoteOrigin } | null>(null);
  const envelope = config.objects.find(o => o.uid === openEnvelope?.uid && o.id === 'sealed-envelope');
  const openNote = useCallback((uid: string, origin?: NoteOrigin) => { setPlacing(false); setOpenEnvelope({ uid, origin }); }, []);
  const activeObject = config.objects.find(o => o.uid === selectedObject);
  const selectObject = useCallback((uid: string | null) => { setSelectedObject(uid); setPlacing(false); if (uid) setTab('objects'); }, []);
  const moveObject = useCallback((uid: string, position: GiftObject['position']) => { setConfig(current => ({ ...current, objects: current.objects.map(o => o.uid === uid ? { ...o, position } : o) })); }, [setConfig]);
  const motion = motionEnabled && !reduced && (mode === 'editor' || opened);
  const onReady = useCallback((handle: ViewerHandle | null) => { viewer.current = handle; setReady(!!handle); if (handle) setFailed(false); if (import.meta.env.DEV) Object.assign(window, { __petalpopMetrics: () => handle?.metrics(), __petalpopObjectPoints: () => handle?.objectPoints(), __petalpopFlowerPoints: () => handle?.flowerPoints() }); }, []);
  const onFailure = useCallback(() => { viewer.current = null; setFailed(true); setReady(false); }, []);
  useEffect(() => { const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  useEffect(() => { if (mode !== 'editor') return; const timer = setTimeout(() => setStorageAvailable(saveDraft(config)), 350); return () => clearTimeout(timer); }, [config, mode]);
  useEffect(() => { const flush = () => { if (mode === 'editor') saveDraft(config); }; window.addEventListener('pagehide', flush); return () => window.removeEventListener('pagehide', flush); }, [config, mode]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    let request: AbortController | undefined;
    const listener = async () => {
      request?.abort(); request = new AbortController(); const current = request;
      setModal(null); setOpenEnvelope(null); setShareCopied(false); setOpened(false); setError('');
      if (!window.location.hash) { replaceConfig(loadDraft()); setMode('editor'); setLoadingShared(false); return; }
      try {
        if (window.location.hash.startsWith('#s=')) {
          setLoadingShared(true); setMode('gift');
          const saved = await openSharedBouquet(window.location.hash.slice(3), current.signal);
          if (current.signal.aborted) return; replaceConfig(saved);
        } else { if (!window.location.hash.startsWith('#b=')) throw new Error('This bouquet link seems broken.'); replaceConfig(decode(window.location.hash.slice(3))); }
        setMode('gift'); setLoadingShared(false);
      } catch (e) { if (current.signal.aborted) return; replaceConfig(loadDraft()); setMode('editor'); setLoadingShared(false); setError((e as Error).message); }
    };
    if (window.location.hash.startsWith('#s=')) void listener();
    window.addEventListener('hashchange', listener); return () => { request?.abort(); window.removeEventListener('hashchange', listener); };
  }, [replaceConfig]);
  useEffect(() => {
    if (modal !== 'share') return;
    const request = new AbortController();
    const timer = setTimeout(() => { void createShareLink(config, request.signal).then(result => { if (!request.signal.aborted) { setLink({ ...result, config }); setShareCopied(false); } }).catch(() => {}); }, 350);
    return () => { clearTimeout(timer); request.abort(); };
  }, [modal, config]);
  useEffect(() => {
    const finish = () => { if (rangeEditing.current) { rangeEditing.current = false; endEdit(); } };
    window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish); window.addEventListener('blur', finish);
    const keys = (event: KeyboardEvent) => {
      if (mode !== 'editor' || loadingShared || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('dialog') || target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement && !['range', 'color'].includes(target.type)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' || key === 'y') { event.preventDefault(); rangeEditing.current = false; if (key === 'y' || event.shiftKey) redo(); else undo(); setPlacing(false); }
    };
    window.addEventListener('keydown', keys);
    return () => { window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', finish); window.removeEventListener('blur', finish); window.removeEventListener('keydown', keys); };
  }, [mode, loadingShared, endEdit, undo, redo]);
  const update = (fn: (config: BouquetConfigV1) => BouquetConfigV1) => setConfig(current => pruneArrangement(fn(current)));
  const updateArrangement = (patch: Partial<FlowerArrangement>) => update(c => ({ ...c, arrangement: { ...(c.arrangement ?? DEFAULT_ARRANGEMENT), ...patch } }));
  const updateGiftCopy = (patch: Partial<BouquetConfigV1['gift']>) => { setShareCopied(false); update(c => ({ ...c, gift: { ...c.gift, ...patch } })); };
  const select = (category: Category, item: CatalogItem) => {
    update(c => {
      if (category === 'flowers' || category === 'fillers') {
        const entries = c[category], exists = entries.some(i => i.id === item.id);
        if (exists) return { ...c, [category]: entries.filter(i => i.id !== item.id) };
        if (entries.length >= (category === 'flowers' ? 5 : 3) || total(entries) >= (category === 'flowers' ? 24 : 12)) return c;
        const palette = palettes.find(p => p.id === c.palette)!;
        return { ...c, [category]: [...entries, { id: item.id, count: 1, color: palette.colors[category === 'flowers' ? entries.length % 3 : 3] }] };
      }
      if (category === 'effects') return { ...c, effects: c.effects.includes(item.id) ? c.effects.filter(id => id !== item.id) : c.effects.length < 2 ? [...c.effects, item.id] : c.effects };
      const key = category === 'wrappers' ? 'wrapper' : 'ribbon';
      return { ...c, [key]: { id: item.id, color: c[key].color } };
    });
  };
  const count = (category: 'flowers' | 'fillers', id: string, delta: number) => update(c => delta > 0 && total(c[category]) >= (category === 'flowers' ? 24 : 12) ? c : ({ ...c, [category]: c[category].map(item => item.id === id ? { ...item, count: Math.max(0, item.count + delta) } : item).filter(item => item.count > 0) }));
  const itemColor = (category: Category, id: string, color: string) => update(c => category === 'flowers' || category === 'fillers' ? { ...c, [category]: c[category].map(item => item.id === id ? { ...item, color } : item) } : category === 'wrappers' ? { ...c, wrapper: { ...c.wrapper, color } } : { ...c, ribbon: { ...c.ribbon, color } });
  const showShare = () => { setShareCopied(false); setModal('share'); };
  const copyLink = async () => {
    if (linkPending || !link) return;
    try { await navigator.clipboard.writeText(link.url); setShareCopied(true); }
    catch { shareInput.current?.focus(); shareInput.current?.select(); setNotice('Select and copy the link below.'); }
  };
  const nativeShare = async () => { if (linkPending || !link) return; try { await navigator.share({ title: config.gift.title.trim() || 'A little bouquet for you 🌷', text: config.gift.message.trim() || (config.gift.to ? `For ${config.gift.to}, with love.` : 'I made you a little bouquet.'), url: link.url }); } catch (e) { if ((e as Error).name !== 'AbortError') { setNotice('Sharing isn’t available here. Copy the link instead.'); } } };
  const exportCard = async () => { if (!viewer.current) return; setExporting(true); try { await giftCard(await viewer.current.capture(), config); setNotice('Your bouquet is ready to keep.'); } catch (e) { setNotice((e as Error).message || 'The image couldn’t be created. Please try again.'); } finally { setExporting(false); } };
  const goEditor = () => { setMode('editor'); setOpened(false); if (initial.mode === 'gift' || window.location.hash) history.replaceState(null, '', `${window.location.pathname}${window.location.search}`); setNotice('Make this little bouquet your own.'); requestAnimationFrame(() => window.scrollTo({ top: studioScroll.current, behavior: 'instant' })); };
  const palette = palettes.find(p => p.id === config.palette)!;
  const flowerCount = total(config.flowers), fillerCount = total(config.fillers);
  const hasDesign = flowerCount > 0 || config.objects.length > 0;
  const giftPreview = () => { studioScroll.current = window.scrollY; setStorageAvailable(saveDraft(config)); setOpened(false); setMode('gift'); requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' })); };
  const canExport = ready && !failed && hasDesign;
  const chooseTab = (next: Tab) => { setTab(next); setPlacing(false); setFlowerFocus(true); requestAnimationFrame(() => scrollStudioTo(`panel-${next}`)); };
  const stopArranging = () => { setArrangingFlowers(false); requestAnimationFrame(() => scrollStudioTo('panel-flowers')); };
  const frontGuide = <div className="front-guide"><span>Viewing: <strong>{direction}</strong></span><button aria-label="Show front view" title="Face the front of the bouquet and objects" disabled={!ready} onClick={() => viewer.current?.front()}><Compass size={15} /> Front view</button></div>;
  return <div className={`app ${mode === 'gift' ? 'gift-mode' : ''} ${flowerFocused ? 'flower-workspace' : ''}`} onFocusCapture={e => { const node = e.target; if (node instanceof HTMLInputElement && node.type !== 'file' && !node.readOnly || node instanceof HTMLTextAreaElement) { if (!node.closest('.crop-modal, .note-dialog')) beginEdit(); } }} onBlurCapture={e => { if ((e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) && !e.target.closest('.crop-modal, .note-dialog')) endEdit(); }} onPointerDownCapture={e => { if (e.target instanceof HTMLInputElement && e.target.type === 'range' && !e.target.closest('.crop-modal, .note-dialog')) { rangeEditing.current = true; beginEdit(); } }} onKeyDownCapture={e => { if (e.target instanceof HTMLInputElement && e.target.type === 'range' && !e.target.closest('.crop-modal, .note-dialog') && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) beginEdit(); }} onKeyUpCapture={e => { if (e.target instanceof HTMLInputElement && e.target.type === 'range') endEdit(); }}>
    <header className="site-header">
      <a className="brand" href={window.location.pathname} aria-label="PetalPop home"><span className="brand-mark"><Flower2 size={30} strokeWidth={1.6} /></span><span>petalpop<span className="brand-3d">3D</span><small>a little joy, in bloom</small></span></a>
      <div className="header-actions">{mode === 'editor' ? <><button className="quiet-button preview-button" onClick={giftPreview} disabled={!hasDesign}><Gift size={17} /> Preview gift</button><button className="primary-button share-header" aria-label="Share bouquet" onClick={showShare} disabled={!hasDesign}><Share2 size={17} /><span>Share bouquet</span></button></> : <button className="quiet-button" disabled={loadingShared} onClick={goEditor}><ArrowLeft size={17} /> {initial.mode === 'gift' ? 'Remix bouquet' : 'Back to studio'}</button>}</div>
    </header>
    {error && <div className="error-banner" role="alert"><span>{error} Your saved draft is still here.</span><button className="quiet-button" onClick={() => { history.replaceState(null, '', window.location.pathname); setError(''); replaceConfig(loadDraft()); setMode('editor'); }}>Open studio</button></div>}
    {loadingShared ? <main className="gift-page"><div className="scene-loading" role="status"><Flower2 size={32} /><span>Opening your little bouquet…</span></div></main> : mode === 'editor' ? <main className="workspace">
      <section className="preview-column" id="bouquet-preview" aria-label="Bouquet preview">
        <div className="preview-presets"><button className="quiet-button preset-trigger" onClick={() => setModal('presets')}>Start with a preset <ChevronDown size={15} /></button></div>
        <div className="preview-card" style={{ '--scene-color': palette.background } as React.CSSProperties}>
          <div className="preview-top"><span className="live-label"><span /> YOUR BOUQUET</span><span className="stem-label">{flowerCount} blooms <span>·</span> {fillerCount} fillers</span></div>
          <div className="scene-wrap" role="region" aria-label={`Interactive 3D bouquet: ${[...config.flowers.map(f => `${f.count} ${findItem('flowers', f.id).name}`), ...config.objects.map(o => giftAssets.find(a => a.id === o.id)!.name)].join(', ') || 'no flowers or objects yet'}`} data-testid="scene" data-ready={ready}>
            {failed ? <PreviewUnavailable config={config} retry={() => setFailed(false)} /> : <Suspense fallback={<div className="scene-loading"><Flower2 size={32} /><span>Growing something lovely…</span></div>}><Viewer config={config} motion={motion} replay={replay} onReady={onReady} onFailure={onFailure} onDirection={setDirection} openNote={openNote} flowerInteraction={{ selected: tab === 'flowers' && arrangingFlowers && flowerScope === 'individual' ? activeFlower?.key ?? null : null, select: selectFlower }} interaction={{ selected: activeObject?.uid ?? null, placing: !!activeObject && placing, select: selectObject, move: moveObject, beginEdit, endEdit, placementDone: () => { setPlacing(false); setNotice('Placed. Drag it again whenever you like.'); }, photoError: () => setNotice('A frame picture could not be opened. Choose the picture again.') }} /></Suspense>}
            {frontGuide}
            {!hasDesign && <div className="empty-bouquet">Your flowers go here.<small>Pick a bloom to get started.</small></div>}
            <span className="scene-hint"><MousePointer2 size={12} />{placing && activeObject ? 'Tap the grid to place your object' : activeObject ? 'Drag selected object to move · drag elsewhere to turn' : 'Tap to select · drag to turn'}</span>
          </div>
          <div className="scene-toolbar"><button className="quiet-button" onClick={() => { update(c => ({ ...c, seed: seed() })); setNotice('A fresh little arrangement.'); }} disabled={!flowerCount}><Shuffle size={16} /> Shuffle</button><div className="scene-utilities"><button className="icon-button" aria-label="Reset view" title="Reset view" disabled={!ready} onClick={() => viewer.current?.reset()}><RotateCcw size={17} /></button><button className="icon-button" aria-label={motionEnabled ? 'Pause motion' : 'Enable motion'} title={reduced ? 'Your device prefers reduced motion' : motionEnabled ? 'Pause motion' : 'Enable motion'} aria-pressed={motionEnabled && !reduced} disabled={reduced} onClick={() => setMotionEnabled(value => !value)}>{motionEnabled && !reduced ? <Pause size={17} /> : <Play size={17} />}</button><button className="quiet-button download-button" onClick={exportCard} disabled={!canExport || exporting} title={failed ? 'PNG export needs a working 3D preview' : 'Download a 1080 × 1080 gift card'}><Download size={17} /><span>{exporting ? 'Saving…' : 'Save PNG'}</span></button></div></div>
        </div>
        {(activeObject || arrangingFlowers && activeFlower) && <div className="mobile-selection"><span>{activeObject ? giftAssets.find(a => a.id === activeObject.id)!.name : `${findItem('flowers', activeFlower!.id).name} ${activeFlower!.ordinal + 1}`} selected</span><button className="quiet-button" onClick={() => { setTab(activeObject ? 'objects' : 'flowers'); setPlacing(false); setFlowerFocus(true); requestAnimationFrame(() => scrollStudioTo(activeObject ? 'selected-object-controls' : 'panel-flowers')); }}>Adjust <ChevronDown size={15} /></button></div>}
        <div className="palette-section"><div><span className="section-label">A COLOR STORY</span><span className="palette-name">{palette.name}</span></div><div className="palette-options">{palettes.map(p => <button key={p.id} className={`palette-swatch ${p.id === config.palette ? 'active' : ''}`} title={p.name} aria-label={`Apply ${p.name} palette`} aria-pressed={p.id === config.palette} onClick={() => update(c => applyPalette(c, p.id))}><span style={{ background: `conic-gradient(${p.colors[0]} 0deg 120deg, ${p.colors[1]} 120deg 240deg, ${p.colors[2]} 240deg 360deg)` }} />{p.id === config.palette && <Check size={12} />}</button>)}</div></div>
        <div className="surprise-row"><span>Not sure where to start?</span><button className="quiet-button" onClick={() => { update(c => surprise(c)); setReplay(v => v + 1); setNotice('A little surprise, just for you.'); }}><WandSparkles size={16} /> Surprise me</button></div>
      </section>
      <section className="builder-card" id="bouquet-builder" aria-label="Bouquet builder">
        <div className="builder-heading"><h2>Make it yours<span>✿</span></h2><span className="save-status">{storageAvailable ? 'Draft saved on this device' : 'Keep your bouquet with a link'}</span></div>
        <div className="mobile-flower-heading"><button className="quiet-button" onClick={stopArranging}><ArrowLeft size={16} /> Done</button><strong>{flowerScope === 'all' || !activeFlower ? 'All blooms' : `${findItem('flowers', activeFlower.id).name} ${activeFlower.ordinal + 1}`}</strong><div><button className="icon-button" aria-label="Undo" disabled={!canUndo} onClick={undo}><Undo2 size={17} /></button><button className="icon-button" aria-label="Redo" disabled={!canRedo} onClick={redo}><Redo2 size={17} /></button></div></div>
        <div className="builder-navigation" id="builder-navigation">
        <div className="history-controls" aria-label="Design history"><button className="quiet-button" aria-label="Undo" title="Undo (Ctrl/Cmd + Z)" disabled={!canUndo} onClick={() => { undo(); setPlacing(false); }}><Undo2 size={16} /> Undo</button><button className="quiet-button" aria-label="Redo" title="Redo (Ctrl/Cmd + Shift + Z or Ctrl + Y)" disabled={!canRedo} onClick={() => { redo(); setPlacing(false); }}><Redo2 size={16} /> Redo</button><span>Make room to experiment.</span></div>
        <div className="tabs" role="tablist" aria-label="Bouquet categories">{tabs.map(t => <button key={t.id} role="tab" id={`tab-${t.id}`} aria-controls={`panel-${t.id}`} aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} className={tab === t.id ? 'active' : ''} onClick={() => chooseTab(t.id)} onKeyDown={e => { if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const index = tabs.findIndex(t => t.id === tab), next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; chooseTab(tabs[next].id); document.getElementById(`tab-${tabs[next].id}`)?.focus(); } }}><t.icon size={19} strokeWidth={1.6} /><span>{t.name}</span></button>)}</div>
        </div>
        <div className="tab-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          <div className="panel-heading"><div><h3>{titles[tab][0]}</h3><p>{titles[tab][1]}</p></div>{(tab === 'flowers' || tab === 'fillers') && <span className="limit-pill">{total(config[tab])}/{tab === 'flowers' ? 24 : 12}</span>}{tab === 'objects' && <span className="limit-pill">{config.objects.length}/{OBJECT_LIMIT}</span>}</div>
          {tab === 'objects' ? <ObjectsPanel objects={config.objects} selected={activeObject?.uid ?? null} placing={!!activeObject && placing} select={selectObject} change={fn => update(c => ({ ...c, objects: fn(c.objects) }))} place={value => { setPlacing(value); if (value) scrollStudioTo('bouquet-preview'); }} notice={setNotice} openNote={openNote} /> : tab === 'gift' ? <div className="gift-fields"><label>For<input value={config.gift.to} placeholder="Someone lovely" onChange={e => updateGiftCopy({ to: Array.from(e.target.value).slice(0, 50).join('') })} /></label><label>From<input value={config.gift.from} placeholder="Your name (or a secret admirer)" onChange={e => updateGiftCopy({ from: Array.from(e.target.value).slice(0, 50).join('') })} /></label><GiftCopyFields gift={config.gift} onChange={updateGiftCopy} /><p className="gift-note"><Heart size={15} /> Names, title and body travel with the bouquet link.</p><button className="primary-button full-width" onClick={giftPreview} disabled={!hasDesign}><Gift size={17} /> Preview your gift</button></div> : <>
            {tab === 'effects' && <div className="effect-actions"><button className="quiet-button" onClick={() => update(c => ({ ...c, effects: [] }))} disabled={!config.effects.length}>Clear effects</button><button className="quiet-button" onClick={() => setReplay(value => value + 1)} disabled={!config.effects.length}><RefreshCw size={15} /> Replay</button></div>}
            {tab === 'flowers' && <div className="flower-edit-switch" aria-label="Flower editing mode"><button aria-pressed={!arrangingFlowers} onClick={stopArranging}><Flower2 size={14} /> Choose flowers</button><button aria-pressed={arrangingFlowers} onClick={() => { setSelectedObject(null); setPlacing(false); setFlowerFocus(true); setArrangingFlowers(true); }}>Arrange blooms</button></div>}
            {tab === 'wrappers' && <StemVisibility config={config} change={updateArrangement} />}
            {tab === 'fillers' && <FillerArrangementPanel config={config} change={updateArrangement} />}
            {tab === 'flowers' && arrangingFlowers ? <FlowerArrangementPanel config={config} selected={activeFlower?.key ?? null} select={selectFlower} change={updateArrangement} scope={flowerScope} setScope={setFlowerScope} changeShape={patch => update(c => ({ ...c, ...patch }))} /> : <div className="catalog-grid">{catalog[tab].map(item => {
              const stem = tab === 'flowers' || tab === 'fillers' ? config[tab].find(s => s.id === item.id) : undefined;
              const decor = tab === 'wrappers' ? config.wrapper : tab === 'ribbons' ? config.ribbon : undefined;
              const selected = !!stem || decor?.id === item.id || tab === 'effects' && config.effects.includes(item.id);
              const blocked = !selected && ((tab === 'flowers' || tab === 'fillers') ? config[tab].length >= (tab === 'flowers' ? 5 : 3) || total(config[tab]) >= (tab === 'flowers' ? 24 : 12) : tab === 'effects' && config.effects.length >= 2);
              return <div key={item.id} className={`catalog-card ${selected ? 'selected' : ''}`}>
                <button className="item-choice" disabled={blocked} aria-pressed={selected} aria-label={`${selected && (stem || tab === 'effects') ? 'Remove' : 'Select'} ${item.name}`} onClick={() => select(tab, item)} title={item.note}><span className="selection-badge">{selected ? <Check size={12} /> : <Plus size={12} />}</span><Thumb category={tab} item={item} /><span className="item-name">{item.name}</span></button>
                {selected && tab !== 'effects' && <div className="item-settings">{stem && (tab === 'flowers' || tab === 'fillers') ? <div className="stepper"><button aria-label={`Remove one ${item.name}`} onClick={() => count(tab, item.id, -1)}><Minus size={12} /></button><span aria-label={`${item.name} quantity`}>{stem.count}</span><button aria-label={`Add one ${item.name}`} disabled={total(config[tab]) >= (tab === 'flowers' ? 24 : 12)} onClick={() => count(tab, item.id, 1)}><Plus size={12} /></button></div> : <span className="selected-label">Selected</span>}<ColorControl value={stem?.color ?? decor!.color} label={`${item.name} color`} onChange={color => itemColor(tab, item.id, color)} /></div>}
              </div>;
            })}</div>}
          </>}
        </div>
        <div className="arrangement-controls"><div className="slider-control"><label htmlFor="flower-size">Flower size<span>{Math.round(config.size * 100)}%</span></label><input id="flower-size" type="range" min="0.8" max="1.2" step="0.02" value={config.size} onChange={e => update(c => ({ ...c, size: Number(e.target.value) }))} /></div><div className="slider-control"><label htmlFor="spread">Spread<span>{config.spread < .95 ? 'Cozy' : config.spread > 1.05 ? 'Airy' : 'Balanced'}</span></label><input id="spread" type="range" min="0.8" max="1.2" step="0.02" value={config.spread} onChange={e => update(c => ({ ...c, spread: Number(e.target.value) }))} /></div></div>
        <div className="builder-footer"><span><Heart size={13} /> No perfect way. Just your way.</span><button className="quiet-button" onClick={() => { setConfig({ ...clone(starter), gift: config.gift }); setNotice('Back to the first little blooms.'); }} aria-label="Reset bouquet">Reset</button></div>
      </section>
    </main> : <main className={`gift-page ${opened ? 'opened' : ''}`}>
      {!opened ? <div className="gift-cover"><span className="eyebrow">A LITTLE SOMETHING{config.gift.to ? ` FOR ${config.gift.to.toUpperCase()}` : ' FOR YOU'}</span><div className="gift-illustration"><Gift size={96} strokeWidth={1} /><span>✿</span></div><h1>Someone picked<br /><em>a little joy for you.</em></h1><p>{config.gift.from ? `With love, ${config.gift.from}` : 'A bouquet made just to make you smile.'}</p><button className="primary-button" onClick={() => { setOpened(true); setReplay(value => value + 1); }}><Gift size={18} /> Tap to open</button><span className="gift-cover-note">No watering required. Smiles encouraged.</span></div> : <>
        <div className="gift-heading"><span className="eyebrow">A LITTLE JOY, JUST FOR YOU</span><h1>{config.gift.title.trim() || (config.gift.to ? <>For <em>{config.gift.to}</em></> : <>You deserve <em>these blooms.</em></>)}</h1>{config.gift.title.trim() && config.gift.to && <p className="gift-recipient">For {config.gift.to}</p>}</div>
        <div className="gift-scene" style={{ '--scene-color': palette.background } as React.CSSProperties}>{failed ? <PreviewUnavailable config={config} retry={() => setFailed(false)} /> : <Suspense fallback={<div className="scene-loading">Growing something lovely…</div>}><Viewer config={config} motion={motion} replay={replay} onReady={onReady} onFailure={onFailure} onDirection={setDirection} openNote={openNote} /></Suspense>}{frontGuide}<div className="gift-scene-tools"><button className="icon-button" aria-label="Reset view" onClick={() => viewer.current?.reset()}><RotateCcw size={18} /></button><button className="icon-button" aria-label={motionEnabled ? 'Pause motion' : 'Enable motion'} disabled={reduced} onClick={() => setMotionEnabled(value => !value)}>{motion ? <Pause size={18} /> : <Play size={18} />}</button><button className="icon-button" aria-label="Replay effects" onClick={() => setReplay(v => v + 1)}><RefreshCw size={18} /></button></div></div>
        {config.objects.some(o => o.id === 'sealed-envelope') && <div className="gift-envelope-actions" aria-label="Letters in this bouquet">{config.objects.filter(o => o.id === 'sealed-envelope').map((o, i) => <button key={o.uid} className="secondary-button" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); openNote(o.uid, { x: r.x + r.width / 2, y: r.y + r.height / 2 }); }}><Mail size={16} />{config.objects.filter(o => o.id === 'sealed-envelope').length > 1 ? `Open letter ${i + 1}` : 'Open your letter'}</button>)}</div>}
        {(config.gift.message || config.gift.from) && <div className="gift-letter">{config.gift.message && <p>{config.gift.message}</p>}{config.gift.from && <span>With love, <strong>{config.gift.from}</strong><Heart size={14} /></span>}</div>}
        <div className="gift-bottom-actions"><button className="quiet-button" onClick={exportCard} disabled={!canExport || exporting}><Download size={17} /> {exporting ? 'Saving…' : 'Keep this bouquet'}</button><button className="primary-button" onClick={goEditor}><WandSparkles size={17} /> Remix bouquet</button></div>
      </>}
    </main>}
    {mode === 'editor' && !loadingShared && <MobileStudioNav hasDesign={hasDesign} previewGift={giftPreview} flowerFocused={flowerFocused} showBouquet={() => { setFlowerFocus(false); requestAnimationFrame(() => scrollStudioTo('bouquet-preview')); }} customize={() => { if (tab === 'flowers' && arrangingFlowers) setFlowerFocus(true); else scrollStudioTo('builder-navigation'); }} />}
    {envelope && openEnvelope && <EnvelopeNote key={envelope.uid} object={envelope} origin={openEnvelope.origin} editable={mode === 'editor'} reduced={reduced || !motionEnabled} close={() => setOpenEnvelope(null)} save={note => { setConfig(c => ({ ...c, objects: c.objects.map(o => o.uid === envelope.uid ? { ...o, note } : o) })); setOpenEnvelope(null); setNotice('Your note is saved and sealed with love.'); }} />}
    <footer className="site-footer"><span>Little blooms. Big feelings.</span><span>Made for sharing <Heart size={12} /></span></footer>
    {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}
    {modal === 'presets' && <Modal title="A little inspiration" onClose={() => setModal(null)} className="presets-modal"><p className="modal-description">Pick a starting point. Make it your own.</p><div className="preset-grid">{presets.map(p => <button key={p.name} className="preset-card" onClick={() => { setConfig({ ...clone(p.config), objects: config.objects, gift: config.gift }); setReplay(v => v + 1); setModal(null); }}><div className="preset-art" style={{ background: palettes.find(pal => pal.id === p.config.palette)!.background }}>{p.config.flowers.slice(0, 3).map((f, i) => <span key={f.id} style={{ transform: `rotate(${(i - 1) * 17}deg)` }}><Thumb category="flowers" item={findItem('flowers', f.id)} color={f.color} /></span>)}</div><strong>{p.name}</strong><span>{p.note}</span></button>)}</div></Modal>}
    {modal === 'share' && <Modal title="Send a little joy" onClose={() => setModal(null)} className="share-modal"><div className="share-ornament"><Send size={26} strokeWidth={1.2} /></div><p className="modal-description">Give your bouquet a title and a personal message.</p><GiftCopyFields gift={config.gift} onChange={updateGiftCopy} /><label className="share-link-label">Your bouquet link<input ref={shareInput} className="share-link" value={linkPending ? '' : link?.url ?? ''} placeholder="Preparing your link…" readOnly onFocus={e => e.target.select()} /></label><p className={`link-status ${!linkPending && link && !link.short ? 'portable' : ''}`} role="status">{linkPending ? 'Saving your gift and preparing a short link…' : link?.short ? `Short link ready · ${link.url.length} characters, pictures included` : 'Portable link ready. Short links are unavailable here, so the gift is included in the URL.'}</p><div className="share-actions"><button className="primary-button" disabled={linkPending || !link} onClick={copyLink}>{shareCopied ? <Check size={17} /> : <Copy size={17} />}{shareCopied ? 'Link copied!' : 'Copy link'}</button>{typeof navigator.share === 'function' && <button className="secondary-button" disabled={linkPending || !link} onClick={nativeShare}><Share2 size={17} /> Share via…</button>}</div><p className="share-note">They’ll open your gift and can remix their own. Anyone with the link can see the bouquet, names, title, body{config.objects.some(o => o.note) ? ', envelope notes' : ''}{config.objects.some(o => o.photo) ? ' and frame pictures' : ''}.{!linkPending && link?.short && ' This link keeps a saved copy; later edits won’t change their gift.'}{!linkPending && link && !link.short && config.objects.some(o => o.photo) && ' Photos make portable links longer.'}</p></Modal>}
  </div>;
}
