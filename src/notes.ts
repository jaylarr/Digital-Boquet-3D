export const NOTE_LIMIT = 1500, NOTE_RUN_LIMIT = 128;
export const noteFonts = {
  serif: { name: 'Classic', family: 'Georgia, serif' },
  sans: { name: 'Modern', family: 'Arial, sans-serif' },
  handwritten: { name: 'Handwritten', family: '"Segoe Print", "Bradley Hand", cursive' },
  mono: { name: 'Typewriter', family: '"Courier New", monospace' },
} as const;
export const noteSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36] as const;
export interface NoteRun {
  text: string; font?: keyof typeof noteFonts; size?: number; color?: string;
  bold?: boolean; italic?: boolean; underline?: boolean;
}
export interface NoteDocument { runs: NoteRun[]; align: 'left' | 'center' | 'right'; }
export const emptyNote = (): NoteDocument => ({ runs: [], align: 'left' });
export const noteText = (note?: NoteDocument) => note?.runs.map(r => r.text).join('') ?? '';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Only plain text and bounded style values cross draft/share boundaries. No HTML. */
export function validateNote(value: unknown): NoteDocument {
  if (!record(value) || !['left', 'center', 'right'].includes(value.align as string) || !Array.isArray(value.runs) || value.runs.length > NOTE_RUN_LIMIT) throw new Error('This envelope has an invalid note.');
  let length = 0;
  const runs = value.runs.map((v): NoteRun => {
    if (!record(v) || typeof v.text !== 'string') throw new Error('This envelope has an invalid note.');
    length += Array.from(v.text).length;
    if (length > NOTE_LIMIT) throw new Error(`Envelope notes can contain up to ${NOTE_LIMIT} characters.`);
    if (v.font !== undefined && !Object.hasOwn(noteFonts, v.font as string) || v.size !== undefined && !noteSizes.some(s => s === v.size) || v.color !== undefined && (typeof v.color !== 'string' || !/^#[a-f0-9]{6}$/i.test(v.color)) || ['bold', 'italic', 'underline'].some(k => v[k] !== undefined && typeof v[k] !== 'boolean')) throw new Error('This envelope has invalid text formatting.');
    return { text: v.text, ...(v.font !== undefined ? { font: v.font as NoteRun['font'] } : {}), ...(v.size !== undefined ? { size: v.size as number } : {}), ...(v.color !== undefined ? { color: v.color as string } : {}), ...(v.bold ? { bold: true } : {}), ...(v.italic ? { italic: true } : {}), ...(v.underline ? { underline: true } : {}) };
  });
  return { runs, align: value.align as NoteDocument['align'] };
}
export function runStyle(run: NoteRun) {
  return { fontFamily: noteFonts[run.font ?? 'serif'].family, fontSize: `${run.size ?? 20}px`, color: run.color ?? '#614653', fontWeight: run.bold ? '700' : '400', fontStyle: run.italic ? 'italic' : 'normal', textDecoration: run.underline ? 'underline' : 'none' };
}
/** Build editor DOM using textContent, including text that resembles markup. */
export function writeNote(element: HTMLElement, note: NoteDocument) {
  element.replaceChildren();
  for (const run of note.runs) {
    const span = document.createElement('span'); span.textContent = run.text;
    Object.assign(span.style, runStyle(run)); element.append(span);
  }
}
/** Normalize native rich-text editing to the same safe format used by the reader. */
export function readNote(element: HTMLElement, align: NoteDocument['align']): NoteDocument {
  const runs: NoteRun[] = [];
  function push(text: string, style: Omit<NoteRun, 'text'>) {
    if (!text) return;
    const last = runs.at(-1);
    if (last && JSON.stringify({ ...last, text: '' }) === JSON.stringify({ text: '', ...style })) last.text += text;
    else runs.push({ text, ...style });
  }
  function visit(node: Node, inherited: Omit<NoteRun, 'text'>, root = false) {
    if (node.nodeType === Node.TEXT_NODE) { push(node.textContent ?? '', inherited); return; }
    if (!(node instanceof HTMLElement) || ['SCRIPT', 'STYLE', 'IFRAME', 'IMG', 'OBJECT', 'SVG'].includes(node.tagName)) return;
    if (node.tagName === 'BR') { push('\n', inherited); return; }
    const style = { ...inherited }, css = node.style;
    if (['B', 'STRONG'].includes(node.tagName)) style.bold = true;
    if (['I', 'EM'].includes(node.tagName)) style.italic = true;
    if (node.tagName === 'U') style.underline = true;
    if (css.fontWeight) style.bold = css.fontWeight === 'bold' || Number(css.fontWeight) >= 600;
    if (css.fontStyle) style.italic = css.fontStyle === 'italic';
    // Decorations propagate through descendants even when a child has `none`.
    if (css.textDecoration.includes('underline') || css.textDecorationLine.includes('underline')) style.underline = true;
    const family = css.fontFamily || node.getAttribute('face');
    if (family) {
      const normalized = family.replace(/["']/g, '').toLowerCase();
      const font = Object.entries(noteFonts).find(([, f]) => normalized.includes(f.family.split(',')[0].replace(/["']/g, '').toLowerCase()));
      if (font) style.font = font[0] as NoteRun['font'];
    }
    if (css.fontSize) { const size = parseFloat(css.fontSize); if (noteSizes.some(s => s === size)) style.size = size; }
    const color = css.color || node.getAttribute('color');
    if (color) {
      const rgb = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
      if (rgb) style.color = '#' + rgb.slice(1).map(n => Number(n).toString(16).padStart(2, '0')).join('');
      else if (/^#[a-f0-9]{6}$/i.test(color)) style.color = color;
    }
    const block = !root && ['DIV', 'P'].includes(node.tagName);
    if (block && runs.length && !runs.at(-1)!.text.endsWith('\n')) push('\n', inherited);
    node.childNodes.forEach(child => visit(child, style));
    if (block && node.nextSibling && !runs.at(-1)?.text.endsWith('\n')) push('\n', inherited);
  }
  visit(element, {}, true);
  return validateNote({ runs, align });
}
