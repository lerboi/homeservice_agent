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
import { formatInternational } from '@/lib/phone/normalize';
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
  const [urlParamsApplied, setUrlParamsApplied] = useState(false);
  const [phase, setPhase] = useState(sessionId ? 'verifying' : 'checkout');
  const [checkoutError, setCheckoutError] = useState(null);
  const checkoutSessionIdRef = useRef(null);
  // Guards for the verify-checkout poll loop (handleComplete): cancelledRef stops
  // setState after unmount; pollingRef prevents two overlapping loops (the
  // sessionId effect + the error-screen "Check again" button).
  const pollingRef = useRef(false);
  const cancelledRef = useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);
  const [trialInfo, setTrialInfo] = useState(null);
  const [aiNumber, setAiNumber] = useState(null);
  const [countdown, setCountdown] = useState(10);

  // Wait for client hydration
  useEffect(() => setMounted(true), []);

  // Accept plan/interval from URL params (returning from pricing page).
  // Flip urlParamsApplied so EmbeddedCheckoutProvider waits until selectedPlan
  // has settled — mounting it earlier triggers a 400 (plan=null) and a
  // "fetchClientSecret changed" warning when the value lands a tick later.
  useEffect(() => {
    const plan = searchParams.get('plan');
    const interval = searchParams.get('interval');
    if (plan && ['starter', 'growth', 'scale'].includes(plan)) {
      setSelectedPlan(plan);
      setSelectedInterval(interval === 'annual' ? 'annual' : 'monthly');
    }
    setUrlParamsApplied(true);
  }, [searchParams, setSelectedPlan, setSelectedInterval]);

  // Check if plan is missing (show selection prompt instead of auto-redirect)
  const needsPlan = mounted && urlParamsApplied && !sessionId && !selectedPlan;

  // If returning from Stripe, run verification immediately
  useEffect(() => {
    if (sessionId && phase === 'verifying') {
      handleComplete();
    }
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Read plan/interval via refs so fetchClientSecret has a stable identity.
  // EmbeddedCheckoutProvider locks the callback on first mount and warns
  // ("You cannot change fetchClientSecret after setting it") on any change.
  const planRef = useRef(selectedPlan);
  const intervalRef = useRef(selectedInterval);
  useEffect(() => { planRef.current = selectedPlan; }, [selectedPlan]);
  useEffect(() => { intervalRef.current = selectedInterval; }, [selectedInterval]);

  const fetchClientSecret = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planRef.current,
          interval: intervalRef.current,
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
    } catch (e) {
      // Surface the failure as an app-level recovery screen. Otherwise the
      // rejection only reaches Stripe's <EmbeddedCheckout>, which renders a
      // blank/internal-error iframe inside the 300px box and strands the user —
      // notably the 409 "active subscription already exists" path on revisit.
      setCheckoutError(e?.message || 'We could not start checkout.');
      throw e;
    }
  }, []);

  // Handle checkout completion — wait for Stripe webhook to create subscription
  const handleComplete = useCallback(async () => {
    if (pollingRef.current) return; // one verify loop at a time
    pollingRef.current = true;
    setCheckoutError(null);
    setPhase('verifying');

    // Poll verify-checkout until webhook has created the subscription row.
    // Passes session_id so the endpoint can fall back to Stripe API if webhook is delayed.
    // First few attempts use fast path only (DB check), then include session_id for Stripe fallback.
    // Two-stage plan: 30×2s fast window (webhook normally lands here), then a
    // 12×10s slow tail (~3 min total) for webhook outages — timing out at 60s
    // stranded customers who had already paid.
    const sid = sessionId || searchParams.get('session_id') || checkoutSessionIdRef.current || '';
    const baseUrl = '/api/onboarding/verify-checkout';
    const fallbackUrl = sid
      ? `${baseUrl}?session_id=${encodeURIComponent(sid)}`
      : baseUrl;

    const POLL_PLAN = [
      { attempts: 30, delayMs: 2000 },
      { attempts: 12, delayMs: 10000 },
    ];

    let attempt = 0;
    for (const stage of POLL_PLAN) {
      for (let i = 0; i < stage.attempts; i++, attempt++) {
        if (cancelledRef.current) { pollingRef.current = false; return; }
        try {
          // First 3 attempts: DB-only (give webhook a chance). After that: include Stripe fallback.
          const url = attempt < 3 ? baseUrl : fallbackUrl;
          const res = await fetch(url);
          const data = await res.json();
          if (data.verified) {
            if (cancelledRef.current) { pollingRef.current = false; return; }
            setTrialInfo({ planName: data.planName, trialEndDate: data.trialEndDate });
            setPhase('success');
            markComplete();
            clearWizardSession();
            pollingRef.current = false;
            return;
          }
        } catch {
          // Retry on network error
        }
        await new Promise((r) => setTimeout(r, stage.delayMs));
      }
    }

    pollingRef.current = false;
    if (!cancelledRef.current) setPhase('error');
  }, [markComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-redirect countdown on success
  useEffect(() => {
    if (phase !== 'success') return;
    setCountdown(10);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const timer = setTimeout(() => router.push('/dashboard'), 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [phase, router]);

  // Fetch the provisioned AI number once verified — the webhook assigns it in
  // the same handler that flips verification, so it's usually ready on the
  // first try. A short poll covers slow provisioning; the dashboard banner and
  // welcome email are the fallbacks if it never lands here.
  useEffect(() => {
    if (phase !== 'success') return;
    let cancelled = false;
    let tries = 0;

    async function fetchNumber() {
      try {
        const res = await fetch('/api/onboarding/test-call-status');
        const data = await res.json();
        if (cancelled) return;
        if (data?.phone_number) {
          setAiNumber(data.phone_number);
          return;
        }
      } catch {
        // Fall through to retry
      }
      tries += 1;
      if (!cancelled && tries < 4) setTimeout(fetchNumber, 2000);
    }

    fetchNumber();
    return () => {
      cancelled = true;
    };
  }, [phase]);

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

  // Checkout failed to start (invalid plan, already-subscribed 409, network) —
  // a recoverable screen instead of a blank Stripe iframe.
  if (checkoutError && phase === 'checkout') {
    return (
      <div className="text-center py-6">
        <h1 className="text-xl font-semibold text-[#0F172A]">
          We couldn&apos;t start checkout
        </h1>
        <p className="mt-2 text-sm text-[#475569] max-w-sm mx-auto">
          {checkoutError}
        </p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="w-full max-w-xs inline-flex items-center justify-center bg-[#C2410C] text-white hover:bg-[#C2410C]/90 min-h-[44px] rounded-lg font-medium text-sm transition-colors duration-150"
          >
            Try again
          </button>
          <button
            onClick={handleGoToDashboard}
            className="w-full max-w-xs inline-flex items-center justify-center text-[#475569] hover:text-[#0F172A] min-h-[44px] rounded-lg font-medium text-sm transition-colors duration-150"
          >
            Go to my dashboard
          </button>
        </div>
        <p className="mt-4 text-xs text-[#475569]/80">
          Already subscribed? Your account is active — head to your dashboard. Still
          stuck?{' '}
          <a href="/contact?type=support" className="underline text-[#C2410C]">
            Contact support
          </a>
          .
        </p>
      </div>
    );
  }

  // Checkout phase — embedded Stripe form
  if (phase === 'checkout') {
    // Wait for URL params + sessionStorage to settle before mounting the
    // provider. Mounting with selectedPlan=null fires fetchClientSecret
    // immediately and the API rejects it (400 "Invalid plan").
    const checkoutReady = urlParamsApplied && !!selectedPlan;

    return (
      <div>
        <h1 className="text-xl font-semibold text-[#0F172A] text-center">
          Start your free trial
        </h1>
        <p className="mt-2 text-sm text-[#475569] text-center mb-6">
          Enter your payment details. You won&apos;t be charged for 14 days.
        </p>

        <div className="min-h-[300px]">
          {checkoutReady ? (
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ fetchClientSecret, onComplete: handleComplete }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <div className="flex justify-center py-12">
              <div className="animate-spin size-6 border-2 border-[#C2410C] border-t-transparent rounded-full" />
            </div>
          )}
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
        <h1 className="text-xl font-semibold text-[#0F172A]">
          Still confirming your subscription
        </h1>
        <p className="mt-2 text-sm text-[#475569] max-w-sm mx-auto">
          Payment confirmation is taking longer than usual. If your payment went
          through, your account will activate automatically —{' '}
          <strong>do not pay again</strong>.
        </p>
        <button
          onClick={handleComplete}
          className="mt-5 w-full max-w-xs inline-flex items-center justify-center bg-[#C2410C] text-white hover:bg-[#C2410C]/90 min-h-[44px] rounded-lg font-medium text-sm transition-colors duration-150"
        >
          Check again
        </button>
        <p className="mt-4 text-xs text-[#475569]/80">
          Still stuck after a few minutes?{' '}
          <a href="/contact?type=support" className="underline text-[#C2410C]">
            Contact support
          </a>{' '}
          — include the email you signed up with.
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

      {/* The AI receptionist number — the single most important deliverable */}
      <div className="mt-3 p-4 rounded-lg bg-[#FFF7ED] border border-[#FDBA74]/40 w-full">
        <p className="text-xs font-semibold text-[#9A3412] tracking-wide uppercase">
          Your AI receptionist number
        </p>
        {aiNumber ? (
          <>
            <p className="mt-1 font-mono text-xl tabular-nums text-[#0F172A] select-all">
              {formatInternational(aiNumber)}
            </p>
            <p className="mt-1 text-xs text-[#475569]">
              Call it from your cell right now and hear your AI answer.
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-[#475569]">
            Being assigned — it will appear on your dashboard in a moment, and
            we&apos;ve emailed it to you.
          </p>
        )}
      </div>

      <button
        onClick={handleGoToDashboard}
        aria-label="Go to your dashboard now"
        className="bg-[#C2410C] text-white hover:bg-[#C2410C]/90 w-full min-h-[44px] rounded-lg mt-4 font-medium text-sm transition-colors duration-150"
      >
        Go to Dashboard
      </button>

      <p className="mt-3 text-xs text-[#475569]" aria-live="polite" aria-atomic="true">
        Taking you to your dashboard in {countdown} second{countdown === 1 ? '' : 's'}...
      </p>
    </div>
  );
}
