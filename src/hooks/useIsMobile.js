'use client';
import { useState, useEffect } from 'react';

/**
 * Detects mobile viewport via matchMedia.
 * Returns false during SSR to avoid hydration mismatch — heavy components
 * render their desktop version on the server, then swap on the client if needed.
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mql.matches);

    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}
