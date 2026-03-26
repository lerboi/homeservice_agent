'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Play, Pause } from 'lucide-react';

// Pre-computed amplitude envelope — sine wave pattern simulating a phone call
// Deterministic (no Math.random) for consistent rendering across sessions
const DESKTOP_BARS = 40;
const MOBILE_BARS = 28;

const AMPLITUDE = Array.from({ length: DESKTOP_BARS }, (_, i) => {
  const n = i / DESKTOP_BARS;
  return Math.min(1, Math.max(0.2, 0.2 + 0.6 * Math.sin(n * Math.PI) + 0.1 * Math.sin(n * 7)));
});

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function HeroDemoPlayer({ audioBuffers }) {
  const [playerState, setPlayerState] = useState('playing'); // 'playing' | 'paused' | 'ended'
  const [progress, setProgress] = useState(0); // 0 to 1
  const [elapsed, setElapsed] = useState(0); // seconds
  const [duration, setDuration] = useState(0); // total seconds
  const [barCount, setBarCount] = useState(DESKTOP_BARS);

  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const rafRef = useRef(null);
  const combinedBufferRef = useRef(null);

  // Detect mobile bar count
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    setBarCount(mq.matches ? MOBILE_BARS : DESKTOP_BARS);
    const handler = (e) => setBarCount(e.matches ? MOBILE_BARS : DESKTOP_BARS);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const trackProgress = useCallback((audioCtx, totalDuration) => {
    function tick() {
      const elapsedTime = audioCtx.currentTime - startTimeRef.current;
      const clamped = Math.min(elapsedTime, totalDuration);
      setProgress(clamped / totalDuration);
      setElapsed(clamped);
      if (clamped < totalDuration) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const playFromOffset = useCallback((audioCtx, buffer, offsetSeconds) => {
    // Cancel any existing source
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
    }
    cancelAnimationFrame(rafRef.current);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    sourceRef.current = source;
    startTimeRef.current = audioCtx.currentTime - offsetSeconds;

    source.onended = () => {
      // Natural end only (not pause-triggered)
      if (!pausedAtRef.current) {
        setPlayerState('ended');
        setProgress(1);
        cancelAnimationFrame(rafRef.current);
      }
    };

    source.start(0, offsetSeconds);
    setPlayerState('playing');
    trackProgress(audioCtx, buffer.duration);
  }, [trackProgress]);

  // Audio stitching + autoplay on mount
  useEffect(() => {
    let cancelled = false;

    async function initAudio() {
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      // Resume if suspended (browser autoplay policy)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // Decode all buffers (.slice() avoids ArrayBuffer detachment issues)
      const decoded = await Promise.all(
        audioBuffers.map((ab) => audioCtx.decodeAudioData(ab.slice()))
      );

      // Concatenate into a single AudioBuffer
      const totalLength = decoded.reduce((sum, b) => sum + b.length, 0);
      const sampleRate = decoded[0].sampleRate;
      const channels = decoded[0].numberOfChannels;
      const combined = audioCtx.createBuffer(channels, totalLength, sampleRate);
      let offset = 0;
      for (const buf of decoded) {
        for (let ch = 0; ch < channels; ch++) {
          combined.getChannelData(ch).set(buf.getChannelData(ch), offset);
        }
        offset += buf.length;
      }

      combinedBufferRef.current = combined;

      if (!cancelled) {
        setDuration(combined.duration);
        playFromOffset(audioCtx, combined, 0);
      }
    }

    initAudio().catch((err) => {
      console.error('[HeroDemoPlayer] initAudio error:', err);
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [audioBuffers, playFromOffset, cleanup]);

  const handlePlayPause = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    const combined = combinedBufferRef.current;
    if (!audioCtx || !combined) return;

    if (playerState === 'playing') {
      // Pause: save current position
      const currentElapsed = audioCtx.currentTime - startTimeRef.current;
      pausedAtRef.current = Math.min(currentElapsed, combined.duration);
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch {}
      }
      cancelAnimationFrame(rafRef.current);
      setPlayerState('paused');
    } else if (playerState === 'paused') {
      // Resume from saved position
      const resumeFrom = pausedAtRef.current;
      pausedAtRef.current = 0;
      playFromOffset(audioCtx, combined, resumeFrom);
    } else if (playerState === 'ended') {
      // Replay from beginning
      pausedAtRef.current = 0;
      setProgress(0);
      setElapsed(0);
      playFromOffset(audioCtx, combined, 0);
    }
  }, [playerState, playFromOffset]);

  // Reduced motion: skip waveform animation, show flat bars
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="flex items-center gap-3 bg-white/[0.06] border border-white/[0.06] rounded-xl px-4 py-3">
        {/* Play/Pause button */}
        <button
          onClick={handlePlayPause}
          className={`size-10 min-w-[40px] rounded-full flex items-center justify-center transition-colors ${
            playerState === 'playing' ? 'bg-white/[0.1]' : 'bg-[#F97316]'
          }`}
          aria-label={playerState === 'playing' ? 'Pause demo' : 'Play demo'}
        >
          {playerState === 'playing' ? (
            <Pause className="size-4 text-white" />
          ) : (
            <Play className="size-4 text-white ml-0.5" />
          )}
        </button>

        {/* Waveform bars */}
        <div
          className="flex-1 flex items-center gap-[4px] h-10"
          aria-hidden="true"
        >
          {AMPLITUDE.slice(0, barCount).map((amp, i) => {
            const isActive = i / barCount < progress;
            const height = prefersReducedMotion ? '40%' : `${amp * 100}%`;
            return (
              <div
                key={i}
                className={`w-[3px] rounded-full transition-colors ${
                  isActive ? 'bg-[#F97316]' : 'bg-white/[0.15]'
                }`}
                style={{ height }}
              />
            );
          })}
        </div>

        {/* Elapsed time */}
        <span
          className="text-sm text-white/30 tabular-nums min-w-[36px] text-right"
          aria-live="polite"
        >
          {formatTime(elapsed)}
        </span>
      </div>

      {/* Post-play CTA — appears after audio ends */}
      {playerState === 'ended' && (
        <div className="mt-4 animate-in fade-in duration-200">
          <Link
            href="/onboarding"
            className="block w-full max-w-xl bg-[#F97316] text-white text-sm font-medium px-6 py-2.5 rounded-lg text-center hover:bg-[#F97316]/90 transition-colors"
          >
            Start Your Free Trial
          </Link>
        </div>
      )}
    </div>
  );
}
