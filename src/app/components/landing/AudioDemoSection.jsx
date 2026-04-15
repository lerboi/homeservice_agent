'use client';
import { useState, useEffect, useRef } from 'react';
import { Play, Pause, PhoneCall } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';

const DEMO_TRACKS = {
  emergency: {
    label: 'Emergency',
    badge: 'After hours · 11:42 PM',
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
    badge: 'Tuesday · 2:14 PM',
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

const BAR_COUNT = 48;
const BAR_HEIGHTS = [
  20, 35, 55, 40, 70, 85, 60, 75, 45, 65, 80, 50, 30, 55, 70, 90, 60, 45, 75, 55, 35, 60, 80, 50,
  40, 65, 85, 55, 70, 45, 60, 80, 50, 35, 55, 75, 45, 65, 40, 55, 70, 50, 35, 60, 80, 55, 40, 65,
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
    <section id="audio-demo" className="bg-white py-20 md:py-28 px-6">
      <AnimatedSection>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#F97316] tracking-wide uppercase mb-3">
              <PhoneCall className="w-4 h-4" aria-hidden="true" />
              <span>Real call</span>
            </div>
            <h2 className="text-3xl md:text-[2.25rem] font-semibold text-[#0F172A]">Hear Voco handle a real call</h2>
          </div>

          <div className="flex gap-2 justify-center mb-6">
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

          <div className="rounded-3xl bg-gradient-to-br from-[#FAFAF9] to-white border border-stone-200/70 shadow-lg overflow-hidden">
            <div className="p-6 md:p-8 bg-[#0F172A] text-white">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <PhoneCall className="w-5 h-5 text-[#F97316]" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-[13px] text-white/70">Incoming call</div>
                    <div className="text-[14px] font-semibold text-white">{track.badge}</div>
                  </div>
                </div>
                <div className="text-[13px] font-mono text-white/60">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <audio ref={audioRef} src={track.src} preload="metadata" />

              <div className="flex items-end gap-[3px] h-24 md:h-28" aria-hidden="true">
                {Array.from({ length: BAR_COUNT }).map((_, i) => {
                  const barActive = i / BAR_COUNT <= progress;
                  return (
                    <div
                      key={i}
                      style={{ height: `${BAR_HEIGHTS[i] || 50}%` }}
                      className={
                        barActive
                          ? 'flex-1 bg-[#F97316] rounded-full transition-colors'
                          : 'flex-1 bg-white/15 rounded-full transition-colors'
                      }
                    />
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-center">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="group flex items-center justify-center w-16 h-16 rounded-full bg-[#F97316] text-white hover:bg-[#EA580C] shadow-lg shadow-[#F97316]/40 transition-all ring-4 ring-[#F97316]/20 hover:ring-[#F97316]/40"
                  aria-label={isPlaying ? 'Pause call' : 'Play call'}
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </button>
              </div>

              {hasError && (
                <p className="mt-4 text-center text-[13px] text-white/70">Audio unavailable — read the transcript below.</p>
              )}
            </div>

            <div className="p-6 md:p-8 bg-white" aria-live="polite">
              <ul className="flex flex-col gap-3">
                {track.transcript.map((line, i) => {
                  const active = i === activeLineIndex;
                  const isVoco = line.speaker === 'voco';
                  return (
                    <li
                      key={i}
                      ref={active ? activeLineRef : null}
                      className={isVoco ? 'flex justify-start' : 'flex justify-end'}
                    >
                      <div
                        className={
                          isVoco
                            ? active
                              ? 'max-w-[85%] rounded-2xl rounded-bl-sm bg-[#F97316] text-white px-4 py-3 text-[15px] shadow-sm'
                              : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-[#F97316]/10 text-[#0F172A] px-4 py-3 text-[15px]'
                            : active
                              ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-[#0F172A] text-white px-4 py-3 text-[15px] shadow-sm'
                              : 'max-w-[85%] rounded-2xl rounded-br-sm bg-stone-100 text-[#0F172A] px-4 py-3 text-[15px]'
                        }
                      >
                        <div
                          className={
                            isVoco
                              ? active
                                ? 'text-[11px] font-semibold uppercase tracking-wide text-white/80 mb-0.5'
                                : 'text-[11px] font-semibold uppercase tracking-wide text-[#F97316] mb-0.5'
                              : active
                                ? 'text-[11px] font-semibold uppercase tracking-wide text-white/70 mb-0.5'
                                : 'text-[11px] font-semibold uppercase tracking-wide text-[#475569] mb-0.5'
                          }
                        >
                          {isVoco ? 'Voco' : 'Caller'}
                        </div>
                        {line.text}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}
