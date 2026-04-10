'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { card, btn, selected, focus } from '@/lib/design-tokens';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const VOICES = [
  { name: 'Aoede', description: 'Warm and upbeat', gender: 'female' },
  { name: 'Erinome', description: 'Bright and expressive', gender: 'female' },
  { name: 'Sulafat', description: 'Warm and gentle', gender: 'female' },
  { name: 'Zephyr', description: 'Bright and clear', gender: 'male' },
  { name: 'Achird', description: 'Relaxed, neighborly', gender: 'male' },
  { name: 'Charon', description: 'Deep and authoritative', gender: 'male' },
];

const femaleVoices = VOICES.filter((v) => v.gender === 'female');
const maleVoices = VOICES.filter((v) => v.gender === 'male');

export default function VoicePickerSection({ initialVoice, loading }) {
  const [selectedVoice, setSelectedVoice] = useState(initialVoice ?? null);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [saving, setSaving] = useState(false);
  const audioRef = useRef(null);

  // Sync selectedVoice when initialVoice prop changes (after page data loads)
  useEffect(() => {
    setSelectedVoice(initialVoice ?? null);
  }, [initialVoice]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  function handlePlay(voiceName) {
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

  async function handleSave() {
    if (!selectedVoice) return;
    setSaving(true);
    try {
      const res = await fetch('/api/ai-voice-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_voice: selectedVoice }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }
      toast.success('Voice updated');
    } catch (err) {
      toast.error("Couldn't save your voice selection. Try again.");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="mb-6">
        <h2 className="text-base font-semibold text-[#0F172A]">AI Voice</h2>
        <p className="text-sm text-[#475569] mt-1">Choose the voice your AI receptionist uses on calls.</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {VOICES.map((v) => (
            <Skeleton key={v.name} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="text-base font-semibold text-[#0F172A]">AI Voice</h2>
      <p className="text-sm text-[#475569] mt-1">Choose the voice your AI receptionist uses on calls.</p>

      <div className="mt-4">
        {/* Female group */}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] mb-2">Female</p>
        <div role="radiogroup" aria-label="Female voices" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {femaleVoices.map((voice) => {
            const isSelected = selectedVoice === voice.name;
            const isPlaying = playingVoice === voice.name;
            return (
              <div
                key={voice.name}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => setSelectedVoice(voice.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedVoice(voice.name);
                  }
                }}
                className={`${card.base} ${isSelected ? selected.card : selected.cardIdle} ${!isSelected ? card.hover : ''} relative p-4 cursor-pointer ${focus.ring}`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlay(voice.name);
                  }}
                  aria-label={isPlaying ? `Pause ${voice.name} preview` : `Play ${voice.name} preview`}
                  className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-full hover:bg-stone-100"
                >
                  {isPlaying ? (
                    <Pause size={16} className="text-[#C2410C]" />
                  ) : (
                    <Play size={16} className="text-stone-500" />
                  )}
                </button>
                <p className="text-sm font-semibold text-[#0F172A]">{voice.name}</p>
                <p className="text-xs text-[#475569] mt-1">{voice.description}</p>
              </div>
            );
          })}
        </div>

        {/* 24px spacer */}
        <div className="h-6" />

        {/* Male group */}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] mb-2">Male</p>
        <div role="radiogroup" aria-label="Male voices" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {maleVoices.map((voice) => {
            const isSelected = selectedVoice === voice.name;
            const isPlaying = playingVoice === voice.name;
            return (
              <div
                key={voice.name}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => setSelectedVoice(voice.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedVoice(voice.name);
                  }
                }}
                className={`${card.base} ${isSelected ? selected.card : selected.cardIdle} ${!isSelected ? card.hover : ''} relative p-4 cursor-pointer ${focus.ring}`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlay(voice.name);
                  }}
                  aria-label={isPlaying ? `Pause ${voice.name} preview` : `Play ${voice.name} preview`}
                  className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-full hover:bg-stone-100"
                >
                  {isPlaying ? (
                    <Pause size={16} className="text-[#C2410C]" />
                  ) : (
                    <Play size={16} className="text-stone-500" />
                  )}
                </button>
                <p className="text-sm font-semibold text-[#0F172A]">{voice.name}</p>
                <p className="text-xs text-[#475569] mt-1">{voice.description}</p>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-[#94A3B8] mt-3">Takes effect on the next inbound call.</p>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSave}
            disabled={saving || !selectedVoice}
            aria-busy={saving}
            aria-label="Save voice selection"
            className={`${btn.primary} px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2`}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save Voice'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
