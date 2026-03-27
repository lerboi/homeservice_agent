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
    // Detach old source's onended before stopping to prevent stale callbacks
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch {}
    }
    cancelAnimationFrame(rafRef.current);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    sourceRef.current = source;
    startTimeRef.current = audioCtx.currentTime - offsetSeconds;

    source.onended = () => {
      // Only fire for the current source (not a stale one)
      if (sourceRef.current === source && !pausedAtRef.current) {
        setPlayerState('ended');
        setProgress(1);
        cancelAnimationFrame(rafRef.current);
      }
    };

    source.start(0, offsetSeconds);
    setPlayerState('playing');
    trackProgress(audioCtx, buffer.duration);
  }, [trackProgress]);

  // Generate a phone ringtone using Web Audio API oscillators
  // US phone ring: 440Hz + 480Hz dual tone, 2s on / 4s off pattern
  const generateRingtone = useCallback((audioCtx, rings = 1) => {
    const sampleRate = audioCtx.sampleRate;
    const ringOn = 0.8;  // seconds of ring
    const ringOff = 0.3; // seconds of silence between rings
    const cycleLen = ringOn + ringOff;
    const totalDuration = rings * cycleLen - ringOff; // no trailing silence
    const totalSamples = Math.floor(totalDuration * sampleRate);
    const buffer = audioCtx.createBuffer(1, totalSamples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const cyclePos = t % cycleLen;

      if (cyclePos < ringOn) {
        // Dual tone (440 + 480 Hz) with envelope
        const envelope = Math.min(1, cyclePos / 0.02) * Math.min(1, (ringOn - cyclePos) / 0.02);
        const sample =
          0.3 * Math.sin(2 * Math.PI * 440 * t) +
          0.3 * Math.sin(2 * Math.PI * 480 * t);
        data[i] = sample * envelope * 0.4; // Overall volume
      } else {
        data[i] = 0;
      }
    }

    return buffer;
  }, []);

  // Create a silence buffer of a given duration
  const createSilence = useCallback((audioCtx, durationSeconds) => {
    const sampleRate = audioCtx.sampleRate;
    const samples = Math.floor(durationSeconds * sampleRate);
    return audioCtx.createBuffer(1, samples, sampleRate);
  }, []);

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

      // Decode all speech buffers (.slice() avoids ArrayBuffer detachment issues)
      // Order: [intro (caller), name greeting (AI), mid conversation, outro (AI)]
      const decoded = await Promise.all(
        audioBuffers.map((ab) => audioCtx.decodeAudioData(ab.slice()))
      );

      // Generate ringtone and silence gaps for natural feel
      const ringtone = generateRingtone(audioCtx, 1);
      const pickupPause = createSilence(audioCtx, 0.8);
      const turnGapShort = createSilence(audioCtx, 0.6);
      const turnGapLong = createSilence(audioCtx, 0.9);

      // Sequence: ringtone → pause → AI greeting (name) → short gap → caller intro → gap → mid → gap → outro
      const sequence = [
        ringtone,
        pickupPause,
        decoded[1],    // AI greeting with business name (dynamic)
        turnGapShort,
        decoded[0],    // Caller: "Hey, yeah, I'd like to get my AC serviced..."
        turnGapLong,
        decoded[2],    // Mid-conversation (multi-voice)
        turnGapShort,
        decoded[3],    // Outro (AI booking confirmation)
      ];

      // Concatenate all into a single AudioBuffer
      const sampleRate = audioCtx.sampleRate;
      const totalLength = sequence.reduce((sum, b) => {
        // Resample mono/stereo mismatch: use channel 0 length
        return sum + b.length;
      }, 0);
      const combined = audioCtx.createBuffer(1, totalLength, sampleRate);
      const output = combined.getChannelData(0);
      let offset = 0;
      for (const buf of sequence) {
        const channelData = buf.getChannelData(0);
        output.set(channelData, offset);
        offset += buf.length;
      }

      // Add subtle phone line noise for realism
      // Low-level filtered noise simulating a phone connection
      for (let i = 0; i < totalLength; i++) {
        output[i] += (Math.random() * 2 - 1) * 0.0005;
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
  }, [audioBuffers, playFromOffset, cleanup, generateRingtone, createSilence]);

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

        {/* Waveform bars — clickable to seek */}
        <div
          className="flex-1 flex items-center gap-[4px] h-10 cursor-pointer"
          aria-hidden="true"
          onClick={(e) => {
            const audioCtx = audioCtxRef.current;
            const combined = combinedBufferRef.current;
            if (!audioCtx || !combined) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const seekRatio = Math.max(0, Math.min(1, clickX / rect.width));
            const seekTime = seekRatio * combined.duration;
            pausedAtRef.current = 0;
            setProgress(seekRatio);
            setElapsed(seekTime);
            playFromOffset(audioCtx, combined, seekTime);
          }}
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

      {/* CTA — always visible once player is mounted */}
      {(
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-[#F97316] text-white text-sm font-semibold px-8 py-2.5 rounded-lg text-center hover:bg-[#EA580C] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all duration-200"
          >
            Start Your Free Trial
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      )}
    </div>
  );
}
