import { useEffect, useState } from 'react';
import { Flower2, Gift, SlidersHorizontal } from 'lucide-react';

export function scrollStudioTo(id: string) {
  if (!window.matchMedia('(max-width: 760px)').matches) return;
  document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

export function MobileStudioNav({ previewGift, hasDesign }: { previewGift: () => void; hasDesign: boolean }) {
  const [section, setSection] = useState<'bouquet' | 'customize'>('bouquet');
  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)');
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!query.matches) return;
      const builder = document.getElementById('bouquet-builder');
      setSection(builder && builder.getBoundingClientRect().top < window.innerHeight * .5 ? 'customize' : 'bouquet');
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    measure();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);
  return <nav className="mobile-studio-nav" aria-label="Studio navigation">
    <button aria-current={section === 'bouquet' ? 'location' : undefined} aria-controls="bouquet-preview" onClick={() => scrollStudioTo('bouquet-preview')}><Flower2 size={20} /><span>Bouquet</span></button>
    <button aria-current={section === 'customize' ? 'location' : undefined} aria-controls="builder-navigation" onClick={() => scrollStudioTo('builder-navigation')}><SlidersHorizontal size={20} /><span>Customize</span></button>
    <button disabled={!hasDesign} onClick={previewGift}><Gift size={20} /><span>Gift preview</span></button>
  </nav>;
}
