'use client';
import { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';

// Single AI voice snippet — demo-outro.mp3 is the pre-rendered ElevenLabs AI-voice
// segment (see scripts/generate-demo-audio.js); the transcript below is the exact
// text that file was generated from.
const TRACK = {
  src: '/audio/demo-outro.mp3',
  text: "You're all set... Thursday at 2 PM at 214 Oak Street. We'll send you a reminder beforehand. Have a great day!",
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const BAR_COUNT = 64;
const BAR_HEIGHTS = [
  18, 32, 58, 42, 74, 88, 60, 76, 48, 66, 82, 54, 30, 58, 72, 92, 62, 46, 78, 58,
  36, 62, 84, 52, 42, 68, 88, 58, 72, 46, 62, 82, 50, 34, 56, 76, 46, 66, 40, 58,
  72, 52, 36, 62, 82, 56, 42, 68, 28, 54, 70, 44, 60, 80, 48, 64, 38, 56, 74, 50,
  42, 66, 86, 54,
];

export function AudioDemoSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => {
      // load()/reset fires timeupdate at currentTime=0 — guard so nothing
      // reacts before actual playback starts.
      if (audio.paused) return;
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setIsPlaying(false);
      if (typeof window !== 'undefined' && window.__vocoPlayingAudio === audio) {
        window.__vocoPlayingAudio = null;
      }
    };
    const onError = () => setHasError(true);

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    if (typeof window !== 'undefined' && window.__vocoPlayingAudio && window.__vocoPlayingAudio !== audio) {
      try { window.__vocoPlayingAudio.pause(); } catch {}
    }
    audio.play().then(() => {
      setIsPlaying(true);
      if (typeof window !== 'undefined') window.__vocoPlayingAudio = audio;
    }).catch(() => setIsPlaying(false));
  }

  const progress = duration > 0 ? currentTime / duration : 0;
  const lineActive = isPlaying || (currentTime > 0 && currentTime < duration);

  return (
    <section id="audio-demo" className="bg-white py-24 md:py-32 px-6">
      <AnimatedSection>
        <div className="max-w-4xl mx-auto">
          <div className="max-w-2xl">
            <div className="text-[13px] font-semibold text-[#F97316] tracking-[0.18em] uppercase mb-4">AI voice</div>
            <h2 className="text-4xl md:text-5xl font-semibold text-[#0F172A] leading-[1.1] tracking-tight">
              Hear how<br />Voco sounds.
            </h2>
          </div>

          <audio ref={audioRef} src={TRACK.src} preload="metadata" />

          <div className="mt-14 flex items-center gap-6">
            <button
              type="button"
              onClick={togglePlay}
              className="shrink-0 flex items-center justify-center w-16 h-16 rounded-full bg-[#F97316] text-white hover:bg-[#EA580C] shadow-xl shadow-[#F97316]/25 transition-all hover:scale-105"
              aria-label={isPlaying ? 'Pause AI voice sample' : 'Play AI voice sample'}
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
            </button>
            <div className="flex-1 flex items-center gap-[3px] h-16" aria-hidden="true">
              {Array.from({ length: BAR_COUNT }).map((_, i) => {
                const barActive = progress > 0 && i / BAR_COUNT <= progress;
                return (
                  <div
                    key={i}
                    style={{ height: `${BAR_HEIGHTS[i] || 50}%` }}
                    className={
                      barActive
                        ? 'flex-1 bg-[#F97316] rounded-full transition-colors'
                        : 'flex-1 bg-stone-200 rounded-full transition-colors'
                    }
                  />
                );
              })}
            </div>
            <div className="shrink-0 text-[13px] font-mono text-[#94A3B8] tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {hasError && (
            <p className="mt-6 text-[14px] text-[#475569]">Audio unavailable — read the transcript below.</p>
          )}

          <div className="mt-14" aria-live="polite">
            <div className="grid grid-cols-[72px_1fr] gap-6 items-baseline">
              <span
                className={
                  lineActive
                    ? 'text-[11px] font-semibold tracking-[0.18em] uppercase text-[#F97316]'
                    : 'text-[11px] font-semibold tracking-[0.18em] uppercase text-[#94A3B8]'
                }
              >
                AI
              </span>
              <span
                className={
                  lineActive
                    ? 'text-[19px] md:text-[21px] leading-relaxed text-[#0F172A] font-medium transition-colors'
                    : 'text-[19px] md:text-[21px] leading-relaxed text-[#94A3B8] transition-colors'
                }
              >
                {TRACK.text}
              </span>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}
