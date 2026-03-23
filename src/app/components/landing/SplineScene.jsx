'use client';
/**
 * Based on 21st.dev/serafim/splite — InteractiveRobotSpline component.
 * Uses React.lazy + Suspense to lazy-load the heavy Spline runtime.
 */
import { Suspense, lazy, useCallback } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

export function SplineScene({ scene, className = '' }) {
  const handleLoad = useCallback((splineApp) => {
    // Remove "Built with Spline" watermark (WebGL overlay, not DOM)
    try {
      splineApp._renderer.pipeline.setWatermark(null);
      splineApp.requestRender?.();
    } catch {
      // Silently ignore if internal API changes
    }

    // Mute all Spline audio (uses Howler.js globally)
    try {
      if (typeof window !== 'undefined' && window.Howler) {
        window.Howler.mute(true);
      }
    } catch {
      // Silently ignore
    }

    // Disable scroll-zoom: intercept wheel on the canvas so Spline
    // doesn't zoom, but DON'T preventDefault so the page still scrolls.
    try {
      const canvas = splineApp._renderer?.domElement ||
                     splineApp._canvas;
      if (canvas) {
        canvas.addEventListener('wheel', (e) => e.stopImmediatePropagation(), { capture: true });
      }
    } catch {
      // Silently ignore
    }
  }, []);

  return (
    <div className={`relative ${className}`}>
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-[#0F172A]">
            <svg className="animate-spin h-5 w-5 text-white mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l2-2.647z" />
            </svg>
          </div>
        }
      >
        <Spline scene={scene} className="w-full h-full" onLoad={handleLoad} />
      </Suspense>
    </div>
  );
}
