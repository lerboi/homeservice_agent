'use client';
import { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';

const DEMO_TRACKS = {
  emergency: {
    label: 'Emergency',
    src: '/audio/demo-emergency.mp3',
    transcript: [
      { speaker: 'caller', startSec: 0, endSec: 5.5, text: 'My water heater is leaking everywhere — I need someone now.' },
      { speaker: 'voco', startSec: 5.5, endSec: 13.0, text: 'I hear you — this is urgent. I can dispatch a technician in 45 minutes. What’s the address?' },
      { speaker: 'caller', startSec: 13.0, endSec: 18.0, text: '1247 Oak Street. Please hurry.' },
      { speaker: 'voco', startSec: 18.0, endSec: 30.0, text: 'Confirmed. Tech en route. You’ll get an ETA text in under two minutes.' },
    ],
  },
  routine: {
    label: 'Routine',
    src: '/audio/demo-routine.mp3',
    transcript: [
      { speaker: 'caller', startSec: 0, endSec: 6.0, text: 'Hi — I need to schedule a routine drain cleaning next week.' },
      { speaker: 'voco', startSec: 6.0, endSec: 14.0, text: 'Happy to. Tuesday 10 AM, Wednesday 2 PM, or Friday 9 AM — what works?' },
      { speaker: 'caller', startSec: 14.0, endSec: 18.0, text: 'Wednesday at 2 works.' },
      { speaker: 'voco', startSec: 18.0, endSec: 24.0, text: 'Booked. Confirmation text on its way, with a reminder the day before.' },
    ],
  },
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
  const [activeTab, setActiveTab] = useState('emergency');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef(null);
  const activeLineRef = useRef(null);

  function handleTabSwitch(nextTab) {
    if (nextTab === activeTab) return;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setActiveTab(nextTab);
    setIsPlaying(false);
    setCurrentTime(0);
    setActiveLineIndex(-1);
    setHasError(false);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
  }, [activeTab]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => {
      const ct = audio.currentTime;
      setCurrentTime(ct);
      const idx = DEMO_TRACKS[activeTab].transcript.findIndex(
        (line) => ct >= line.startSec && ct < line.endSec
      );
      setActiveLineIndex(idx);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setActiveLineIndex(-1);
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
  }, [activeTab]);

  useEffect(() => {
    if (activeLineIndex >= 0 && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeLineIndex]);

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
  const track = DEMO_TRACKS[activeTab];

  return (
    <section id="audio-demo" className="bg-white py-24 md:py-32 px-6">
      <AnimatedSection>
        <div className="max-w-4xl mx-auto">
          <div className="max-w-2xl">
            <div className="text-[13px] font-semibold text-[#F97316] tracking-[0.18em] uppercase mb-4">Real call</div>
            <h2 className="text-4xl md:text-5xl font-semibold text-[#0F172A] leading-[1.1] tracking-tight">
              Hear Voco handle<br />a real call.
            </h2>
          </div>

          <div className="mt-14 flex items-center gap-6">
            <div className="flex items-center gap-1 border-b border-stone-200">
              {Object.entries(DEMO_TRACKS).map(([key, { label }]) => {
                const active = key === activeTab;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTabSwitch(key)}
                    className={
                      active
                        ? 'px-1 pb-3 text-[15px] font-semibold text-[#0F172A] border-b-2 border-[#F97316] -mb-px'
                        : 'px-1 pb-3 text-[15px] font-semibold text-[#94A3B8] border-b-2 border-transparent hover:text-[#475569]'
                    }
                    aria-pressed={active}
                  >
                    {label}
                    {active ? <span className="mx-3 text-stone-300">·</span> : <span className="ml-6" />}
                  </button>
                );
              })}
            </div>
            <div className="ml-auto text-[13px] font-mono text-[#94A3B8] tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <audio ref={audioRef} src={track.src} preload="metadata" />

          <div className="mt-10 flex items-center gap-6">
            <button
              type="button"
              onClick={togglePlay}
              className="shrink-0 flex items-center justify-center w-16 h-16 rounded-full bg-[#F97316] text-white hover:bg-[#EA580C] shadow-xl shadow-[#F97316]/25 transition-all hover:scale-105"
              aria-label={isPlaying ? 'Pause call' : 'Play call'}
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
            </button>
            <div className="flex-1 flex items-center gap-[3px] h-16" aria-hidden="true">
              {Array.from({ length: BAR_COUNT }).map((_, i) => {
                const barActive = i / BAR_COUNT <= progress;
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
          </div>

          {hasError && (
            <p className="mt-6 text-[14px] text-[#475569]">Audio unavailable — read the transcript below.</p>
          )}

          <div className="mt-14" aria-live="polite">
            <ul className="flex flex-col gap-6">
              {track.transcript.map((line, i) => {
                const active = i === activeLineIndex;
                const isVoco = line.speaker === 'voco';
                return (
                  <li
                    key={i}
                    ref={active ? activeLineRef : null}
                    className="grid grid-cols-[72px_1fr] gap-6 items-baseline"
                  >
                    <span
                      className={
                        active
                          ? isVoco
                            ? 'text-[11px] font-semibold tracking-[0.18em] uppercase text-[#F97316]'
                            : 'text-[11px] font-semibold tracking-[0.18em] uppercase text-[#0F172A]'
                          : 'text-[11px] font-semibold tracking-[0.18em] uppercase text-[#94A3B8]'
                      }
                    >
                      {isVoco ? 'Voco' : 'Caller'}
                    </span>
                    <span
                      className={
                        active
                          ? 'text-[19px] md:text-[21px] leading-relaxed text-[#0F172A] font-medium transition-colors'
                          : 'text-[19px] md:text-[21px] leading-relaxed text-[#94A3B8] transition-colors'
                      }
                    >
                      {line.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}
