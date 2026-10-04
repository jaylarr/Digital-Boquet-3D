import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { clone, DRAFT_KEY, starter, type BouquetConfigV1 } from '../../src/config';
import { createGiftObject } from '../../src/giftCatalog';
import { NOTE_LIMIT, noteText } from '../../src/notes';
import { readyLink, sharedDesign } from './shareHelpers';

const draft = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as BouquetConfigV1, DRAFT_KEY);
async function selectText(page: Page, start = 0, end?: number) {
  await page.getByRole('textbox', { name: 'Envelope note text', exact: true }).evaluate((node, { start, end }) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); let current = walker.nextNode(), offset = 0;
    const range = document.createRange(); let found = false;
    while (current) { const length = current.textContent!.length; if (!found && start <= offset + length) { range.setStart(current, start - offset); found = true; } if (found && end !== undefined && end <= offset + length) { range.setEnd(current, end - offset); break; } offset += length; current = walker.nextNode(); }
    if (end === undefined) range.setEnd(node, node.childNodes.length);
    (node as HTMLElement).focus(); const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new Event('selectionchange'));
  }, { start, end });
}
async function point(page: Page, uid: string) {
  const p = await page.evaluate(uid => (window as unknown as { __petalpopObjectPoints: () => Record<string, [number, number]> }).__petalpopObjectPoints()[uid], uid);
  const box = (await page.getByTestId('scene').boundingBox())!; return { x: box.x + p[0], y: box.y + p[1] };
}
test('sealed scene object opens rich editor; formatting, save, undo, sharing and read-only gift work', async ({ page, browser }) => {
  await mkdir('artifacts/envelopes', { recursive: true }); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('tab', { name: 'Objects', exact: true }).click(); await page.getByRole('button', { name: 'Add Sealed Letter', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect.poll(async () => (await draft(page)).objects[0]?.id).toBe('sealed-envelope');
  const object = (await draft(page)).objects[0], p = await point(page, object.uid);
  await page.screenshot({ path: 'artifacts/envelopes/sealed-scene.png', fullPage: true });
  await page.mouse.click(p.x, p.y); const dialog = page.getByRole('dialog', { name: 'Edit envelope note' }); await expect(dialog).toBeVisible();
  const editor = page.getByRole('textbox', { name: 'Envelope note text', exact: true }); await expect(editor).toBeVisible();
  await editor.fill('Dear 小花 🌷\nA little joy, just for you.');
  await selectText(page, 0, 10);
  await dialog.getByRole('button', { name: 'Bold', exact: true }).click(); await dialog.getByRole('button', { name: 'Italic', exact: true }).click(); await dialog.getByRole('button', { name: 'Underline', exact: true }).click();
  await dialog.getByLabel('Note font', { exact: true }).selectOption('handwritten');
  await dialog.getByLabel('Note font size', { exact: true }).selectOption('28');
  await dialog.getByLabel('Note text color', { exact: true }).evaluate(input => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '#b45178'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await dialog.getByRole('button', { name: 'Align center', exact: true }).click();
  await expect(editor).toHaveCSS('text-align', 'center'); await dialog.screenshot({ path: 'artifacts/envelopes/editor-desktop.png' });
  await dialog.getByRole('button', { name: 'Save & seal', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await expect.poll(async () => noteText((await draft(page)).objects[0].note)).toBe('Dear 小花 🌷\nA little joy, just for you.');
  const saved = (await draft(page)).objects[0]; expect(saved.note!.align).toBe('center'); expect(saved.note!.runs[0]).toMatchObject({ bold: true, italic: true, underline: true, font: 'handwritten', size: 28, color: '#b45178' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect.poll(async () => noteText((await draft(page)).objects[0].note)).toBe('');
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect.poll(async () => (await draft(page)).objects[0].note).toEqual(saved.note);
  await page.reload(); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true'); expect((await draft(page)).objects[0]).toEqual(saved);
  await page.getByRole('button', { name: 'Share bouquet', exact: true }).click(); const url = await readyLink(page); expect((await sharedDesign(page, url)).objects[0]).toEqual(saved);
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } }); const receiver = await context.newPage(); receiver.on('pageerror', e => errors.push(e.message));
  await receiver.goto(url); await receiver.getByRole('button', { name: 'Tap to open', exact: true }).click();
  await expect(receiver.getByRole('button', { name: 'Keep this bouquet', exact: true })).toBeEnabled();
  await receiver.locator('.gift-scene').scrollIntoViewIfNeeded();
  const sceneBox = (await receiver.locator('.gift-scene').boundingBox())!, scenePoint = await receiver.evaluate(uid => (window as unknown as { __petalpopObjectPoints: () => Record<string, [number, number]> }).__petalpopObjectPoints()[uid], saved.uid);
  await receiver.mouse.click(sceneBox.x + scenePoint[0], sceneBox.y + scenePoint[1]); const letter = receiver.getByRole('dialog', { name: 'Read envelope note' }); await expect(letter).toBeVisible();
  await expect(letter.locator('.note-reader')).toHaveText('Dear 小花 🌷\nA little joy, just for you.'); await expect(letter.getByRole('toolbar')).toHaveCount(0);
  await expect(letter.locator('.note-reader span').first()).toHaveCSS('font-size', '28px'); await expect(letter.locator('.note-reader span').first()).toHaveCSS('font-weight', '700');
  expect(await receiver.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull(); expect(await letter.evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
  await letter.screenshot({ path: 'artifacts/envelopes/letter-mobile.png' }); await receiver.keyboard.press('Escape'); await expect(letter).toHaveCount(0);
  await receiver.getByRole('button', { name: 'Open your letter', exact: true }).click(); await expect(letter).toBeVisible(); await letter.getByRole('button', { name: 'Close letter', exact: true }).click();
  await receiver.getByRole('button', { name: 'Remix bouquet', exact: true }).last().click();
  await receiver.getByRole('tab', { name: 'Objects', exact: true }).click(); await receiver.getByRole('button', { name: 'Edit Sealed Letter 1', exact: true }).click();
  await receiver.getByRole('button', { name: 'Duplicate selected object', exact: true }).click(); await expect.poll(async () => (await draft(receiver)).objects.length).toBe(2); expect((await draft(receiver)).objects[1].note).toEqual(saved.note);
  expect(errors).toEqual([]); await context.close();
});

test('opening animates the seal, flap and rising paper; dragging does not open a letter', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); const c = clone(starter); c.objects = [createGiftObject('sealed-envelope', [])];
  await page.addInitScript(({ key, c }) => localStorage.setItem(key, JSON.stringify(c)), { key: DRAFT_KEY, c });
  await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  const p = await point(page, c.objects[0].uid); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x - 48, p.y + 12, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => (await draft(page)).objects[0].position).not.toEqual(c.objects[0].position); await expect(page.getByRole('dialog')).toHaveCount(0);
  const newPoint = await point(page, c.objects[0].uid); await page.mouse.click(newPoint.x, newPoint.y);
  const dialog = page.getByRole('dialog', { name: 'Edit envelope note' }); await expect(dialog).toHaveClass(/is-opening/);
  await expect(dialog.locator('.note-sheet')).toHaveAttribute('aria-hidden', 'true');
  const names = await dialog.evaluate(n => n.getAnimations({ subtree: true }).map(a => (a as CSSAnimation).animationName));
  expect(names).toContain('note-flight'); expect(names).toContain('note-flap'); expect(names).toContain('note-paper'); expect(names).toContain('note-seal');
  await dialog.evaluate(n => n.getAnimations({ subtree: true }).forEach(a => { a.pause(); a.currentTime = 1000; }));
  await dialog.screenshot({ path: 'artifacts/envelopes/opening.png' });
  await expect(dialog).toHaveClass(/is-revealed/); await expect(page.getByRole('textbox', { name: 'Envelope note text' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Envelope note text' }).fill('Not saved yet'); await page.keyboard.press('Escape');
  expect(noteText((await draft(page)).objects[0].note)).toBe('');
});

test('mobile editing, safe plain-text paste, character limits and touch scene opening', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const page = await context.newPage();
  const c = clone(starter); c.flowers = []; c.fillers = []; c.objects = [createGiftObject('sealed-envelope', [])];
  await page.addInitScript(({ key, c }) => localStorage.setItem(key, JSON.stringify(c)), { key: DRAFT_KEY, c }); await page.goto('/'); await expect(page.getByTestId('scene')).toHaveAttribute('data-ready', 'true');
  await page.getByTestId('scene').scrollIntoViewIfNeeded(); const p = await point(page, c.objects[0].uid); await page.touchscreen.tap(p.x, p.y);
  const dialog = page.getByRole('dialog', { name: 'Edit envelope note' }); await expect(dialog).toHaveClass(/is-revealed/); const editor = page.getByRole('textbox', { name: 'Envelope note text' });
  await editor.evaluate(n => { (n as HTMLElement).focus(); const data = new DataTransfer(); data.setData('text/plain', '<img src=x onerror=alert(1)>\nHello 🌷'); data.setData('text/html', '<img src=x onerror=alert(1)>'); n.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })); });
  expect(await editor.innerText()).toBe('<img src=x onerror=alert(1)>\nHello 🌷'); await expect(editor.locator('img')).toHaveCount(0);
  await editor.fill('x'.repeat(NOTE_LIMIT + 1)); await expect(dialog.getByRole('alert')).toContainText('up to'); await expect(dialog.getByRole('button', { name: 'Save & seal' })).toBeDisabled();
  await editor.fill('A small mobile letter 🌷'); await expect(dialog.getByRole('button', { name: 'Save & seal' })).toBeEnabled(); await selectText(page);
  await dialog.getByLabel('Note font size', { exact: true }).selectOption('36'); await dialog.getByRole('button', { name: 'Bold', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await dialog.screenshot({ path: 'artifacts/envelopes/editor-mobile.png' });
  await dialog.getByRole('button', { name: 'Save & seal' }).click(); await expect.poll(async () => (await draft(page)).objects[0].note!.runs[0]?.size).toBe(36);
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save PNG', exact: true }).click(); await (await pending).saveAs('artifacts/envelopes/envelope-card.png');
  await context.close();
});

test('typing styles, multiline paste, native undo and repeated editing retain the note', async ({ page }) => {
  await page.goto('/'); await page.getByRole('tab', { name: 'Objects', exact: true }).click(); await page.getByRole('button', { name: 'Add Sealed Letter', exact: true }).click();
  await page.getByRole('button', { name: 'Open & write a note', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Edit envelope note' }), editor = page.getByRole('textbox', { name: 'Envelope note text' });
  await dialog.getByLabel('Note font', { exact: true }).selectOption('mono'); await dialog.getByLabel('Note font size', { exact: true }).selectOption('24');
  await dialog.getByRole('button', { name: 'Underline', exact: true }).click(); await editor.pressSequentially('For you');
  await editor.press('Enter'); await editor.pressSequentially('Always');
  await editor.press('Control+z'); await editor.press('Control+Shift+z');
  await selectText(page, 0, 3); await dialog.getByRole('button', { name: 'Underline', exact: true }).click();
  await selectText(page, 0, 3); await dialog.getByRole('button', { name: 'Underline', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save & seal' }).click();
  await expect.poll(async () => noteText((await draft(page)).objects[0].note)).toBe('For you\nAlways');
  const saved = (await draft(page)).objects[0].note!; expect(saved.runs[0]).toMatchObject({ font: 'mono', size: 24, underline: true });
  await page.getByRole('button', { name: 'Open & edit note', exact: true }).click(); await expect(editor).toHaveText('For you\nAlways');
  await selectText(page); await dialog.getByRole('button', { name: 'Underline', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save & seal' }).click(); await expect.poll(async () => (await draft(page)).objects[0].note!.runs.some(r => r.underline)).toBe(false);
  await page.getByRole('button', { name: 'Open & edit note', exact: true }).click(); await editor.fill('');
  await editor.evaluate(n => { (n as HTMLElement).focus(); const data = new DataTransfer(); data.setData('text/plain', 'Line one\n\nLine three 🌷'); n.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })); });
  await dialog.getByRole('button', { name: 'Save & seal' }).click(); await expect.poll(async () => noteText((await draft(page)).objects[0].note)).toBe('Line one\n\nLine three 🌷');
});
