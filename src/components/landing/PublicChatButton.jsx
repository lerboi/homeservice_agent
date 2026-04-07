'use client';

import { useState, useEffect } from 'react';
import { Headset, X } from 'lucide-react';
import PublicChatPanel from './PublicChatPanel';

export default function PublicChatButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);

  // Trigger mount animation
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Show speech bubble after delay
  useEffect(() => {
    if (bubbleDismissed) return;
    const t = setTimeout(() => setShowBubble(true), 800);
    return () => clearTimeout(t);
  }, [bubbleDismissed]);

  // Hide bubble when chat opens
  useEffect(() => {
    if (open && showBubble) {
      setShowBubble(false);
      setBubbleDismissed(true);
    }
  }, [open, showBubble]);

  function dismissBubble(e) {
    e.stopPropagation();
    setShowBubble(false);
    setBubbleDismissed(true);
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleEsc(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open]);

  return (
    <>
      {open && <PublicChatPanel onClose={() => setOpen(false)} />}

      <div className="fixed bottom-6 right-4 lg:right-6 z-40 flex flex-col items-center">
        {/* Speech bubble — in flow so FAB centers under it */}
        <div
          className={`mb-3 relative bg-white text-[#0F172A] text-sm font-medium
            pl-4 pr-2 py-2 rounded-xl shadow-lg border border-stone-200 whitespace-nowrap
            flex items-center gap-2
            transition-all duration-300 ease-out
            ${showBubble && !open
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
        >
          <span>Ask Voco AI</span>
          <button
            onClick={dismissBubble}
            className="p-0.5 rounded-full hover:bg-stone-100 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5 text-[#94A3B8]" />
          </button>
          {/* Downward caret pointing to button */}
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3
              bg-white border-r border-b border-stone-200 rotate-45"
          />
        </div>

        {/* FAB — 64px, Headset icon. Slides right when bubble is not visible */}
        <button
          onClick={() => setOpen((prev) => !prev)}
          className={`h-16 w-16 rounded-full
            bg-[#C2410C] hover:bg-[#C2410C]/90 text-white shadow-lg
            flex items-center justify-center transition-all duration-300
            focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-2
            ${mounted ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}
            ${showBubble && !open ? '' : 'translate-x-9'}`}
          aria-label={open ? 'Close chat' : 'Open Voco AI chat'}
        >
          {open ? (
            <X className="h-7 w-7" />
          ) : (
            <Headset className="h-7 w-7" />
          )}
        </button>
      </div>
    </>
  );
}
