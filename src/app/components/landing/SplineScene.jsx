'use client';
/**
 * Spline 3D scene using @splinetool/runtime directly (skips React wrapper).
 *
 * Performance:
 *  - Scene preloaded in <head> via layout
 *  - CSS poster shown instantly while scene loads
 *  - Watermark removed, audio muted, scroll-zoom disabled
 */
import { useEffect, useRef, useState, useCallback } from 'react';

export function SplineScene({ scene, className = '' }) {
  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const [ready, setReady] = useState(false);

  const initScene = useCallback(async () => {
    if (!canvasRef.current || appRef.current) return;

    const { Application } = await import('@splinetool/runtime');
    const app = new Application(canvasRef.current);
    appRef.current = app;

    await app.load(scene);

    // 1. Remove watermark
    try {
      app._renderer.pipeline.setWatermark(null);
      app.requestRender?.();
    } catch {
      // Silently ignore if internal API changes
    }

    // 2. Mute audio
    try {
      if (typeof window !== 'undefined' && window.Howler) {
        window.Howler.mute(true);
      }
    } catch {
      // Silently ignore
    }

    // 3. Fix scroll — stop Spline from eating wheel events
    try {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.addEventListener('wheel', (e) => e.stopImmediatePropagation(), { capture: true });
      }
    } catch {
      // Silently ignore
    }

    setReady(true);
  }, [scene]);

  useEffect(() => {
    initScene();
    return () => {
      if (appRef.current) {
        appRef.current.dispose();
        appRef.current = null;
      }
    };
  }, [initScene]);

  return (
    <div className={`relative ${className}`} style={{ pointerEvents: 'none' }}>
      {/* Poster: ambient glow placeholder — visible instantly */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          ready ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="absolute top-1/2 left-[55%] -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.18)_0%,rgba(251,146,60,0.08)_40%,transparent_70%)] blur-[20px]" />
        <div className="absolute top-1/2 left-[55%] -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full bg-[radial-gradient(circle,rgba(253,186,116,0.12)_0%,transparent_60%)]" />
        <div className="absolute top-[40%] left-[60%] w-[120px] h-[120px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.06)_0%,transparent_70%)] blur-[10px]" />
      </div>

      {/* Canvas — Spline renders directly onto this */}
      <canvas
        ref={canvasRef}
        style={{ pointerEvents: 'auto' }}
        className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
