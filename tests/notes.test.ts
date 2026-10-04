import { describe, expect, it } from 'vitest';
import { clone, decode, encode, loadDraft, saveDraft, starter, validate } from '../src/config';
import { createGiftObject, validateGiftObjects } from '../src/giftCatalog';
import { emptyNote, NOTE_LIMIT, NOTE_RUN_LIMIT, noteText, validateNote } from '../src/notes';

describe('sealed letters', () => {
  it('keeps rich text per envelope through drafts and portable links without changing old gifts', () => {
    const c = clone(starter), envelope = createGiftObject('sealed-envelope', []);
    expect(envelope.note).toEqual(emptyNote());
    envelope.note = { align: 'center', runs: [{ text: 'Dear 小花 🌷\n', font: 'handwritten', size: 28, color: '#B45178', bold: true, italic: true, underline: true }, { text: '<img src=x onerror=alert(1)> is just text.' }] };
    c.objects = [envelope, { ...createGiftObject('sealed-envelope', [envelope]), note: { runs: [{ text: 'A separate letter' }], align: 'right' } }];
    expect(decode(encode(c))).toEqual(c);
    let saved = ''; saveDraft(c, { setItem: (_key, v) => { saved = v; } });
    expect(loadDraft({ getItem: () => saved })).toEqual(c);
    expect(noteText(c.objects[0].note)).toContain('<img');
    expect(decode(encode(starter))).toEqual(starter);
    expect(validateGiftObjects([{ ...envelope, note: undefined }])[0].note).toBeUndefined();
  });
  it('validates text limits, styling, object type and untrusted values', () => {
    const envelope = createGiftObject('sealed-envelope', []);
    for (const value of [null, { runs: [], align: 'justify' }, { runs: [{ text: 'x', font: '__proto__' }], align: 'left' }, { runs: [{ text: 'x', size: 999 }], align: 'left' }, { runs: [{ text: 'x', color: 'url(javascript:alert(1))' }], align: 'left' }, { runs: [{ text: 'x', bold: 'true' }], align: 'left' }, { runs: [{ text: '🌷'.repeat(NOTE_LIMIT + 1) }], align: 'left' }, { runs: Array.from({ length: NOTE_RUN_LIMIT + 1 }, () => ({ text: 'x' })), align: 'left' }]) expect(() => validateNote(value)).toThrow();
    expect(() => validate({ ...starter, objects: [{ ...createGiftObject('teddy-bear', []), note: emptyNote() }] })).toThrow('Only an envelope');
    expect(validateNote({ align: 'left', runs: [{ text: '🌷'.repeat(NOTE_LIMIT) }] }).runs[0].text).toHaveLength(NOTE_LIMIT * 2);
    expect(validateGiftObjects([envelope])).toEqual([envelope]);
  });
  it('round-trips six maximum-format notes within bounded decoding limits', () => {
    const c = clone(starter);
    c.objects = Array.from({ length: 6 }, () => ({ ...createGiftObject('sealed-envelope', []), note: { align: 'left' as const, runs: Array.from({ length: NOTE_RUN_LIMIT }, (_, i) => ({ text: `${i} 小花 🌷`, font: 'handwritten' as const, size: 36, color: '#123456', bold: true, italic: true, underline: true })) } }));
    expect(decode(encode(c))).toEqual(c);
  });
});
