'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { HeroDemoInput } from './HeroDemoInput';

// Lazy-load player (uses Web Audio API — no SSR)
const HeroDemoPlayer = dynamic(
  () => import('./HeroDemoPlayer').then((m) => m.HeroDemoPlayer),
  { ssr: false }
);

export function HeroDemoBlock() {
  const [audioBuffers, setAudioBuffers] = useState(null);

  function handleAudioReady({ audioBuffers: buffers }) {
    setAudioBuffers(buffers);
  }

  return (
    <div className="relative">
      {!audioBuffers ? (
        <div className="animate-in fade-in duration-200">
          <HeroDemoInput onAudioReady={handleAudioReady} />
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
          <HeroDemoPlayer audioBuffers={audioBuffers} />
        </div>
      )}
    </div>
  );
}
