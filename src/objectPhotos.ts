import { DEFAULT_CROP, PHOTO_LIMIT, type PhotoCrop } from './giftCatalog';
/** Shared by the editor, 3D texture and exported card. Pan stops at the image edges. */
export function photoPlacement(iw: number, ih: number, width: number, height: number, crop: PhotoCrop = DEFAULT_CROP) {
  const scale = (crop.mode === 'fill' ? Math.max(width / iw, height / ih) : Math.min(width / iw, height / ih)) * crop.zoom;
  const w = iw * scale, h = ih * scale, panX = Math.max(0, (w - width) / 2), panY = Math.max(0, (h - height) / 2);
  return { x: (width - w) / 2 + crop.x * panX, y: (height - h) / 2 + crop.y * panY, w, h, panX, panY };
}
export function drawPhoto(context: CanvasRenderingContext2D, image: CanvasImageSource & { width: number; height: number }, crop: PhotoCrop = DEFAULT_CROP) {
  const { width, height } = context.canvas, p = photoPlacement(image.width, image.height, width, height, crop);
  context.fillStyle = '#fff5e6'; context.fillRect(0, 0, width, height); context.drawImage(image, p.x, p.y, p.w, p.h);
}
export async function photoCanvas(source: string, crop: PhotoCrop = DEFAULT_CROP, aspect = .8) {
  const image = new Image(); image.src = source; await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = aspect > 1 ? 400 : 320; canvas.height = Math.round(canvas.width / aspect);
  drawPhoto(canvas.getContext('2d')!, image, crop); return canvas;
}
/** A compact self-contained JPEG lets pictures persist and travel with a gift link. */
export async function prepareObjectPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP picture.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose a picture smaller than 15 MB.');
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas'), c = canvas.getContext('2d')!;
    for (const width of [320, 240, 160]) {
      const scale = Math.min(1, width / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
      c.fillStyle = '#fff5e6'; c.fillRect(0, 0, canvas.width, canvas.height);
      c.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [.86, .68, .5, .32]) {
        const data = canvas.toDataURL('image/jpeg', quality); if (data.length <= PHOTO_LIMIT) return data;
      }
    }
    throw new Error('This picture could not be prepared. Please try a different picture.');
  } finally { image.close(); }
}
