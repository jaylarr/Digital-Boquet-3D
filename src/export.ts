import type { BouquetConfigV1 } from './config';
import { palettes } from './catalog';
export function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    // Graphemes preserve emoji sequences; character wrapping also supports languages without spaces.
    const parts = typeof Intl.Segmenter !== 'undefined' ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(paragraph)].map(p => p.segment) : Array.from(paragraph);
    for (const part of parts) { if (line && context.measureText(line + part).width > maxWidth) { const lastSpace = line.lastIndexOf(' '); if (lastSpace > line.length * .5) { lines.push(line.slice(0, lastSpace)); line = line.slice(lastSpace + 1) + part; } else { lines.push(line); line = part; } } else line += part; }
    lines.push(line);
  }
  return lines;
}
export async function giftCard(image: HTMLCanvasElement, config: BouquetConfigV1) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = palettes.find(p => p.id === config.palette)!.background; ctx.fillRect(0, 0, 1080, 1080);
  ctx.textAlign = 'center'; ctx.fillStyle = '#503d49'; ctx.font = '600 32px system-ui, sans-serif';
  const title = config.gift.to ? `For ${config.gift.to.replace(/\s+/g, ' ').trim()}` : 'A little joy, in bloom';
  const titleLines = wrapText(ctx, title, 940);
  titleLines.forEach((line, i) => ctx.fillText(line, 540, 72 + i * 40));
  ctx.font = '24px system-ui, sans-serif';
  const lines = config.gift.message.trim() ? wrapText(ctx, config.gift.message.replace(/\s+/g, ' ').trim(), 930) : [];
  ctx.font = '600 22px system-ui, sans-serif';
  const fromLines = config.gift.from ? wrapText(ctx, `With love, ${config.gift.from.replace(/\s+/g, ' ').trim()}`, 930) : [];
  const textHeight = lines.length * 32 + (fromLines.length ? fromLines.length * 26 + 30 : 0);
  const top = 90 + titleLines.length * 40, bottom = 1000 - textHeight;
  const available = bottom - top - 24;
  const imageSize = Math.min(available, 800); ctx.drawImage(image, (1080 - imageSize) / 2, top + (available - imageSize) / 2, imageSize, imageSize);
  ctx.font = '24px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, 540, bottom + i * 32));
  if (fromLines.length) { ctx.font = '600 22px system-ui, sans-serif'; fromLines.forEach((line, i) => ctx.fillText(line, 540, bottom + lines.length * 32 + 30 + i * 26)); }
  ctx.fillStyle = '#856b7b'; ctx.font = '16px system-ui, sans-serif'; ctx.fillText('petalpop 3d', 540, 1050);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The image couldn’t be created. Please try again.')), 'image/png'));
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'petalpop-bouquet.png'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 30000);
  return blob;
}
