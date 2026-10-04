import * as T from 'three';
import { createGiftModel, disposeGiftModel, samplePhotoTexture } from './giftModels';
import { giftAssets, isFrame, frameOrientation, frameShape, objectSize, type GiftObject } from './giftCatalog';
import { photoCanvas } from './objectPhotos';

interface Entry { model: T.Group; id: string; orientation?: string; photo?: string; cropKey?: string; color?: string; photoError: boolean; }
/** Object identity survives placement edits: dragging only updates transforms. */
export class ObjectScene {
  group = new T.Group();
  entries = new Map<string, Entry>();
  pending = new Set<Promise<void>>();
  builds = 0;
  private disposed = false;
  constructor(private changed: () => void, private photoFailed: () => void, private environment: T.Texture) { this.group.name = 'gift-objects'; }
  sync(objects: GiftObject[]) {
    const live = new Set(objects.map(o => o.uid));
    for (const [uid, entry] of this.entries) if (!live.has(uid)) { this.group.remove(entry.model); disposeGiftModel(entry.model); this.entries.delete(uid); }
    for (const object of objects) {
      const orientation = isFrame(object.id) ? frameOrientation(object.id, object.frameOrientation) : undefined;
      let entry = this.entries.get(object.uid);
      if (entry && (entry.id !== object.id || entry.orientation !== orientation)) { this.group.remove(entry.model); disposeGiftModel(entry.model); this.entries.delete(object.uid); entry = undefined; }
      if (!entry) {
        const model = createGiftModel(object.id, { color: object.color, frameOrientation: object.frameOrientation }); this.builds++;
        model.userData.objectUid = object.uid; model.name = `object-${object.uid}`;
        model.traverse(o => { if (o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial && o.material.metalness > .4) { o.material.envMap = this.environment; o.material.envMapIntensity = .6; } });
        const size = objectSize(object);
        const shadow = new T.Mesh(new T.CircleGeometry(1, 32), new T.MeshBasicMaterial({ color: '#92788a', transparent: true, opacity: .12, depthWrite: false }));
        shadow.name = 'object-shadow'; shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, .006, -.07); shadow.scale.set(size[0] * .6, size[2] * .55, 1); model.add(shadow);
        entry = { model, id: object.id, orientation, photoError: false }; this.entries.set(object.uid, entry); this.group.add(model);
      }
      entry.model.position.set(...object.position); entry.model.rotation.y = object.rotation; entry.model.scale.setScalar(object.scale);
      const color = object.color ?? giftAssets.find(a => a.id === object.id)!.color;
      if (entry.color !== color) { entry.color = color; entry.model.traverse(o => { if (o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial && o.material.userData.objectTint) o.material.color.set(color); }); }
      const cropKey = object.photo ? JSON.stringify(object.crop ?? null) : undefined;
      if (entry.photo !== object.photo || entry.cropKey !== cropKey) {
        entry.photo = object.photo; entry.cropKey = cropKey; entry.photoError = false;
        if (!isFrame(object.id)) continue;
        const target = entry, photo = object.photo;
        if (!photo) {
          // Restore the original sample without replacing the geometry.
          const mesh = target.model.getObjectByName('photo-surface') as T.Mesh, mat = mesh.material as T.MeshBasicMaterial;
          mat.map?.dispose(); mat.map = samplePhotoTexture(frameShape(object.id, object.frameOrientation).aspect); mat.needsUpdate = true; this.changed();
          continue;
        }
        const task = photoCanvas(photo, object.crop, frameShape(object.id, object.frameOrientation).aspect).then(canvas => {
          if (this.disposed || this.entries.get(object.uid) !== target || target.photo !== photo || target.cropKey !== cropKey) return;
          const texture = new T.CanvasTexture(canvas);
          texture.colorSpace = T.SRGBColorSpace; texture.name = 'custom-picture';
          const mesh = target.model.getObjectByName('photo-surface') as T.Mesh, mat = mesh.material as T.MeshBasicMaterial;
          mat.map?.dispose(); mat.map = texture; mat.needsUpdate = true; this.changed();
        }).catch(() => { if (!this.disposed && this.entries.get(object.uid) === target && target.photo === photo && target.cropKey === cropKey) { target.photoError = true; this.photoFailed(); this.changed(); } });
        this.pending.add(task); void task.finally(() => this.pending.delete(task));
      }
    }
    this.group.updateMatrixWorld(true);
  }
  async ready() {
    while (this.pending.size) await Promise.all([...this.pending]);
    if ([...this.entries.values()].some(e => e.photoError)) throw new Error('A frame picture could not be opened. Choose the picture again before saving.');
  }
  dispose() { this.disposed = true; this.entries.forEach(e => disposeGiftModel(e.model)); this.entries.clear(); this.group.clear(); }
}
