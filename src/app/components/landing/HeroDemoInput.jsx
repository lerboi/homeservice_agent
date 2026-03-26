'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function HeroDemoInput({ onAudioReady }) {
  const [state, setState] = useState('idle'); // 'idle' | 'loading'
  const [businessName, setBusinessName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    import('@/lib/supabase-browser').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
    });
  }, []);

  async function handleSubmit() {
    if (businessName.trim().length < 2 || state === 'loading') return;

    setState('loading');

    try {
      const [nameRes, introRes, midRes, outroRes] = await Promise.all([
        fetch('/api/demo-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessName: businessName.trim() }),
        }),
        fetch('/audio/demo-intro.mp3'),
        fetch('/audio/demo-mid.mp3'),
        fetch('/audio/demo-outro.mp3'),
      ]);

      if (!nameRes.ok) {
        throw new Error(`TTS API returned ${nameRes.status}`);
      }

      const [nameBuf, introBuf, midBuf, outroBuf] = await Promise.all([
        nameRes.arrayBuffer(),
        introRes.arrayBuffer(),
        midRes.arrayBuffer(),
        outroRes.arrayBuffer(),
      ]);

      // Order: intro, name, mid, outro
      onAudioReady({ audioBuffers: [introBuf, nameBuf, midBuf, outroBuf] });
    } catch (err) {
      console.error('[HeroDemoInput] audio fetch error:', err);
      toast.error("Couldn't generate your demo. Check your connection and try again.");
      setState('idle');
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        {/* Input + button container — pill shape */}
        <div className="flex flex-col sm:flex-row bg-white/[0.10] border border-white/[0.12] rounded-xl focus-within:ring-1 focus-within:ring-[#F97316] transition-shadow">
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Enter your business name..."
            disabled={state === 'loading'}
            aria-label="Your business name"
            aria-required="true"
            className="flex-1 bg-transparent px-4 py-3 text-white placeholder:text-white/30 text-sm focus:outline-none min-h-[52px]"
          />
          <button
            type="submit"
            disabled={businessName.trim().length < 2 || state === 'loading'}
            className="bg-[#F97316] text-white text-sm px-5 py-3 rounded-b-xl sm:rounded-bl-none sm:rounded-r-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F97316]/90 min-h-[52px] flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {state === 'loading' ? (
              <>
                <Loader2 className="animate-spin size-4" />
                Generating...
              </>
            ) : (
              'Listen to Your Demo'
            )}
          </button>
        </div>
      </form>

      {/* Secondary skip link */}
      <div className="mt-4 text-center">
        <Link
          href={isLoggedIn ? '/dashboard' : '/onboarding'}
          className="text-sm text-white/30 hover:text-white/50 transition-colors"
        >
          {isLoggedIn ? 'Go to Dashboard' : 'Skip the demo \u2014 Start your free trial'}
        </Link>
      </div>
    </div>
  );
}
