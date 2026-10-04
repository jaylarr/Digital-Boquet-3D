import { useEffect, useRef, useState } from 'react';
import { Plus, X, MousePointer2, RotateCcw, ImagePlus, Copy, Crop, Mail } from 'lucide-react';
import { createGiftObject, giftAssets, isFrame, frameShape, frameOrientation, OBJECT_BOUNDS, OBJECT_FLOOR, OBJECT_LIMIT, PHOTO_TOTAL_LIMIT, type GiftObject } from './giftCatalog';
import { prepareObjectPhoto } from './objectPhotos';
import { ColorControl } from './ColorControl';
import { PhotoCropEditor } from './PhotoCropEditor';
import { noteText } from './notes';
import './frames.css';
import { scrollStudioTo } from './MobileStudioNav';

interface Props { objects: GiftObject[]; selected: string | null; placing: boolean; select: (uid: string | null) => void; change: (fn: (objects: GiftObject[]) => GiftObject[]) => void; place: (value: boolean) => void; notice: (message: string) => void; openNote: (uid: string) => void; }
export function ObjectsPanel({ objects, selected, placing, select, change, place, notice, openNote }: Props) {
  const active = objects.find(o => o.uid === selected), asset = giftAssets.find(a => a.id === active?.id);
  const [uploading, setUploading] = useState<string | null>(null), uploadVersion = useRef(0);
  const [editingPhoto, setEditingPhoto] = useState<{ uid: string; source: string; crop?: GiftObject['crop'] } | null>(null);
  const latestObjects = useRef(objects); latestObjects.current = objects;
  useEffect(() => () => { uploadVersion.current++; }, []);
  function patch(uid: string, values: Partial<GiftObject>) { change(current => current.map(o => o.uid === uid ? { ...o, ...values } : o)); }
  function selectForEditing(uid: string) { select(uid); place(false); requestAnimationFrame(() => scrollStudioTo('selected-object-controls')); }
  function add(id: GiftObject['id']) { if (objects.length >= OBJECT_LIMIT) return; const object = createGiftObject(id, objects); change(current => current.length < OBJECT_LIMIT ? [...current, object] : current); selectForEditing(object.uid); }
  async function upload(file: File, uid: string) {
    const version = ++uploadVersion.current; setUploading(uid);
    try {
      const photo = await prepareObjectPhoto(file); if (version !== uploadVersion.current) return;
      const current = latestObjects.current; if (!current.some(o => o.uid === uid)) return;
      const others = current.reduce((n, o) => n + (o.uid === uid ? 0 : o.photo?.length ?? 0), 0);
      if (others + photo.length > PHOTO_TOTAL_LIMIT) { notice('Remove another frame picture before adding this one.'); return; }
      setEditingPhoto({ uid, source: photo });
    } catch (e) { if (version === uploadVersion.current) notice(e instanceof Error ? e.message : 'This picture could not be opened.'); }
    finally { if (version === uploadVersion.current) setUploading(null); }
  }
  const cropObject = editingPhoto ? objects.find(o => o.uid === editingPhoto.uid) : undefined;
  return <div className="objects-panel">
    <div className="object-catalog">{giftAssets.map(a => <button key={a.id} className="object-add" aria-label={`Add ${a.name}`} disabled={objects.length >= OBJECT_LIMIT} onClick={() => add(a.id)} title={a.note}><img src={`${import.meta.env.BASE_URL}models/${a.id}.png`} alt="" draggable={false} /><span>{a.name}</span><Plus size={14} /></button>)}</div>
    {!!objects.length && <div className="object-list" aria-label="Objects in your bouquet">{objects.map((o, i) => <div key={o.uid} className={`object-row ${selected === o.uid ? 'active' : ''}`}><button aria-label={`Edit ${giftAssets.find(a => a.id === o.id)!.name} ${i + 1}`} aria-pressed={selected === o.uid} onClick={() => selectForEditing(o.uid)}><span className="object-index">{i+1}</span><span>{giftAssets.find(a => a.id === o.id)!.name}</span></button><button className="icon-button" aria-label={`Remove ${giftAssets.find(a => a.id === o.id)!.name} ${i + 1}`} onClick={() => { change(current => current.filter(item => item.uid !== o.uid)); if (selected === o.uid) { select(null); place(false); } }}><X size={14} /></button></div>)}</div>}
    {active && asset ? <div className="object-controls" id="selected-object-controls" aria-label={`${asset.name} placement`}>
      <div className="object-control-heading"><strong>{asset.name}</strong><button className="quiet-button" aria-label="Duplicate selected object" disabled={objects.length >= OBJECT_LIMIT} onClick={() => { const copy = createGiftObject(active.id, objects); copy.photo = active.photo; copy.crop = active.crop ? { ...active.crop } : undefined; copy.color = active.color; copy.frameOrientation = active.frameOrientation; copy.note = active.note ? structuredClone(active.note) : undefined; if (objects.reduce((sum, o) => sum + (o.photo?.length ?? 0), 0) + (copy.photo?.length ?? 0) > PHOTO_TOTAL_LIMIT) { notice('Remove another frame picture before duplicating this frame.'); return; } copy.rotation = active.rotation; copy.scale = active.scale; change(current => [...current, copy]); selectForEditing(copy.uid); }}><Copy size={14} /> Duplicate</button></div>
      {active.id === 'sealed-envelope' && <div className="object-note-tools"><button className="secondary-button" onClick={() => openNote(active.uid)}><Mail size={16} />{noteText(active.note) ? 'Open & edit note' : 'Open & write a note'}</button><p className="object-note-summary">{noteText(active.note) || 'Sealed with a little love. Click the envelope to open it; drag to move it.'}</p></div>}
      {isFrame(active.id) && <div className="frame-orientation" role="group" aria-label="Frame orientation"><span>Orientation</span><div>{(['portrait', 'landscape'] as const).map(orientation => <button key={orientation} className={frameOrientation(active.id, active.frameOrientation) === orientation ? 'active' : ''} aria-pressed={frameOrientation(active.id, active.frameOrientation) === orientation} onClick={() => patch(active.uid, { frameOrientation: orientation })}>{orientation === 'portrait' ? 'Portrait' : 'Landscape'}</button>)}</div></div>}
      <div className="object-color-row"><span>Make it your color</span><ColorControl value={active.color ?? asset.color} label={`${asset.name} color`} onChange={color => patch(active.uid, { color })} /></div>
      <button className={`secondary-button full-width ${placing ? 'placing' : ''}`} aria-pressed={placing} onClick={() => place(!placing)}><MousePointer2 size={15} />{placing ? 'Cancel placement' : 'Tap a spot to place'}</button>
      <p className="object-help">{placing ? 'Tap the grid in the preview. Your object stays at its chosen height.' : 'Drag the object in the preview, or fine-tune its position below.'}</p>
      <div className="object-position-controls">{(['x', 'y', 'z'] as const).map((axis, i) => <label key={axis}>{['Left / right', 'Height', 'Back / front'][i]}<input type="range" aria-label={`Object ${['horizontal position', 'height', 'depth'][i]}`} min={OBJECT_BOUNDS[axis][0]} max={OBJECT_BOUNDS[axis][1]} step="0.01" value={active.position[i]} onChange={e => { const position: GiftObject['position'] = [...active.position]; position[i] = Number(e.target.value); patch(active.uid, { position }); }} /><output>{active.position[i].toFixed(2)}</output></label>)}</div>
      <div className="object-finish-controls"><label>Turn<input aria-label="Object rotation" type="range" min="-180" max="180" step="1" value={Math.round(active.rotation * 180 / Math.PI)} onChange={e => patch(active.uid, { rotation: Number(e.target.value) * Math.PI / 180 })} /><output>{Math.round(active.rotation * 180 / Math.PI)}°</output></label><label>Size<input aria-label="Object size" type="range" min="0.35" max="1.25" step="0.01" value={active.scale} onChange={e => patch(active.uid, { scale: Number(e.target.value) })} /><output>{Math.round(active.scale * 100)}%</output></label></div>
      <button className="quiet-button" onClick={() => patch(active.uid, { position: [active.position[0], OBJECT_FLOOR, active.position[2]] })}><RotateCcw size={14} /> Set on the ground</button>
      {isFrame(active.id) && <div className="object-photo-tools"><label className="object-photo-upload"><ImagePlus size={17} />{uploading === active.uid ? 'Preparing picture…' : active.photo ? 'Change picture' : 'Choose your picture'}<input type="file" aria-label="Frame picture" accept="image/jpeg,image/png,image/webp" disabled={!!uploading} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file, active.uid); e.target.value = ''; }} /></label><p>JPG, PNG or WebP · up to 15 MB. Preview and crop your picture inside the frame.</p>{active.photo && <div className="object-photo-actions"><button className="secondary-button" onClick={() => setEditingPhoto({ uid: active.uid, source: active.photo!, crop: active.crop })}><Crop size={15} /> Adjust crop</button><button className="quiet-button" onClick={() => { uploadVersion.current++; setUploading(null); change(current => current.map(o => { if (o.uid !== active.uid) return o; const copy = { ...o }; delete copy.photo; delete copy.crop; return copy; })); }}>Use sample picture</button></div>}</div>}
    </div> : <p className="object-help">{objects.length ? 'Select an object above or in the preview to move it.' : 'Add a little companion, then place it anywhere around your bouquet.'}</p>}
    {editingPhoto && cropObject && <PhotoCropEditor source={editingPhoto.source} initial={editingPhoto.crop} frameId={cropObject.id} aspect={frameShape(cropObject.id, cropObject.frameOrientation).aspect} color={cropObject.color ?? giftAssets.find(a => a.id === cropObject.id)!.color} close={() => setEditingPhoto(null)} apply={crop => { const others = latestObjects.current.reduce((n, o) => n + (o.uid === editingPhoto.uid ? 0 : o.photo?.length ?? 0), 0); if (others + editingPhoto.source.length > PHOTO_TOTAL_LIMIT) { notice('Remove another frame picture before adding this one.'); return; } patch(editingPhoto.uid, { photo: editingPhoto.source, crop }); setEditingPhoto(null); notice('Picture framed. You can adjust the crop anytime.'); }} />}
  </div>;
}
