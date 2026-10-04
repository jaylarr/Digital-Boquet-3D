import { useEffect, useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { frameShape, giftAssets, type GiftObject } from './giftCatalog';
import { photoCanvas } from './objectPhotos';

export function FramePictureDialog({ object, uploading, error, upload, close }: { object: GiftObject; uploading: boolean; error: string; upload: (file: File) => void; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null), preview = useRef<HTMLCanvasElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const asset = giftAssets.find(a => a.id === object.id)!, aspect = frameShape(object.id, object.frameOrientation).aspect;
  useEffect(() => {
    const node = dialog.current!, root = document.documentElement, overflow = root.style.overflow;
    node.showModal(); root.style.overflow = 'hidden'; changeButton.current?.focus();
    return () => { node.close(); root.style.overflow = overflow; };
  }, []);
  useEffect(() => {
    let live = true;
    void (async () => {
      if (object.photo) return photoCanvas(object.photo, object.crop, aspect);
      const { samplePhotoTexture } = await import('./giftModels');
      const texture = samplePhotoTexture(aspect), canvas = texture.image as HTMLCanvasElement;
      texture.dispose(); return canvas;
    })().then(canvas => { if (live && preview.current) { preview.current.width = canvas.width; preview.current.height = canvas.height; preview.current.getContext('2d')!.drawImage(canvas, 0, 0); } }).catch(() => {});
    return () => { live = false; };
  }, [object.photo, object.crop, aspect]);
  return <dialog ref={dialog} className="modal frame-picture-modal" aria-label="Choose frame picture" onCancel={close} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }}>
    <div className="modal-top"><h2>Your {asset.name}</h2><button className="icon-button" aria-label="Close frame picture dialog" onClick={close}><X size={20} /></button></div>
    <p className="modal-description">Add a moment to your bouquet, or keep the sample for now.</p>
    <div className="crop-stage"><div className={`crop-frame ${object.id}`} style={{ '--frame-color': object.color ?? asset.color } as React.CSSProperties}><div className="crop-mat"><canvas ref={preview} role="img" aria-label={`${asset.name} picture preview`} style={{ aspectRatio: String(aspect) }} /></div></div></div>
    {error && <p className="crop-error" role="alert">{error}</p>}
    <input ref={input} className="frame-picture-input" type="file" tabIndex={-1} aria-label="Frame picture" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ''; }} />
    <button ref={changeButton} className="primary-button full-width" disabled={uploading} onClick={() => input.current?.click()}><ImagePlus size={17} />{uploading ? 'Preparing picture…' : 'Change picture'}</button>
    <button className="quiet-button full-width frame-picture-later" onClick={close}>{object.photo ? 'Keep this picture' : 'Keep sample picture'}</button>
    <p className="crop-note">JPG, PNG or WebP · up to 15 MB. You can change it anytime.</p>
  </dialog>;
}
