'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CelebrationOverlay } from '@/components/onboarding/CelebrationOverlay';
import { clearWizardSession } from '@/hooks/useWizardSession';

export default function CheckoutSuccessContent() {
  const router = useRouter();
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [trialInfo, setTrialInfo] = useState(null);
  const [countdown, setCountdown] = useState(5);
  const redirectTimer = useRef(null);
  const countdownInterval = useRef(null);

  // Poll verify-checkout endpoint
  useEffect(() => {
    let cancelled = false;

    async function verify() {
      // Poll until Stripe webhook creates the subscription row.
      // 30 attempts * 2s = 60s max wait.
      for (let attempt = 0; attempt < 30; attempt++) {
        if (cancelled) return;

        try {
          const res = await fetch('/api/onboarding/verify-checkout');
          const data = await res.json();

          if (data.verified) {
            if (!cancelled) {
              setTrialInfo({
                planName: data.planName,
                trialEndDate: data.trialEndDate,
              });
              setStatus('success');
              clearWizardSession();
            }
            return;
          }
        } catch {
          // Retry on network error
        }

        // Wait 2 seconds before retrying (unless last attempt)
        if (attempt < 29) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      if (!cancelled) {
        setStatus('error');
      }
    }

    verify();
    return () => { cancelled = true; };
  }, []);

  // Auto-redirect countdown on success
  useEffect(() => {
    if (status !== 'success') return;

    countdownInterval.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    redirectTimer.current = setTimeout(() => {
      router.push('/dashboard');
    }, 5000);

    return () => {
      clearInterval(countdownInterval.current);
      clearTimeout(redirectTimer.current);
    };
  }, [status, router]);

  const handleGoToDashboard = useCallback(() => {
    clearTimeout(redirectTimer.current);
    clearInterval(countdownInterval.current);
    router.push('/dashboard');
  }, [router]);

  // Verifying state — wait for Stripe webhook
  if (status === 'verifying') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin size-8 border-2 border-[#C2410C] border-t-transparent rounded-full" />
        <h1 className="mt-6 text-xl font-semibold text-[#0F172A]">
          Processing your purchase
        </h1>
        <p className="mt-2 text-sm text-[#475569]">
          Hang tight, this usually takes just a few seconds...
        </p>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-[#475569]">
          We couldn&apos;t confirm your subscription. If you were charged, please{' '}
          <a href="/contact?type=support" className="underline text-[#C2410C]">
            contact support
          </a>
          .
        </p>
      </div>
    );
  }

  // Format trial end date
  const formattedDate = trialInfo?.trialEndDate
    ? new Date(trialInfo.trialEndDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  // Success state
  return (
    <div role="status" className="flex flex-col items-center text-center">
      {/* Celebration overlay */}
      <CelebrationOverlay />

      {/* Heading */}
      <h1 className="text-xl font-semibold text-[#0F172A] mt-6">
        You&apos;re all set!
      </h1>

      {/* Subheading */}
      <p className="mt-2 text-sm text-[#475569]">
        Your 14-day free trial is active. No charges until {formattedDate}.
      </p>

      {/* Trial info row */}
      <div className="flex items-center justify-center gap-4 mt-4 p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] w-full">
        <span className="text-sm font-semibold text-[#166534]">
          {trialInfo?.planName} plan
        </span>
        <span className="text-sm text-[#166534]">
          Free until {formattedDate}
        </span>
      </div>

      {/* Primary CTA */}
      <button
        onClick={handleGoToDashboard}
        aria-label="Go to your dashboard now"
        className="bg-[#C2410C] text-white hover:bg-[#C2410C]/90 w-full min-h-[44px] rounded-lg mt-4 font-medium text-sm transition-colors duration-150"
      >
        Go to Dashboard
      </button>

      {/* Auto-redirect countdown */}
      <p
        className="mt-3 text-xs text-[#475569]"
        aria-live="polite"
        aria-atomic="true"
      >
        Taking you to your dashboard in {countdown} seconds...
      </p>
    </div>
  );
}
