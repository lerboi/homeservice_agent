'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * AudioPlayer — custom HTML5 audio player for call recordings.
 * Design spec: bg-stone-50, 36px circular play/pause, orange scrub bar.
 *
 * @param {{ src: string | null }} props
 */
export default function AudioPlayer({ src }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState(false);

  // Reset state when src changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(false);
  }, [src]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => setLoadError(true));
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, []);

  const handleError = useCallback(() => {
    setLoadError(true);
    setIsPlaying(false);
  }, []);

  const handleSeek = useCallback((e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  }, []);

  // No src or empty src
  if (!src) {
    return (
      <div className="bg-muted rounded-xl border border-border p-4">
        <p className="text-sm text-stone-400 text-center">
          Recording unavailable. The audio file may still be processing.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-muted rounded-xl border border-border p-4">
      {/* Hidden native audio element — handles codec and buffering */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
      />

      {loadError ? (
        <p className="text-sm text-stone-400 text-center">
          Recording unavailable. The audio file may still be processing.
        </p>
      ) : (
        <div className="flex items-center gap-3">
          {/* Play / Pause — 36px circular */}
          <button
            type="button"
            onClick={handlePlayPause}
            aria-label={isPlaying ? 'Pause recording' : 'Play recording'}
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-foreground text-background hover:bg-foreground/90 active:scale-95 transition-all duration-150"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" aria-hidden="true" />
            )}
          </button>

          {/* Scrub bar + time display */}
          <div className="flex-1 flex items-center gap-2">
            {/* Custom range input with orange progress */}
            <div className="relative flex-1 h-1.5">
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                aria-label="Seek audio"
                aria-valuemin={0}
                aria-valuemax={duration || 1}
                aria-valuenow={Math.round(currentTime)}
                className="
                  absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10
                "
              />
              {/* Track background */}
              <div className="absolute inset-0 rounded-full bg-border" />
              {/* Progress fill */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--brand-accent)] transition-all"
                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </div>

            {/* Duration display — tabular nums */}
            <span
              className="flex-shrink-0 text-[12px] text-stone-500 tabular-nums"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
