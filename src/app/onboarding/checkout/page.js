'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
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
  const [selectedPlan, setSelectedPlan] = useWizardSession('selected_plan', null);
  const [selectedInterval, setSelectedInterval] = useWizardSession('selected_interval', 'monthly');

  // If returning from Stripe with session_id, go straight to verification
  const sessionId = searchParams.get('session_id');
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState(sessionId ? 'verifying' : 'checkout');
  const [checkoutError, setCheckoutError] = useState(null);
  const checkoutSessionIdRef = useRef(null);
  const [trialInfo, setTrialInfo] = useState(null);
  const [countdown, setCountdown] = useState(5);

  // Wait for client hydration
  useEffect(() => setMounted(true), []);

  // Accept plan/interval from URL params (returning from pricing page)
  useEffect(() => {
    const plan = searchParams.get('plan');
    const interval = searchParams.get('interval');
    if (plan && ['starter', 'growth', 'scale'].includes(plan)) {
      setSelectedPlan(plan);
      setSelectedInterval(interval === 'annual' ? 'annual' : 'monthly');
    }
  }, [searchParams, setSelectedPlan, setSelectedInterval]);

  // Check if plan is missing (show selection prompt instead of auto-redirect)
  const needsPlan = mounted && !sessionId && !selectedPlan && !searchParams.get('plan');

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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create checkout session');
    }
    const data = await res.json();
    if (!data.clientSecret) {
      throw new Error('No client secret returned');
    }
    if (data.sessionId) {
      checkoutSessionIdRef.current = data.sessionId;
    }
    return data.clientSecret;
  }, [selectedPlan, selectedInterval]);

  // Handle checkout completion — wait for Stripe webhook to create subscription
  const handleComplete = useCallback(async () => {
    setPhase('verifying');

    // Poll verify-checkout until webhook has created the subscription row.
    // Passes session_id so the endpoint can fall back to Stripe API if webhook is delayed.
    // First few attempts use fast path only (DB check), then include session_id for Stripe fallback.
    // 30 attempts * 2s = 60s max wait.
    const sid = sessionId || searchParams.get('session_id') || checkoutSessionIdRef.current || '';
    const baseUrl = '/api/onboarding/verify-checkout';
    const fallbackUrl = sid
      ? `${baseUrl}?session_id=${encodeURIComponent(sid)}`
      : baseUrl;

    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        // First 3 attempts: DB-only (give webhook a chance). After that: include Stripe fallback.
        const url = attempt < 3 ? baseUrl : fallbackUrl;
        const res = await fetch(url);
        const data = await res.json();
        if (data.verified) {
          setTrialInfo({ planName: data.planName, trialEndDate: data.trialEndDate });
          setPhase('success');
          markComplete();
          clearWizardSession();
          return;
        }
      } catch {
        // Retry on network error
      }
      await new Promise((r) => setTimeout(r, 2000));
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

  // Show loading spinner until client hydration
  if (!mounted) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin size-6 border-2 border-[#C2410C] border-t-transparent rounded-full" />
      </div>
    );
  }

  // No plan selected — prompt user to pick one
  if (needsPlan) {
    return (
      <div className="flex flex-col items-center text-center py-8 px-4">
        <div className="w-14 h-14 rounded-2xl bg-[#FFF7ED] border border-[#FDBA74]/30 flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-[#C2410C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-[#0F172A]">
          Choose a plan to continue
        </h1>
        <p className="mt-2 text-sm text-[#475569] max-w-sm">
          You&apos;re almost there! Select a plan to start your 14-day free trial. You won&apos;t be charged today.
        </p>

        <Link
          href="/pricing?return=checkout"
          className="mt-6 w-full max-w-xs inline-flex items-center justify-center gap-2 bg-[#C2410C] text-white hover:bg-[#C2410C]/90 min-h-[44px] rounded-lg font-medium text-sm transition-colors duration-150"
        >
          View Plans & Pricing
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>

        <div className="mt-5 flex items-center gap-2 text-xs text-[#475569]/70">
          <svg className="w-3.5 h-3.5 text-[#22C55E] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Your onboarding progress is saved — you&apos;ll pick up right here.
        </div>
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

  // Verifying phase — wait for Stripe webhook
  if (phase === 'verifying') {
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
