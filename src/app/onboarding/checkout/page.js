'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js/pure';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';
import { CelebrationOverlay } from '@/components/onboarding/CelebrationOverlay';
import { clearWizardSession, useWizardSession } from '@/hooks/useWizardSession';
import { useOnboarding } from '../OnboardingContext';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { markComplete } = useOnboarding();
  const [selectedPlan] = useWizardSession('selected_plan', null);
  const [selectedInterval] = useWizardSession('selected_interval', 'monthly');

  // If returning from Stripe with session_id, go straight to verification
  const sessionId = searchParams.get('session_id');
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState(sessionId ? 'verifying' : 'checkout');
  const [trialInfo, setTrialInfo] = useState(null);
  const [countdown, setCountdown] = useState(5);

  // Wait for client hydration
  useEffect(() => setMounted(true), []);

  // If returning from Stripe, run verification immediately
  useEffect(() => {
    if (sessionId && phase === 'verifying') {
      handleComplete();
    }
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch client secret for embedded checkout
  const fetchClientSecret = useCallback(async () => {
    const res = await fetch('/api/onboarding/checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: selectedPlan,
        interval: selectedInterval,
        embedded: true,
      }),
    });
    const data = await res.json();
    return data.clientSecret;
  }, [selectedPlan, selectedInterval]);

  // Handle checkout completion
  const handleComplete = useCallback(async () => {
    setPhase('verifying');

    // Poll verify-checkout to confirm webhook processed
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const res = await fetch('/api/onboarding/verify-checkout');
        const data = await res.json();
        if (data.verified) {
          setTrialInfo({ planName: data.planName, trialEndDate: data.trialEndDate });
          setPhase('success');
          markComplete();
          clearWizardSession();
          return;
        }
      } catch {
        // Retry
      }
      await new Promise((r) => setTimeout(r, 1200));
    }

    setPhase('error');
  }, [markComplete]);

  // Auto-redirect countdown on success
  useEffect(() => {
    if (phase !== 'success') return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const timer = setTimeout(() => router.push('/dashboard'), 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [phase, router]);

  const handleGoToDashboard = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  // Show loading spinner until client hydration (skip plan check if returning from Stripe)
  if (!mounted || (!selectedPlan && !sessionId)) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin size-6 border-2 border-[#C2410C] border-t-transparent rounded-full" />
      </div>
    );
  }

  // Checkout phase — embedded Stripe form
  if (phase === 'checkout') {
    return (
      <div>
        <h1 className="text-xl font-semibold text-[#0F172A] text-center">
          Start your free trial
        </h1>
        <p className="mt-2 text-sm text-[#475569] text-center mb-6">
          Enter your payment details. You won&apos;t be charged for 14 days.
        </p>

        <div className="min-h-[300px]">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ fetchClientSecret, onComplete: handleComplete }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    );
  }

  // Verifying phase
  if (phase === 'verifying') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin size-8 border-2 border-[#C2410C] border-t-transparent rounded-full" />
        <p className="mt-4 text-sm text-[#475569]">Confirming your subscription...</p>
      </div>
    );
  }

  // Error phase
  if (phase === 'error') {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-[#475569]">
          We couldn&apos;t confirm your subscription. If you were charged, please{' '}
          <a href="/contact?type=support" className="underline text-[#C2410C]">
            contact support
          </a>.
        </p>
      </div>
    );
  }

  // Success phase — celebration inline
  const formattedDate = trialInfo?.trialEndDate
    ? new Date(trialInfo.trialEndDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div role="status" className="flex flex-col items-center text-center">
      <CelebrationOverlay />

      <h1 className="text-xl font-semibold text-[#0F172A] mt-6">
        You&apos;re all set!
      </h1>

      <p className="mt-2 text-sm text-[#475569]">
        Your 14-day free trial is active. No charges until {formattedDate}.
      </p>

      <div className="flex items-center justify-center gap-4 mt-4 p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] w-full">
        <span className="text-sm font-semibold text-[#166534]">
          {trialInfo?.planName} plan
        </span>
        <span className="text-sm text-[#166534]">
          Free until {formattedDate}
        </span>
      </div>

      <button
        onClick={handleGoToDashboard}
        aria-label="Go to your dashboard now"
        className="bg-[#C2410C] text-white hover:bg-[#C2410C]/90 w-full min-h-[44px] rounded-lg mt-4 font-medium text-sm transition-colors duration-150"
      >
        Go to Dashboard
      </button>

      <p className="mt-3 text-xs text-[#475569]" aria-live="polite" aria-atomic="true">
        Taking you to your dashboard in {countdown} seconds...
      </p>
    </div>
  );
}
