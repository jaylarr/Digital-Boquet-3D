import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Check, Heart, Italic, Mail, Underline, X } from 'lucide-react';
import { emptyNote, NOTE_LIMIT, noteFonts, noteSizes, noteText, readNote, runStyle, writeNote, type NoteDocument } from './notes';
import type { GiftObject } from './giftCatalog';
import './notes.css';

export interface NoteOrigin { x: number; y: number; }
export function EnvelopeArt({ color }: { color: string }) {
  return <div className="letter-envelope" style={{ '--envelope-color': color } as CSSProperties} aria-hidden="true"><div className="letter-envelope-back" /><div className="letter-envelope-paper"><span /><span /><span /><Heart size={18} /></div><div className="letter-envelope-pocket" /><div className="letter-envelope-flap" /><div className="letter-envelope-seal"><Heart size={18} fill="currentColor" /></div></div>;
}
export function EnvelopeNote({ object, origin, editable, reduced, close, save }: { object: GiftObject; origin?: NoteOrigin; editable: boolean; reduced: boolean; close: () => void; save: (note: NoteDocument) => void }) {
  const [note, setNote] = useState<NoteDocument>(() => object.note ?? emptyNote());
  const [revealed, setRevealed] = useState(reduced), [error, setError] = useState('');
  const [font, setFont] = useState<keyof typeof noteFonts>('serif'), [size, setSize] = useState(20), [color, setColor] = useState('#614653');
  const [marks, setMarks] = useState({ bold: false, italic: false, underline: false });
  const dialog = useRef<HTMLDialogElement>(null), editor = useRef<HTMLDivElement>(null), selection = useRef<Range | null>(null);
  const initial = useRef(note), fontSize = useRef(size), composing = useRef(false);
  fontSize.current = size;
  useEffect(() => {
    const node = dialog.current!, previous = document.activeElement as HTMLElement | null;
    node.showModal();
    const timer = window.setTimeout(() => setRevealed(true), reduced ? 0 : 1650);
    return () => { clearTimeout(timer); node.close(); previous?.focus(); };
  }, [reduced]);
  useEffect(() => {
    if (!revealed || !editable || !editor.current) return;
    writeNote(editor.current, initial.current);
    editor.current.focus();
    const changed = () => {
      const s = window.getSelection();
      if (s?.rangeCount && editor.current?.contains(s.anchorNode) && editor.current.contains(s.focusNode)) {
        selection.current = s.getRangeAt(0).cloneRange();
        setMarks({ bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline') });
        const node = s.anchorNode instanceof HTMLElement ? s.anchorNode : s.anchorNode?.parentElement;
        if (node && node !== editor.current) {
          const css = getComputedStyle(node), normalized = css.fontFamily.replace(/["']/g, '').toLowerCase();
          const active = Object.entries(noteFonts).find(([, f]) => normalized.includes(f.family.split(',')[0].replace(/["']/g, '').toLowerCase()));
          if (active) setFont(active[0] as keyof typeof noteFonts);
          const px = parseFloat(css.fontSize); if (noteSizes.some(n => n === px)) setSize(px);
          const rgb = css.color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/); if (rgb) setColor('#' + rgb.slice(1).map(n => Number(n).toString(16).padStart(2, '0')).join(''));
        }
      }
    };
    document.addEventListener('selectionchange', changed);
    return () => document.removeEventListener('selectionchange', changed);
  }, [revealed, editable]);
  function normalizeSize() { editor.current?.querySelectorAll<HTMLElement>('font[size="7"], span').forEach(node => { if (node.getAttribute('size') === '7' || ['xxx-large', '48px'].includes(node.style.fontSize)) { node.style.fontSize = `${fontSize.current}px`; node.removeAttribute('size'); } }); }
  function inlineTypingStyle() {
    const node = editor.current; if (!node?.textContent) return;
    const keys = ['fontFamily', 'fontSize', 'color', 'fontWeight', 'fontStyle', 'textDecoration'] as const;
    if (!keys.some(key => node.style[key])) return;
    const s = window.getSelection(), old = s?.rangeCount ? s.getRangeAt(0) : null;
    const endpoints = old ? { start: old.startContainer, startOffset: old.startOffset, end: old.endContainer, endOffset: old.endOffset } : null;
    const span = document.createElement('span');
    for (const key of keys) { span.style[key] = node.style[key]; node.style[key] = ''; }
    span.append(...node.childNodes); node.append(span);
    // Keep the caret in the same text node when the initial typing styles become inline.
    if (endpoints) {
      const range = document.createRange(); range.setStart(endpoints.start === node ? span : endpoints.start, endpoints.startOffset); range.setEnd(endpoints.end === node ? span : endpoints.end, endpoints.endOffset);
      s?.removeAllRanges(); s?.addRange(range); selection.current = range.cloneRange();
    }
  }
  function sync() {
    if (!editor.current || composing.current) return;
    normalizeSize(); inlineTypingStyle();
    try { setNote(readNote(editor.current, note.align)); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'This note could not be saved.'); }
  }
  function command(name: string, value?: string) {
    const node = editor.current; if (!node) return;
    const empty = !node.textContent;
    node.focus(); const s = window.getSelection();
    if (selection.current && node.contains(selection.current.commonAncestorContainer)) { s?.removeAllRanges(); s?.addRange(selection.current); }
    // Native editing keeps typing, selection, IME and Ctrl/Cmd+Z in the browser's undo stack.
    document.execCommand('styleWithCSS', false, 'true'); document.execCommand(name, false, value);
    // Font/color choices made before typing survive focus moving between controls.
    if (empty) {
      if (name === 'fontName' && value) node.style.fontFamily = value;
      if (name === 'fontSize') node.style.fontSize = `${fontSize.current}px`;
      if (name === 'foreColor' && value) node.style.color = value;
      if (name === 'bold') node.style.fontWeight = document.queryCommandState('bold') ? '700' : '400';
      if (name === 'italic') node.style.fontStyle = document.queryCommandState('italic') ? 'italic' : 'normal';
      if (name === 'underline') node.style.textDecoration = document.queryCommandState('underline') ? 'underline' : 'none';
    }
    normalizeSize(); sync();
    if (s?.rangeCount && node.contains(s.anchorNode)) selection.current = s.getRangeAt(0).cloneRange();
    setMarks({ bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline') });
  }
  const displacement = origin ? { '--flight-x': `${origin.x - innerWidth / 2}px`, '--flight-y': `${origin.y - innerHeight / 2}px` } : {};
  const wordCount = Array.from(noteText(note)).length;
  return <dialog ref={dialog} className={`note-dialog ${revealed ? 'is-revealed' : 'is-opening'}`} aria-label={editable ? 'Edit envelope note' : 'Read envelope note'} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} style={displacement as CSSProperties}>
    <button className="note-dismiss icon-button" aria-label="Close envelope note" onClick={close} autoFocus><X size={20} /></button>
    <div className="note-flight" aria-hidden="true"><EnvelopeArt color={object.color ?? '#ddb4bb'} /><span>A little note, just for you</span></div>
    <section className="note-sheet" aria-hidden={!revealed} inert={!revealed}>
      <div className="note-sheet-heading"><div><span className="eyebrow">WORDS TO KEEP</span><h2>{editable ? 'Your little letter' : 'A little letter for you'}</h2></div><span className="note-heading-seal"><Mail size={23} strokeWidth={1.4} /></span></div>
      {editable && <div className="note-toolbar" role="toolbar" aria-label="Note text formatting">
        <label className="note-font">Font<select aria-label="Note font" value={font} onChange={e => { const f = e.target.value as keyof typeof noteFonts; setFont(f); command('fontName', noteFonts[f].family); }}>{Object.entries(noteFonts).map(([id, f]) => <option key={id} value={id}>{f.name}</option>)}</select></label>
        <label className="note-size">Size<select aria-label="Note font size" value={size} onChange={e => { const px = Number(e.target.value); fontSize.current = px; setSize(px); command('fontSize', '7'); }}>{noteSizes.map(px => <option key={px} value={px}>{px}</option>)}</select></label>
        <div className="note-tool-group">{([{ key: 'bold', icon: Bold, label: 'Bold' }, { key: 'italic', icon: Italic, label: 'Italic' }, { key: 'underline', icon: Underline, label: 'Underline' }] as const).map(tool => <button key={tool.key} title={tool.label} aria-label={tool.label} aria-pressed={marks[tool.key]} onPointerDown={e => e.preventDefault()} onClick={() => command(tool.key)}><tool.icon size={17} /></button>)}</div>
        <label className="note-color" title="Text color"><input type="color" aria-label="Note text color" value={color} onChange={e => { setColor(e.target.value); command('foreColor', e.target.value); }} /><span style={{ background: color }} /><span>Color</span></label>
        <div className="note-tool-group note-alignment">{([{ value: 'left', icon: AlignLeft }, { value: 'center', icon: AlignCenter }, { value: 'right', icon: AlignRight }] as const).map(a => <button key={a.value} title={`Align ${a.value}`} aria-label={`Align ${a.value}`} aria-pressed={note.align === a.value} onPointerDown={e => e.preventDefault()} onClick={() => setNote(n => ({ ...n, align: a.value }))}><a.icon size={17} /></button>)}</div>
      </div>}
      {editable ? <div ref={editor} className="note-content note-editor" contentEditable suppressContentEditableWarning role="textbox" aria-label="Envelope note text" aria-multiline="true" aria-describedby="note-editor-help" data-placeholder="Dear someone lovely…" style={{ textAlign: note.align }} onInput={sync} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; sync(); }} onPaste={e => { e.preventDefault(); command('insertText', e.clipboardData.getData('text/plain')); }} onDrop={e => e.preventDefault()} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) { e.preventDefault(); command({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]!); } }} /> : <div className="note-content note-reader" style={{ textAlign: note.align }}>{note.runs.length ? note.runs.map((run, i) => <span key={i} style={runStyle(run)}>{run.text}</span>) : <p className="note-empty">A little envelope, filled with love.<Heart size={20} /></p>}</div>}
      {error && <p className="note-error" role="alert">{error}</p>}
      <div className="note-sheet-footer">{editable ? <><span id="note-editor-help">Select text to style it.<small>{wordCount} / {NOTE_LIMIT} characters</small></span><button className="primary-button" disabled={!!error} onClick={() => { if (!editor.current) return; try { normalizeSize(); save(readNote(editor.current, note.align)); } catch (e) { setError((e as Error).message); } }}><Check size={16} /> Save & seal</button></> : <><span>Something small. Something heartfelt.</span><button className="secondary-button" onClick={close}><Mail size={16} /> Close letter</button></>}</div>
    </section>
  </dialog>;
}
