'use client';
import { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';

const DEMO_TRACKS = {
  emergency: {
    label: 'Emergency',
    src: '/audio/demo-emergency.mp3',
    transcript: [
      { startSec: 0, endSec: 3.5, text: 'Voco: Thank you for calling — this is Voco. How can I help you today?' },
      { startSec: 3.5, endSec: 8.0, text: 'Caller: My water heater is leaking everywhere, I need someone now.' },
      { startSec: 8.0, endSec: 13.0, text: 'Voco: I understand — this is urgent. Let me get you the next available emergency slot.' },
      { startSec: 13.0, endSec: 18.0, text: 'Voco: I have a technician who can be there in 45 minutes. Can I confirm your address?' },
      { startSec: 18.0, endSec: 24.0, text: 'Caller: Yes, 1247 Oak Street. Please hurry.' },
      { startSec: 24.0, endSec: 30.0, text: "Voco: Confirmed. Technician dispatched. You'll receive a text with their ETA in under 2 minutes." },
    ],
  },
  routine: {
    label: 'Routine',
    src: '/audio/demo-routine.mp3',
    transcript: [
      { startSec: 0, endSec: 3.5, text: 'Voco: Thanks for calling Acme Plumbing — this is Voco.' },
      { startSec: 3.5, endSec: 9.0, text: 'Caller: Hi, I need to schedule a routine drain cleaning sometime next week.' },
      { startSec: 9.0, endSec: 14.0, text: 'Voco: Happy to help. I have Tuesday 10 AM, Wednesday 2 PM, or Friday 9 AM open.' },
      { startSec: 14.0, endSec: 18.0, text: 'Caller: Wednesday at 2 works.' },
      { startSec: 18.0, endSec: 24.0, text: "Voco: Booked. You'll get a confirmation text and a reminder the day before." },
    ],
  },
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const BAR_HEIGHTS = [20, 40, 60, 35, 50, 70, 45, 55, 30, 65, 50, 40, 55, 70, 45, 35, 60, 40, 50, 65, 35, 45, 55, 30];

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

  return (
    <section id="audio-demo" className="bg-white py-20 md:py-28 px-6">
      <AnimatedSection>
        <div className="max-w-5xl mx-auto">
          {/* Eyebrow + H2 */}
          <div className="text-center mb-12">
            <div className="text-[14px] font-semibold text-[#F97316] tracking-wide uppercase mb-3">Real calls</div>
            <h2 className="text-3xl md:text-[2.25rem] font-semibold text-[#0F172A]">Hear Voco handle a real call</h2>
          </div>

          {/* Tab pills */}
          <div className="flex gap-2 justify-center mb-8">
            {Object.entries(DEMO_TRACKS).map(([key, { label }]) => {
              const active = key === activeTab;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTabSwitch(key)}
                  className={
                    active
                      ? 'px-4 py-2 rounded-full bg-[#F97316]/10 border border-[#F97316]/30 text-[#F97316] text-[14px] font-semibold'
                      : 'px-4 py-2 rounded-full border border-stone-200 text-[#475569] text-[14px] font-semibold hover:border-stone-300'
                  }
                  aria-pressed={active}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Player + transcript 2-col layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Player card */}
            <div className="rounded-2xl bg-white border border-stone-200/70 shadow-sm p-6 flex flex-col gap-4">
              {/* Hidden audio element */}
              <audio
                ref={audioRef}
                src={DEMO_TRACKS[activeTab].src}
                preload="metadata"
              />

              {/* Error state */}
              {hasError && (
                <p className="text-[14px] text-[#475569] mt-2">Audio unavailable — read the full transcript below.</p>
              )}

              {/* 24-bar waveform visualizer */}
              <div className="flex items-end gap-1 h-16" aria-hidden="true">
                {Array.from({ length: 24 }).map((_, i) => {
                  const barActive = i / 24 <= progress;
                  return (
                    <div
                      key={i}
                      style={{ height: `${BAR_HEIGHTS[i] || 50}%` }}
                      className={barActive ? 'w-[3px] bg-[#F97316] rounded-full' : 'w-[3px] bg-stone-300 rounded-full'}
                    />
                  );
                })}
              </div>

              {/* Play + timestamp row */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex items-center justify-center w-11 h-11 rounded-full bg-[#F97316] text-white hover:bg-[#EA580C] transition-colors"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <div className="text-[14px] font-mono text-[#475569]">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>
            </div>

            {/* Transcript panel */}
            <div
              className="rounded-2xl bg-[#FAFAF9] border border-stone-200/70 p-6 max-h-[300px] overflow-y-auto"
              aria-live="polite"
            >
              {DEMO_TRACKS[activeTab].transcript.map((line, i) => {
                const active = i === activeLineIndex;
                return (
                  <div
                    key={i}
                    ref={active ? activeLineRef : null}
                    className={
                      active
                        ? 'text-[15px] font-semibold text-[#F97316] border-l-2 border-[#F97316] pl-2 my-2'
                        : 'text-[15px] text-[#475569] pl-2 my-2'
                    }
                  >
                    {line.text}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}
