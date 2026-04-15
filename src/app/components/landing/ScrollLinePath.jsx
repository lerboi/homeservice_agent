'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

/**
 * ScrollLinePath
 *
 * CSS STACKING:
 *   section bg (non-positioned) → SVG (absolute z-0) → content (relative z-1+)
 *
 * Phase 48.1 — wraps IntegrationsStrip + CostOfSilenceBlock + FeaturesCarousel.
 * Single sine wave spans the full wrapper top-to-bottom, with gentle crossings
 * at each child section boundary so the copper line reads as a connected
 * journey through the three sections rather than floating arbitrarily.
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

    const topOf = (id, fallbackFrac) => {
      const node = document.getElementById(id);
      if (node) return node.getBoundingClientRect().top + window.scrollY - containerTop;
      return h * fallbackFrac;
    };

    const integrationsY = topOf('integrations', 0);
    const costY = topOf('cost-of-silence', 0.33);
    const featuresY = topOf('features', 0.66);

    setDims({ w, h, integrationsY, costY, featuresY });
  }, []);

  useEffect(() => {
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
    offset: ['start 0.85', 'end 0.5'],
  });

  // Line begins at the top of the wrapper (IntegrationsStrip).
  const startFrac = dims ? Math.max(dims.integrationsY / dims.h, 0) : 0;
  // Features dot marks where the FeaturesCarousel begins — a highlight beat.
  const featuresDotFrac = dims ? (dims.featuresY + 60) / dims.h : 0.66;

  // Single path: spans the full wrapper, driven by scroll progress.
  const pathLength = useTransform(scrollYProgress, [startFrac, 1], [0, 1]);
  const pathOpacity = useTransform(
    scrollYProgress,
    [startFrac, Math.min(startFrac + 0.03, 1), 0.85, 0.95],
    [0, 1, 1, 0.5]
  );

  // Features boundary dot
  const featuresDotOpacity = useTransform(
    scrollYProgress,
    [Math.max(featuresDotFrac - 0.06, 0), featuresDotFrac],
    [0, 1]
  );

  if (prefersReducedMotion) return <div ref={containerRef}>{children}</div>;

  const showSvg = dims !== null;
  let wavePath = '';
  let cx = 0;
  let featuresDotCy = 0;

  if (dims) {
    const { w, h, integrationsY, costY, featuresY } = dims;
    cx = w / 2;
    featuresDotCy = featuresY + 60;
    const waveAmp = Math.min(512 + 120, (w - 48) / 2);

    // Wave spans wrapper top → bottom, crossing at each child section boundary
    const startY = Math.max(integrationsY, 0);
    const crossings = [costY, featuresY].filter((y) => y > startY && y < h);
    wavePath = buildSineWave(cx, waveAmp, startY, h, crossings);
  }

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
          {/* ===== WAVE: Features dot → end ===== */}
          {wavePath && (
            <>
              <path d={wavePath} stroke="#F97316" strokeOpacity="0.04" strokeWidth="1.5" fill="none" />
              <motion.path
                d={wavePath}
                stroke="#F97316"
                strokeOpacity="0.035"
                strokeWidth="14"
                strokeLinecap="round"
                fill="none"
                style={{ pathLength, opacity: pathOpacity }}
              />
              <motion.path
                d={wavePath}
                stroke="url(#slpGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                style={{ pathLength, opacity: pathOpacity }}
              />
            </>
          )}

          {/* Features boundary dot */}
          <motion.circle cx={cx} cy={featuresDotCy} r="5" fill="#F97316" fillOpacity="0.6" style={{ opacity: featuresDotOpacity }} />
          <motion.circle cx={cx} cy={featuresDotCy} r="13" fill="none" stroke="#F97316" strokeWidth="1.5" strokeOpacity="0.15" style={{ opacity: featuresDotOpacity }} />

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
 * Build a sine wave segment between yStart and yEnd,
 * with center-crossings at the given Y positions.
 */
function buildSineWave(cx, amp, yStart, yEnd, crossings) {
  const filtered = crossings.filter((y) => y > yStart && y < yEnd);
  const points = [yStart, ...filtered, yEnd];
  const segments = [`M ${cx} ${yStart}`];
  let dir = 1;

  for (let i = 0; i < points.length - 1; i++) {
    const y0 = points[i];
    const y1 = points[i + 1];
    const span = y1 - y0;

    const count = Math.max(Math.round(span / 400), 1);
    const segH = span / count;

    for (let j = 0; j < count; j++) {
      const sy0 = y0 + j * segH;
      const sy1 = sy0 + segH;
      const peakX = cx + amp * dir;

      segments.push(
        `C ${peakX} ${sy0 + segH * 0.33}, ${peakX} ${sy1 - segH * 0.33}, ${cx} ${sy1}`
      );

      dir *= -1;
    }
  }

  return segments.join(' ');
}
