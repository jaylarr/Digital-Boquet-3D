import { useEffect, useState } from 'react';

export const MOBILE_STUDIO_QUERY = '(max-width: 760px), (max-width: 1000px) and (max-height: 480px)';
export function useMobileStudioWorkspace(active: boolean) {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_STUDIO_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(MOBILE_STUDIO_QUERY);
    const sync = () => setMobile(query.matches);
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  const focused = active && mobile;
  useEffect(() => {
    if (!focused) return;
    const previous = document.body.style.overflow;
    const root = document.documentElement;
    const names = ['--studio-height', '--studio-top', '--studio-preview-height'];
    const saved = names.map(name => root.style.getPropertyValue(name));
    const viewport = window.visualViewport;
    const resize = () => {
      const height = viewport?.height ?? window.innerHeight;
      const keyboard = window.innerHeight - height > 150;
      root.style.setProperty('--studio-height', `${height}px`);
      root.style.setProperty('--studio-top', `${viewport?.offsetTop ?? 0}px`);
      root.style.setProperty('--studio-preview-height', `${Math.min(260, Math.max(keyboard ? 90 : 120, height * (keyboard ? .24 : .29)))}px`);
    };
    document.body.style.overflow = 'hidden';
    resize();
    viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    return () => {
      document.body.style.overflow = previous;
      names.forEach((name, index) => { if (saved[index]) root.style.setProperty(name, saved[index]); else root.style.removeProperty(name); });
      viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
    };
  }, [focused]);
  return focused;
}
