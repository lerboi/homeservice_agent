'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const VOICES = [
  { name: 'Aoede', description: 'Warm and upbeat' },
  { name: 'Erinome', description: 'Bright and expressive' },
  { name: 'Sulafat', description: 'Warm and gentle' },
  { name: 'Zephyr', description: 'Bright and clear' },
  { name: 'Achird', description: 'Relaxed, neighborly' },
  { name: 'Charon', description: 'Deep and authoritative' },
];

export default function VoicePickerSection({ initialVoice, loading }) {
  const [selectedVoice, setSelectedVoice] = useState(initialVoice ?? '');
  const [open, setOpen] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [saving, setSaving] = useState(false);
  const audioRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setSelectedVoice(initialVoice ?? '');
  }, [initialVoice]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  function handlePlay(e, voiceName) {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingVoice === voiceName) {
      setPlayingVoice(null);
      return;
    }
    const audio = new Audio(`/audio/voices/${voiceName.toLowerCase()}.mp3`);
    audio.addEventListener('ended', () => setPlayingVoice(null));
    audio.play();
    audioRef.current = audio;
    setPlayingVoice(voiceName);
  }

  async function handleSelect(voiceName) {
    setSelectedVoice(voiceName);
    setOpen(false);
    setSaving(true);
    try {
      const res = await fetch('/api/ai-voice-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_voice: voiceName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }
      toast.success('Voice updated');
    } catch {
      toast.error("Couldn't save voice. Try again.");
    }
    setSaving(false);
  }

  const current = VOICES.find((v) => v.name === selectedVoice);

  if (loading) {
    return (
      <div className="mb-6">
        <label className="text-sm font-medium text-[#0F172A]">Voice</label>
        <div className="mt-1.5 h-10 w-full max-w-xs rounded-lg bg-stone-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mb-6">
      <label className="text-sm font-medium text-[#0F172A]">Voice</label>
      <div ref={dropdownRef} className="relative mt-1.5 w-full max-w-xs">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-[#0F172A] hover:border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C]"
        >
          <span>
            {current ? (
              <>
                {current.name}
                <span className="text-[#475569] ml-1.5">— {current.description}</span>
              </>
            ) : (
              <span className="text-[#94A3B8]">Select a voice</span>
            )}
          </span>
          <ChevronDown size={16} className={`text-[#94A3B8] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-stone-200 bg-white shadow-lg py-1">
            {VOICES.map((voice) => {
              const isSelected = selectedVoice === voice.name;
              const isPlaying = playingVoice === voice.name;
              return (
                <div
                  key={voice.name}
                  onClick={() => handleSelect(voice.name)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-stone-50 ${isSelected ? 'bg-stone-50' : ''}`}
                >
                  <div>
                    <span className={`text-sm ${isSelected ? 'font-semibold text-[#C2410C]' : 'text-[#0F172A]'}`}>
                      {voice.name}
                    </span>
                    <span className="text-xs text-[#475569] ml-1.5">— {voice.description}</span>
                  </div>
                  <button
                    onClick={(e) => handlePlay(e, voice.name)}
                    aria-label={isPlaying ? `Pause ${voice.name}` : `Play ${voice.name}`}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
                  >
                    {isPlaying ? (
                      <Pause size={14} className="text-[#C2410C]" />
                    ) : (
                      <Play size={14} className="text-stone-400" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {saving && <p className="text-xs text-[#94A3B8] mt-1.5">Saving...</p>}
      <p className="text-xs text-[#94A3B8] mt-1.5">Takes effect on the next inbound call.</p>
    </div>
  );
}
