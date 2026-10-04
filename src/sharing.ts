import { decode, shareUrl, validate, type BouquetConfigV1 } from './config';
const CODE = /^[A-Za-z0-9_-]{16}$/;
const endpoint = (address: string) => new URL('api/bouquets', new URL('.', address)).href;
export async function createShareLink(config: BouquetConfigV1, signal: AbortSignal, address = window.location.href): Promise<{ url: string; short: boolean }> {
  const controller = new AbortController(), abort = () => controller.abort(), timer = setTimeout(abort, 6000);
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const response = await fetch(endpoint(address), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: validate(config) }), signal: controller.signal });
    if (!response.ok) throw new Error('Short links unavailable');
    const { code } = await response.json() as { code: string }; if (!CODE.test(code)) throw new Error('Invalid short link');
    const url = new URL(address); url.search = ''; url.hash = `s=${code}`; return { url: url.href, short: true };
  } catch (e) { if (signal.aborted) throw e; return { url: shareUrl(config, address), short: false }; }
  finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}
export async function openSharedBouquet(code: string, signal: AbortSignal, address = window.location.href) {
  if (!CODE.test(code)) throw new Error('This bouquet link seems broken.');
  const controller = new AbortController(), abort = () => controller.abort(), timer = setTimeout(abort, 10000);
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const response = await fetch(`${endpoint(address)}/${code}`, { signal: controller.signal });
    if (response.status === 404 || response.status === 410) throw new Error('This saved bouquet could not be found on this host.');
    if (!response.ok) throw new Error('This saved bouquet is temporarily unavailable. Please try again.');
    const { payload } = await response.json() as { payload: string }; if (typeof payload !== 'string') throw new Error('This saved bouquet could not be opened.');
    return decode(payload);
  } catch (e) { if (signal.aborted) throw e; if (controller.signal.aborted) throw new Error('This saved bouquet is taking too long to open. Please try again.'); if (e instanceof Error && !(e instanceof TypeError) && !(e instanceof SyntaxError)) throw e; throw new Error('This saved bouquet could not be opened. Check your connection and try again.'); }
  finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}
