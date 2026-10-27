import { decode, validate, type BouquetConfigV1 } from './config';
const CODE = /^[A-Za-z0-9_-]{16}$/;
const endpoint = (address: string) => new URL('api/bouquets', new URL('.', address)).href;
type ShareFailure = 'unavailable' | 'timeout' | 'rate-limited' | 'invalid-gift';
const messages: Record<ShareFailure, string> = {
  unavailable: "We couldn't create a short link. Your bouquet is still here. Try again.",
  timeout: 'Creating your short link took too long. Try again.',
  'rate-limited': 'Too many link requests. Please try again later.',
  'invalid-gift': "This bouquet couldn't be saved. Check your gift and try again.",
};
export class ShareLinkError extends Error {
  readonly reason: ShareFailure;
  readonly status?: number;
  constructor(reason: ShareFailure, status?: number) {
    super(messages[reason]); this.name = 'ShareLinkError'; this.reason = reason; this.status = status;
  }
}
export async function createShareLink(config: BouquetConfigV1, signal: AbortSignal, address = window.location.href): Promise<{ url: string; short: true }> {
  const controller = new AbortController(), abort = () => controller.abort(), timer = setTimeout(abort, 6000);
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    let validated: BouquetConfigV1;
    try { validated = validate(config); } catch { throw new ShareLinkError('invalid-gift'); }
    const response = await fetch(endpoint(address), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: validated }), signal: controller.signal });
    if (!response.ok) throw new ShareLinkError(response.status === 429 ? 'rate-limited' : [400, 413].includes(response.status) ? 'invalid-gift' : 'unavailable', response.status);
    if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ShareLinkError('unavailable');
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('code' in result) || typeof result.code !== 'string' || !CODE.test(result.code)) throw new ShareLinkError('unavailable');
    const { code } = result;
    const url = new URL(address); url.search = ''; url.hash = `s=${code}`; return { url: url.href, short: true };
  } catch (e) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (controller.signal.aborted) throw new ShareLinkError('timeout');
    if (e instanceof ShareLinkError) throw e;
    throw new ShareLinkError('unavailable');
  }
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
