import { useEffect, useRef, useState } from 'react';
import { Check, Crop, Move, RotateCcw, X } from 'lucide-react';
import { DEFAULT_CROP, type PhotoCrop } from './giftCatalog';
import { drawPhoto, photoPlacement } from './objectPhotos';

export function PhotoCropEditor({ source, color, aspect = .8, frameId = 'standing-frame', initial, apply, close }: { source: string; color: string; aspect?: number; frameId?: string; initial?: PhotoCrop; apply: (crop: PhotoCrop) => void; close: () => void }) {
  const width = aspect > 1 ? 400 : 320, height = Math.round(width / aspect);
  const [crop, setCrop] = useState<PhotoCrop>(() => ({ ...(initial ?? DEFAULT_CROP) }));
  const [image, setImage] = useState<HTMLImageElement | null>(null), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ pointer: number; x: number; y: number; crop: PhotoCrop } | null>(null);
  useEffect(() => { const node = dialog.current!; node.showModal(); return () => node.close(); }, []);
  useEffect(() => { let live = true; const photo = new Image(); photo.src = source; void photo.decode().then(() => { if (live) setImage(photo); }).catch(() => { if (live) setError('This picture could not be opened. Choose another picture.'); }); return () => { live = false; }; }, [source]);
  useEffect(() => { if (image && canvas.current) drawPhoto(canvas.current.getContext('2d')!, image, crop); }, [image, crop, width, height]);
  const clamp = (n: number) => Math.min(1, Math.max(-1, n));
  return <dialog ref={dialog} className="modal crop-modal" aria-label="Crop frame picture" onCancel={close}>
    <div className="modal-top"><h2><Crop size={22} /> Frame your moment</h2><button className="icon-button" aria-label="Cancel cropping" onClick={close}><X size={20} /></button></div>
    <p className="modal-description">See exactly what fits. Drag the picture to move it.</p>
    <div className="crop-stage"><div className={`crop-frame ${frameId}`} style={{ '--frame-color': color } as React.CSSProperties}><div className="crop-mat"><canvas ref={canvas} width={width} height={height} style={{ aspectRatio: String(aspect), ...(aspect > 1 ? { width: "min(240px, 56vw)" } : {}) }} tabIndex={0} role="img" aria-label="Framed crop preview. Drag or use arrow keys to move the picture" onPointerDown={e => { if (e.button !== 0 || !image) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, crop }; }} onPointerMove={e => { const start = drag.current; if (!start || start.pointer !== e.pointerId || !image) return; const p = photoPlacement(image.width, image.height, width, height, start.crop), r = e.currentTarget.getBoundingClientRect(); setCrop({ ...start.crop, x: p.panX ? clamp(start.crop.x + (e.clientX - start.x) * width / r.width / p.panX) : 0, y: p.panY ? clamp(start.crop.y + (e.clientY - start.y) * height / r.height / p.panY) : 0 }); }} onPointerUp={e => { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={e => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); setCrop(c => ({ ...c, x: clamp(c.x + (e.key === 'ArrowLeft' ? -.05 : e.key === 'ArrowRight' ? .05 : 0)), y: clamp(c.y + (e.key === 'ArrowUp' ? -.05 : e.key === 'ArrowDown' ? .05 : 0)) })); }} /></div></div><span className="crop-caption"><Move size={13} /> Your frame, in preview</span></div>
    {error && <p role="alert" className="crop-error">{error}</p>}
    <div className="crop-fit-controls" aria-label="Picture fit"><button className={`secondary-button ${crop.mode === 'fit' ? 'active' : ''}`} aria-pressed={crop.mode === 'fit'} onClick={() => setCrop({ ...DEFAULT_CROP })}>Fit whole picture</button><button className={`secondary-button ${crop.mode === 'fill' ? 'active' : ''}`} aria-pressed={crop.mode === 'fill'} onClick={() => setCrop({ ...DEFAULT_CROP, mode: 'fill' })}>Fill the frame</button></div>
    <label className="crop-zoom">Zoom <input aria-label="Crop zoom" type="range" min="1" max="4" step="0.01" value={crop.zoom} onChange={e => setCrop(c => ({ ...c, zoom: Number(e.target.value) }))} /><output>{Math.round(crop.zoom * 100)}%</output></label>
    <div className="crop-actions"><button className="quiet-button" onClick={() => setCrop({ ...DEFAULT_CROP })}><RotateCcw size={15} /> Reset crop</button><button className="primary-button" disabled={!image || !!error} onClick={() => apply(crop)}><Check size={16} /> Apply crop</button></div>
    <p className="crop-note">Your original picture is kept so you can crop it again.</p>
  </dialog>;
}
