'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

const WAVEFORM_BARS = 24;
const AUDIO_SRC = '/audio/demo-intro.mp3';

export function AudioPlayerCard() {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onEnded = () => {
      setIsPlaying(false);
      if (typeof window !== 'undefined' && window.__vocoPlayingAudio === audio) {
        window.__vocoPlayingAudio = null;
      }
    };
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (typeof window !== 'undefined' && window.__vocoPlayingAudio === audio) {
        window.__vocoPlayingAudio = null;
      }
    } else {
      // Pitfall 6: pause any other Voco-coordinated audio first
      if (typeof window !== 'undefined' && window.__vocoPlayingAudio && window.__vocoPlayingAudio !== audio) {
        try { window.__vocoPlayingAudio.pause(); } catch {}
      }
      audio.play().then(() => {
        setIsPlaying(true);
        if (typeof window !== 'undefined') window.__vocoPlayingAudio = audio;
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  };

  const fmt = (s) => {
    if (!s || !Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const activeBars = Math.round(progress * WAVEFORM_BARS);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="w-11 h-11 rounded-full bg-[#F97316] text-white flex items-center justify-center shrink-0 hover:bg-[#EA6B0F] transition-colors"
          aria-label={isPlaying ? 'Pause audio sample' : 'Play audio sample'}
        >
          {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
        </button>
        <div className="flex-1 flex items-center gap-[3px] h-12" aria-hidden="true">
          {Array.from({ length: WAVEFORM_BARS }).map((_, i) => {
            const h = 20 + ((i * 37) % 28); // pseudo-random bar heights
            return (
              <span
                key={i}
                className={`w-[3px] rounded-full ${i < activeBars ? 'bg-[#F97316]' : 'bg-[#F97316]/40'}`}
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>
        <span className="text-[14px] text-[#71717A] tabular-nums shrink-0">
          {fmt(currentTime)} / {fmt(duration)}
        </span>
      </div>
      <a href="#hero" className="text-[14px] text-[#F97316] hover:underline self-start">
        Or try the full interactive demo ↑
      </a>
      <audio ref={audioRef} src={AUDIO_SRC} preload="metadata" />
    </div>
  );
}
