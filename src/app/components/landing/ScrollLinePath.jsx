'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

/**
 * ScrollLinePath
 *
 * CSS STACKING:
 *   section bg (non-positioned) → SVG (absolute z-0) → content (relative z-1+)
 *
 * The sine wave STOPS at the How It Works section top,
 * then RESUMES from the section bottom through Features & SocialProof.
 * No dots or markers in the How It Works section.
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
    const hiwRunwayEl = document.getElementById('hiw-scroll-runway');

    const featuresY = featuresEl
      ? featuresEl.getBoundingClientRect().top + window.scrollY - containerTop
      : h * 0.35;
    const testimonialsY = testimonialsEl
      ? testimonialsEl.getBoundingClientRect().top + window.scrollY - containerTop
      : h * 0.65;

    // How It Works section boundaries
    let hiwTop = 0;
    let hiwBottom = 0;
    if (hiwRunwayEl) {
      const runwayRect = hiwRunwayEl.getBoundingClientRect();
      hiwTop = runwayRect.top + window.scrollY - containerTop;
      hiwBottom = hiwTop + hiwRunwayEl.offsetHeight;
    }

    setDims({ w, h, featuresY, testimonialsY, hiwTop, hiwBottom });
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

  const hiwStartFrac = dims ? dims.hiwTop / dims.h : 0.15;
  const hiwEndFrac = dims ? dims.hiwBottom / dims.h : 0.55;

  // Path 1 (pre-HowItWorks): draws from scroll start to hiwStart
  const path1Length = useTransform(scrollYProgress, [0, hiwStartFrac], [0, 1]);
  const path1Opacity = useTransform(
    scrollYProgress,
    [0.05, 0.1, Math.max(hiwStartFrac - 0.02, 0.1), hiwStartFrac],
    [0, 1, 1, 0.6]
  );

  // Path 2 (post-HowItWorks): draws from hiwEnd to scroll end
  const path2Length = useTransform(scrollYProgress, [hiwEndFrac, 1], [0, 1]);
  const path2Opacity = useTransform(
    scrollYProgress,
    [hiwEndFrac, Math.min(hiwEndFrac + 0.03, 1), 0.85, 0.95],
    [0.6, 1, 1, 0.5]
  );

  // Features boundary dot
  const featuresDotFrac = dims ? (dims.featuresY + 60) / dims.h : 0.4;
  const featuresDotOpacity = useTransform(
    scrollYProgress,
    [Math.max(featuresDotFrac - 0.06, 0), featuresDotFrac],
    [0, 1]
  );

  if (prefersReducedMotion) return <div ref={containerRef}>{children}</div>;

  const showSvg = dims !== null;
  let prePath = '';
  let postPath = '';
  let cx = 0;
  let featuresDotCy = 0;

  if (dims) {
    const { w, h, featuresY, testimonialsY, hiwTop, hiwBottom } = dims;
    cx = w / 2;
    featuresDotCy = featuresY + 60;
    const waveAmp = Math.min(512 + 120, (w - 48) / 2);

    // Pre-HowItWorks wave
    if (hiwTop > 100) {
      prePath = buildSineWave(cx, waveAmp, 0, hiwTop, []);
    }

    // Post-HowItWorks wave
    const postCrossings = [featuresY + 60, testimonialsY].filter((y) => y > hiwBottom);
    postPath = buildSineWave(cx, waveAmp, hiwBottom, h, postCrossings);
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
          {/* ===== PRE–HOW IT WORKS WAVE ===== */}
          {prePath && (
            <>
              <path d={prePath} stroke="#F97316" strokeOpacity="0.04" strokeWidth="1.5" fill="none" />
              <motion.path
                d={prePath}
                stroke="#F97316"
                strokeOpacity="0.035"
                strokeWidth="14"
                strokeLinecap="round"
                fill="none"
                style={{ pathLength: path1Length, opacity: path1Opacity }}
              />
              <motion.path
                d={prePath}
                stroke="url(#slpGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                style={{ pathLength: path1Length, opacity: path1Opacity }}
              />
            </>
          )}

          {/* ===== POST–HOW IT WORKS WAVE ===== */}
          {postPath && (
            <>
              <path d={postPath} stroke="#F97316" strokeOpacity="0.04" strokeWidth="1.5" fill="none" />
              <motion.path
                d={postPath}
                stroke="#F97316"
                strokeOpacity="0.035"
                strokeWidth="14"
                strokeLinecap="round"
                fill="none"
                style={{ pathLength: path2Length, opacity: path2Opacity }}
              />
              <motion.path
                d={postPath}
                stroke="url(#slpGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                style={{ pathLength: path2Length, opacity: path2Opacity }}
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
