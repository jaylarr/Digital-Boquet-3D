import { useEffect, useState } from 'react';
import { Flower2, Gift, SlidersHorizontal } from 'lucide-react';
import { MOBILE_STUDIO_QUERY } from './useMobileFlowerWorkspace';

export function scrollStudioTo(id: string) {
  if (!window.matchMedia(MOBILE_STUDIO_QUERY).matches) return;
  const pane = document.querySelector<HTMLElement>('.mobile-workspace .workspace'), target = document.getElementById(id);
  if (!pane || !target || !pane.contains(target)) return;
  const nav = document.getElementById('builder-navigation');
  const offset = id === 'bouquet-preview' || id === 'builder-navigation' ? 0 : nav?.getBoundingClientRect().height ?? 0;
  pane.scrollTo({ top: target.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - offset - 8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

export function MobileStudioNav({ previewGift, hasDesign, flowerFocused = false, showBouquet, customize }: { previewGift: () => void; hasDesign: boolean; flowerFocused?: boolean; showBouquet: () => void; customize: () => void }) {
  const [section, setSection] = useState<'bouquet' | 'customize'>('bouquet');
  useEffect(() => {
    const query = window.matchMedia(MOBILE_STUDIO_QUERY);
    const pane = document.querySelector('.workspace');
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!query.matches) return;
      const builder = document.getElementById('bouquet-builder');
      setSection(builder && pane && builder.getBoundingClientRect().top < pane.getBoundingClientRect().top + 60 ? 'customize' : 'bouquet');
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    pane?.addEventListener('scroll', onScroll, { passive: true });
    measure();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); pane?.removeEventListener('scroll', onScroll); };
  }, []);
  return <nav className="mobile-studio-nav" aria-label="Studio navigation">
    <button aria-current={!flowerFocused && section === 'bouquet' ? 'location' : undefined} aria-controls="bouquet-preview" onClick={showBouquet}><Flower2 size={20} /><span>Bouquet</span></button>
    <button aria-current={flowerFocused || section === 'customize' ? 'location' : undefined} aria-controls="builder-navigation" onClick={customize}><SlidersHorizontal size={20} /><span>Customize</span></button>
    <button disabled={!hasDesign} onClick={previewGift}><Gift size={20} /><span>Gift preview</span></button>
  </nav>;
}
