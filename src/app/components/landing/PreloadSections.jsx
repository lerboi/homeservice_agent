'use client';
import { useEffect } from 'react';

// Warms the code-split landing section chunks during browser idle time so the
// dynamic() loading fallbacks in page.js almost never get a chance to paint.
// Renders nothing; safe to remove a line here if a section stops being lazy.
export function PreloadSections() {
  useEffect(() => {
    const preload = () => {
      import('@/app/components/landing/AudioDemoSection');
      import('@/app/components/landing/FeaturesCarousel');
      import('@/app/components/landing/FAQSection');
    };

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(preload, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(preload, 300);
    return () => clearTimeout(t);
  }, []);

  return null;
}
