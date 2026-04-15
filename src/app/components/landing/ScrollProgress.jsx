'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const sections = [
  { id: 'audio-demo', label: 'Hear Voco' },
  { id: 'features', label: 'Features' },
  { id: 'faq', label: 'FAQ' },
  { id: 'cta', label: 'Get Started' },
];

export function ScrollProgress() {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const ticking = useRef(false);

  const handleScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      const viewportH = window.innerHeight;
      const trigger = viewportH * 0.4;

      // Show only after hero section is fully scrolled past, hide at CTA section
      const heroSection = document.querySelector('section:first-of-type');
      const ctaEl = document.getElementById('cta');
      const pastHero = heroSection ? heroSection.getBoundingClientRect().bottom < viewportH * 0.5 : false;
      const atCta = ctaEl ? ctaEl.getBoundingClientRect().top < viewportH * 0.6 : false;
      setVisible(pastHero && !atCta);

      let currentIndex = -1;
      let currentProgress = 0;

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= trigger) {
          currentIndex = i;
          const sectionH = rect.height;
          const scrolled = trigger - rect.top;
          const sectionProgress = Math.min(Math.max(scrolled / sectionH, 0), 1);
          currentProgress = (i + sectionProgress) / sections.length;
          break;
        }
      }

      setActiveIndex(currentIndex);
      setProgress(currentProgress);
      ticking.current = false;
    });
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleClick = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Desktop: fixed left sidebar roadmap (on light sections)
  // Mobile: fixed bottom compact progress dots
  return (
    <>
      {/* Desktop roadmap */}
      <div
        className={`hidden lg:flex fixed left-6 xl:left-10 top-[30%] z-40 flex-col items-start transition-all duration-500 ${
          visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'
        }`}
      >
        <div className="relative flex flex-col gap-0">
          {/* Vertical track line */}
          <div className="absolute left-[7px] top-[8px] bottom-[8px] w-[2px] bg-[#0F172A]/[0.1] rounded-full" />
          {/* Filled progress line */}
          <motion.div
            className="absolute left-[7px] top-[8px] w-[2px] bg-[#F97316] rounded-full origin-top"
            style={{ height: `calc(${Math.max(progress * 100, 0)}% - 0px)` }}
            initial={false}
            animate={{ height: `${Math.max(progress * 100, 0)}%` }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
          />

          {sections.map((section, i) => {
            const isActive = i === activeIndex;
            const isPast = i < activeIndex;

            return (
              <button
                key={section.id}
                onClick={() => handleClick(section.id)}
                className="group relative flex items-center gap-3 py-3 cursor-pointer"
                aria-label={`Scroll to ${section.label}`}
              >
                {/* Dot */}
                <div
                  className={`relative z-10 size-4 rounded-full border-2 transition-all duration-300 ${
                    isActive
                      ? 'border-[#F97316] bg-[#F97316] shadow-[0_0_8px_rgba(249,115,22,0.4)]'
                      : isPast
                        ? 'border-[#F97316] bg-[#F97316]/80'
                        : 'border-[#0F172A]/20 bg-white group-hover:border-[#0F172A]/40'
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-[#F97316] animate-ping opacity-20" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                    isActive
                      ? 'text-[#F97316] translate-x-0.5'
                      : isPast
                        ? 'text-[#0F172A]/50'
                        : 'text-[#0F172A]/25 group-hover:text-[#0F172A]/40'
                  }`}
                >
                  {section.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: fixed bottom dot indicator */}
      <div
        className={`lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-500 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0F172A]/90 backdrop-blur-md border border-white/[0.08] shadow-lg">
          <div className="relative flex items-center gap-2.5">
            {sections.map((section, i) => {
              const isActive = i === activeIndex;
              const isPast = i < activeIndex;

              return (
                <button
                  key={section.id}
                  onClick={() => handleClick(section.id)}
                  className="group relative flex items-center"
                  aria-label={`Scroll to ${section.label}`}
                >
                  <div
                    className={`size-2.5 rounded-full transition-all duration-300 ${
                      isActive
                        ? 'bg-[#F97316] shadow-[0_0_6px_rgba(249,115,22,0.5)] scale-125'
                        : isPast
                          ? 'bg-[#F97316]/70'
                          : 'bg-white/20 group-hover:bg-white/30'
                    }`}
                  />
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] text-white/70 bg-[#1E293B] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {section.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
