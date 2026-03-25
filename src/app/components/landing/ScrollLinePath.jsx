'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

/**
 * ScrollLinePath
 *
 * CSS STACKING (this is why it works):
 *   - Section <section> elements are NON-positioned (no `relative`)
 *     → their backgrounds paint in normal flow (below any positioned elements)
 *   - This SVG is positioned (absolute) with z-index: 0
 *     → paints ABOVE section backgrounds
 *   - Section inner <div class="relative z-[1]"> is positioned with z-index: 1
 *     → paints ABOVE the SVG
 *   - Result: section bg → SVG line → cards/text
 *
 * PATH: smooth sine wave ~60px outside the max-w-5xl content edges.
 * One dot at the How It Works → Features boundary.
 * Starts center (below hero), ends center (pointing at CTA below).
 */

export function ScrollLinePath({ children }) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef(null);
  const [dims, setDims] = useState(null);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const rect = el.getBoundingClientRect();
    const containerTop = rect.top + window.scrollY;

    const featuresEl = document.getElementById('features');
    const testimonialsEl = document.getElementById('testimonials');
    const featuresY = featuresEl
      ? featuresEl.getBoundingClientRect().top + window.scrollY - containerTop
      : h * 0.35;
    const testimonialsY = testimonialsEl
      ? testimonialsEl.getBoundingClientRect().top + window.scrollY - containerTop
      : h * 0.65;

    setDims({ w, h, featuresY, testimonialsY });
  }, []);

  useEffect(() => {
    // Measure after render + after dynamic imports load
    const t1 = setTimeout(measure, 100);
    const t2 = setTimeout(measure, 1000);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    // 'start end' = begin tracking when container top reaches viewport bottom
    // 'end start' = finish when container bottom reaches viewport top
    // This gives the longest possible scroll range → slowest line draw
    offset: ['start 0.85', 'end 0.5'],
  });

  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const lineOpacity = useTransform(scrollYProgress, [0.05, 0.1, 0.85, 0.95], [0, 1, 1, 0.5]);

  if (prefersReducedMotion) return <div ref={containerRef}>{children}</div>;

  // Don't render SVG until we have measurements
  const showSvg = dims !== null;
  let path = '';
  let dotCx = 0;
  let dotCy = 0;
  let dotScrollFraction = 0.35;

  if (dims) {
    const { w, h, featuresY, testimonialsY } = dims;
    const cx = w / 2;

    dotCx = cx;
    dotCy = featuresY + 60;
    dotScrollFraction = (featuresY + 60) / h;

    // Amplitude: 120px BEYOND the max-w-5xl container edges
    const waveAmp = Math.min(512 + 120, (w - 48) / 2);
    path = buildSineWave(cx, waveAmp, h, [dotCy, testimonialsY]);
  }

  const dotOpacity = useTransform(
    scrollYProgress,
    [Math.max(dotScrollFraction - 0.06, 0), dotScrollFraction],
    [0, 1]
  );

  return (
    <div ref={containerRef} className="relative">
      {showSvg && (
        <svg
          width={dims.w}
          height={dims.h}
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="hidden md:block absolute top-0 left-0 pointer-events-none"
          style={{ zIndex: 0 }}
          aria-hidden="true"
        >
          {/* Ghost trail */}
          <path d={path} stroke="#F97316" strokeOpacity="0.04" strokeWidth="1.5" fill="none" />

          {/* Glow */}
          <motion.path
            d={path}
            stroke="#F97316"
            strokeOpacity="0.035"
            strokeWidth="14"
            strokeLinecap="round"
            fill="none"
            style={{ pathLength, opacity: lineOpacity }}
          />

          {/* Main line */}
          <motion.path
            d={path}
            stroke="url(#slpGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            style={{ pathLength, opacity: lineOpacity }}
          />

          {/* Features dot */}
          <motion.circle cx={dotCx} cy={dotCy} r="5" fill="#F97316" fillOpacity="0.6" style={{ opacity: dotOpacity }} />
          <motion.circle cx={dotCx} cy={dotCy} r="13" fill="none" stroke="#F97316" strokeWidth="1.5" strokeOpacity="0.15" style={{ opacity: dotOpacity }} />

          <defs>
            <linearGradient id="slpGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F97316" stopOpacity="0.12" />
              <stop offset="30%" stopColor="#F97316" stopOpacity="0.3" />
              <stop offset="70%" stopColor="#F97316" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#F97316" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>
      )}

      {children}
    </div>
  );
}

/**
 * Build a smooth sine wave with center-crossings at section boundaries.
 *
 * crossings = [dotY, testimonialsY] — the Y positions where the wave
 * must pass through center. We also add y=0 (start) and y=totalH (end).
 * Between each pair of crossings we place one half-wave (peak in the middle).
 * This guarantees the wave crosses center at section seams (not through headers).
 */
function buildSineWave(cx, amp, totalH, crossings) {
  // All center-crossing Y positions (where wave passes through x=cx)
  const points = [0, ...crossings, totalH];
  const segments = [`M ${cx} 0`];
  let dir = 1; // First half-wave goes right

  for (let i = 0; i < points.length - 1; i++) {
    const y0 = points[i];
    const y1 = points[i + 1];
    const span = y1 - y0;

    // How many half-waves in this section? ~1 per 400px, minimum 1
    const count = Math.max(Math.round(span / 400), 1);
    const segH = span / count;

    for (let j = 0; j < count; j++) {
      const sy0 = y0 + j * segH;
      const sy1 = sy0 + segH;
      const peakX = cx + amp * dir;

      segments.push(
        `C ${peakX} ${sy0 + segH * 0.33}, ${peakX} ${sy1 - segH * 0.33}, ${cx} ${sy1}`
      );

      dir *= -1; // Alternate direction
    }
  }

  return segments.join(' ');
}
