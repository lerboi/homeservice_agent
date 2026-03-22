'use client';
import { useState, useEffect } from 'react';
import { Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CelebrationOverlay } from '@/components/onboarding/CelebrationOverlay';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';

export function TestCallPanel({ phoneNumber, onComplete, onGoToDashboard }) {
  const [callState, setCallState] = useState('ready');
  const [error, setError] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Elapsed time counter for in_progress state
  useEffect(() => {
    if (callState !== 'in_progress') {
      setElapsedSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [callState]);

  // Polling logic — active when calling or in_progress
  useEffect(() => {
    if (callState !== 'calling' && callState !== 'in_progress') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/onboarding/test-call-status');
        const data = await res.json();
        if (data.complete) {
          clearInterval(interval);
          setCallState('complete');
          if (onComplete) onComplete();
        }
      } catch {
        // polling failure is transient — ignore and retry next interval
      }
    }, 4000);

    // Timeout after 3 minutes
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setCallState('timeout');
    }, 180000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [callState, onComplete]);

  async function handleCallMyAI() {
    setCallState('calling');
    setError(null);
    try {
      const res = await fetch('/api/onboarding/test-call', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "We couldn't reach your phone. Check the number and try again.");
        setCallState('ready');
        return;
      }
      setCallState('in_progress');
    } catch {
      setError("We couldn't reach your phone. Check the number and try again.");
      setCallState('ready');
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (callState === 'ready') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight mb-2">
            Meet your AI receptionist
          </h1>
          <p className="text-base text-[#475569]">
            Call the number below -- your AI will answer.
          </p>
        </div>

        {/* Phone number display */}
        <div className="bg-white rounded-2xl border border-stone-200 px-6 py-4 text-center">
          <span className="text-3xl font-semibold text-[#0F172A] tracking-wider">
            {phoneNumber}
          </span>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleCallMyAI}
            className="w-full min-h-[52px] bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] text-white shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all duration-150"
          >
            Call My AI Now
          </Button>
          <p className="text-sm text-[#475569] text-center">
            Prefer to call manually? Dial the number above.
          </p>
        </div>
      </div>
    );
  }

  if (callState === 'calling') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight mb-2">
            Meet your AI receptionist
          </h1>
          <p className="text-base text-[#475569]">
            Your phone should ring in a few seconds
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 py-6">
          <Loader2 className="size-10 text-[#C2410C] animate-spin" aria-hidden="true" />
          <span className="text-base text-[#0F172A] font-medium">Connecting...</span>
        </div>
      </div>
    );
  }

  if (callState === 'in_progress') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight mb-2">
            Meet your AI receptionist
          </h1>
        </div>

        <div className="flex flex-col items-center gap-4 py-6">
          {/* Pulsing phone icon with green ring */}
          <div className="size-16 rounded-full ring-2 ring-[#166534] animate-pulse flex items-center justify-center bg-white">
            <Phone className="size-7 text-[#166534]" aria-hidden="true" />
          </div>
          <div className="text-center">
            <p className="text-base text-[#0F172A] font-medium">Call in progress...</p>
            <p className="text-sm text-[#475569] mt-1">{formatTime(elapsedSeconds)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (callState === 'complete') {
    return (
      <AnimatedSection>
        <div className="flex flex-col items-center gap-6 text-center">
          <CelebrationOverlay />

          <div>
            <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight mb-2">
              Your AI receptionist is live!
            </h1>
            <p className="text-base text-[#475569]">
              Your first call has been answered. The AI is ready to capture every lead.
            </p>
          </div>

          <Button
            onClick={onGoToDashboard}
            className="w-full min-h-11 bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] text-white shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all duration-150"
          >
            Go to Dashboard
          </Button>
        </div>
      </AnimatedSection>
    );
  }

  if (callState === 'timeout') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight mb-2">
            Meet your AI receptionist
          </h1>
        </div>

        <Alert>
          <AlertDescription>
            We couldn&apos;t confirm your call completed. Try again or head to the dashboard.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => setCallState('calling')}
            className="w-full min-h-11 bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] text-white shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all duration-150"
          >
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={onGoToDashboard}
            className="w-full min-h-11"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
