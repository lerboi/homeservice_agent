'use client';
/**
 * RotatingText — based on 21st.dev/tommyjepsen/animated-hero RotatingText component.
 * Uses AnimatePresence with per-character stagger for smooth text rotation.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export function RotatingText({
  texts,
  transition = { type: 'spring', damping: 25, stiffness: 300 },
  initial = { y: '100%', opacity: 0 },
  animate = { y: 0, opacity: 1 },
  exit = { y: '-120%', opacity: 0 },
  animatePresenceMode = 'popLayout',
  animatePresenceInitial = false,
  staggerDuration = 0.025,
  staggerFrom = 'first',
  rotationInterval = 3000,
  className = '',
  ...rest
}) {
  const prefersReducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);

  const advance = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % texts.length);
  }, [texts.length]);

  useEffect(() => {
    if (prefersReducedMotion || texts.length <= 1) return;
    const id = setInterval(advance, rotationInterval);
    return () => clearInterval(id);
  }, [advance, rotationInterval, prefersReducedMotion, texts.length]);

  // Memoize character split
  const characters = useMemo(
    () => texts[currentIndex].split(''),
    [texts, currentIndex]
  );

  // Reduced motion — just show static text
  if (prefersReducedMotion) {
    return <span className={className}>{texts[0]}</span>;
  }

  // Compute stagger delay for each character
  const getStaggerDelay = (index, total) => {
    if (staggerFrom === 'last') return (total - 1 - index) * staggerDuration;
    if (staggerFrom === 'center') {
      const center = Math.floor(total / 2);
      return Math.abs(center - index) * staggerDuration;
    }
    // 'first'
    return index * staggerDuration;
  };

  return (
    <span className={`relative inline-flex overflow-hidden whitespace-nowrap align-baseline ${className}`} {...rest}>
      {/* Invisible sizer — prevents CLS by reserving width of longest word */}
      <span className="invisible" aria-hidden="true">
        {texts.reduce((a, b) => (a.length >= b.length ? a : b), '')}
      </span>

      <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
        <motion.span
          key={texts[currentIndex]}
          className="absolute left-0 flex"
          aria-label={texts[currentIndex]}
        >
          {characters.map((char, i) => (
            <motion.span
              key={`${texts[currentIndex]}-${i}`}
              initial={initial}
              animate={animate}
              exit={exit}
              transition={{
                ...transition,
                delay: getStaggerDelay(i, characters.length),
              }}
              className="inline-block"
            >
              {char === ' ' ? '\u00A0' : char}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
