'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Phone, Calendar, ArrowLeft, Shield, Zap, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase-browser';
import Image from 'next/image';
import { OtpInput } from '@/components/onboarding/OtpInput';

/* ────────────────────────────────────────────────────────────────────── */
/*  Static helpers / data — hoisted outside the component to avoid       */
/*  re-creation on every render.                                         */
/* ────────────────────────────────────────────────────────────────────── */

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="flex-shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function VocoLogo() {
  return (
    <Link href="/" className="flex items-center lg:justify-center">
      <Image
        src="/images/logos/VOCO%20Logo%20V1%20(no%20bg).png"
        alt="Voco"
        width={160}
        height={52}
        className="h-13 w-auto"
        priority
      />
    </Link>
  );
}

const SELLING_POINTS_SIGNUP = [
  { icon: Phone, text: 'Every call answered 24/7' },
  { icon: Calendar, text: 'Auto-books appointments' },
  { icon: Zap, text: 'Setup in under 5 minutes' },
  { icon: Shield, text: 'No credit card required' },
];

const SELLING_POINTS_SIGNIN = [
  { icon: Phone, text: 'Your calls, handled' },
  { icon: Calendar, text: 'Appointments on autopilot' },
  { icon: Zap, text: 'Pick up where you left off' },
  { icon: Lock, text: 'Secure & encrypted' },
];

/* ────────────────────────────────────────────────────────────────────── */
/*  Component                                                            */
/* ────────────────────────────────────────────────────────────────────── */

export default function AuthPage() {
  const [mode, setMode] = useState('signup'); // 'signup' | 'signin' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const isSignin = mode === 'signin';

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  /* ── Auth handlers ────────────────────────────────────────────────── */

  async function handleGoogleOAuth() {
    setError('');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          window.location.origin +
          '/auth/callback?next=' +
          encodeURIComponent('/onboarding'),
      },
    });
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes('after')
          ? 'Please wait a moment before trying again.'
          : signUpError.message || 'Something went wrong. Please try again.'
      );
      setLoading(false);
      return;
    }
    if (signUpData?.user?.identities?.length === 0) {
      setError('An account with this email already exists. Sign in instead.');
      setLoading(false);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    if (otpError) {
      setError(
        otpError.message.toLowerCase().includes('after')
          ? 'Please wait a moment before trying again.'
          : otpError.message || 'Something went wrong. Please try again.'
      );
      setLoading(false);
      return;
    }

    setCooldown(30);
    setMode('otp');
    setLoading(false);
  }

  async function handleSignin(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError('Invalid email or password. Please try again.');
      setLoading(false);
      return;
    }
    window.location.href = '/onboarding';
    setLoading(false);
  }

  async function handleVerifyOtp(code) {
    setVerifying(true);
    setError('');
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: 'email',
    });
    if (verifyError) {
      setError(
        verifyError.message.toLowerCase().includes('expired')
          ? 'That code has expired. Request a new one.'
          : "That code didn't match. Check your email and try again."
      );
      setVerifying(false);
      return;
    }
    window.location.href = '/onboarding';
    setVerifying(false);
  }

  async function handleResendOtp() {
    if (cooldown > 0) return;
    setError('');
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    if (resendError) {
      setError(
        resendError.message.toLowerCase().includes('after')
          ? 'Please wait a moment before trying again.'
          : resendError.message || 'Something went wrong. Please try again.'
      );
      return;
    }
    setCooldown(30);
  }

  function switchMode(newMode) {
    setMode(newMode);
    setError('');
  }

  /* ── OTP View ─────────────────────────────────────────────────────── */

  if (mode === 'otp') {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8"><VocoLogo /></div>

          <div className="bg-white rounded-2xl p-8 sm:p-10 text-center shadow-2xl">
            <div className="flex justify-center mb-4">
              <Mail className="size-8 text-[#C2410C]" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-semibold text-[#0F172A] tracking-tight mb-2">
              Check your email
            </h1>
            <p className="text-sm text-[#475569] mb-6">
              We sent a 6-digit code to{' '}
              <span className="font-semibold text-[#0F172A]">{email}</span>
            </p>

            {error && (
              <Alert variant="destructive" className="mb-6 rounded-xl text-left">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="mb-6">
              <OtpInput onComplete={handleVerifyOtp} disabled={verifying} />
            </div>

            {verifying && (
              <div className="flex justify-center mb-4">
                <Loader2 className="h-5 w-5 animate-spin text-[#C2410C]" aria-hidden="true" />
              </div>
            )}

            <p className="text-sm text-[#475569]">
              Didn&apos;t receive it?{' '}
              {cooldown > 0 ? (
                <span className="text-[#475569]">Resend in {cooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="text-[#C2410C] font-semibold hover:underline focus:outline-none"
                >
                  Resend code
                </button>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => switchMode('signup')}
            className="mt-6 flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F172A] transition-colors mx-auto"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign up
          </button>
        </div>
      </div>
    );
  }

  /* ── Main Auth View — sliding panels (mobile + desktop) ───────────── */
  /*                                                                      */
  /*  Performance notes:                                                  */
  /*  • Only transform & opacity are animated (compositor-only — no       */
  /*    layout or paint triggered).                                       */
  /*  • prefers-reduced-motion is respected via motion-reduce: variant.   */
  /*  • Blur decorations use smaller radii on mobile and are static       */
  /*    (painted once, never re-rasterised).                              */
  /*  • Single form instance — no DOM duplication for inputs.             */
  /* ──────────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[960px]">
        <div className="rounded-2xl overflow-hidden shadow-2xl relative">

          {/* ─────────────────────────────────────────────────────────── */}
          {/*  Mobile brand slider (< lg)                                */}
          {/*  Two compact dark headers side-by-side; translateX swaps.  */}
          {/* ─────────────────────────────────────────────────────────── */}
          <div className="lg:hidden overflow-hidden">
            <div
              className={`
                flex w-[200%]
                transition-transform duration-500 ease-in-out
                motion-reduce:transition-none
                ${isSignin ? '-translate-x-1/2' : 'translate-x-0'}
              `}
            >
              {/* Signup header */}
              <div className="w-1/2 bg-[#1E293B] px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <Image
                    src="/images/logos/WHITE%20VOCO%20LOGO%20V1%20(no%20bg).png"
                    alt="Voco"
                    width={100}
                    height={32}
                    className="h-7 w-auto"
                  />
                  <Link href="/" className="text-[11px] text-[#64748B] hover:text-[#94A3B8] transition-colors">
                    Home
                  </Link>
                </div>
                <h1 className="text-xl font-semibold text-[#F1F5F9] tracking-tight">
                  Create your account
                </h1>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  Start your 5-minute setup
                </p>
              </div>

              {/* Signin header */}
              <div className="w-1/2 bg-[#1E293B] px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <Image
                    src="/images/logos/WHITE%20VOCO%20LOGO%20V1%20(no%20bg).png"
                    alt="Voco"
                    width={100}
                    height={32}
                    className="h-7 w-auto"
                  />
                  <Link href="/" className="text-[11px] text-[#64748B] hover:text-[#94A3B8] transition-colors">
                    Home
                  </Link>
                </div>
                <h1 className="text-xl font-semibold text-[#F1F5F9] tracking-tight">
                  Welcome back
                </h1>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  Sign in to your dashboard
                </p>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────── */}
          {/*  Form panel (shared mobile + desktop)                      */}
          {/*  In normal flow → sets container height.                   */}
          {/*  Desktop: slides left ↔ right.  Mobile: stays put.         */}
          {/* ─────────────────────────────────────────────────────────── */}
          <div
            className={`
              relative z-10 w-full lg:w-1/2 bg-white p-6 sm:p-8 lg:p-12
              transition-transform duration-700 ease-in-out
              motion-reduce:transition-none
              ${isSignin ? 'lg:translate-x-full' : 'lg:translate-x-0'}
            `}
          >
            <div className="mb-6 hidden lg:block">
              <VocoLogo />
            </div>

            <div className="mb-6 hidden lg:block">
              <h1 className="text-2xl font-semibold text-[#0F172A] tracking-tight">
                {isSignin ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="mt-1.5 text-sm text-[#475569]">
                {isSignin ? 'Sign in to your dashboard' : 'Start your 5-minute setup'}
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-5 rounded-xl">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Google OAuth */}
            <Button
              type="button"
              onClick={handleGoogleOAuth}
              variant="outline"
              className="w-full min-h-[44px] bg-white hover:bg-stone-50 text-[#0F172A] border border-stone-200 shadow-sm font-semibold flex items-center gap-3 justify-center rounded-xl text-sm transition-colors"
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            {/* Divider */}
            <div className="relative flex items-center my-5">
              <div className="flex-1 border-t border-stone-200" />
              <span className="mx-4 text-xs text-[#475569] select-none">or</span>
              <div className="flex-1 border-t border-stone-200" />
            </div>

            {/* Email + password form */}
            <form onSubmit={isSignin ? handleSignin : handleEmailAuth} noValidate>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="auth-email" className="text-sm font-semibold text-[#0F172A] mb-1.5 block">
                    Email address
                  </Label>
                  <Input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                    placeholder="you@company.com"
                    disabled={loading}
                    autoComplete="email"
                    className="h-11 bg-white border border-stone-300 text-[#0F172A] rounded-xl text-sm placeholder:text-stone-400 focus:border-[#C2410C] focus:ring-2 focus:ring-[#C2410C]/20 focus:outline-none"
                  />
                </div>

                <div>
                  <Label htmlFor="auth-password" className="text-sm font-semibold text-[#0F172A] mb-1.5 block">
                    Password
                  </Label>
                  <Input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                    placeholder={isSignin ? 'Your password' : 'Min. 6 characters'}
                    disabled={loading}
                    autoComplete={isSignin ? 'current-password' : 'new-password'}
                    className="h-11 bg-white border border-stone-300 text-[#0F172A] rounded-xl text-sm placeholder:text-stone-400 focus:border-[#C2410C] focus:ring-2 focus:ring-[#C2410C]/20 focus:outline-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className={`
                  w-full min-h-[44px] mt-6 text-white rounded-xl text-sm font-semibold
                  shadow-none transition-colors
                  ${isSignin
                    ? 'bg-[#0F172A] hover:bg-[#1E293B] active:bg-[#020617]'
                    : 'bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412]'}
                `}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : isSignin ? (
                  'Sign in'
                ) : (
                  'Create account'
                )}
              </Button>
            </form>

            {/* Toggle link */}
            <p className="mt-6 text-center text-sm text-[#475569]">
              {isSignin ? "Don\u0027t have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => switchMode(isSignin ? 'signup' : 'signin')}
                className="text-[#C2410C] font-semibold hover:underline focus:outline-none"
              >
                {isSignin ? 'Get started' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* ─────────────────────────────────────────────────────────── */}
          {/*  Desktop brand panel (>= lg)                               */}
          {/*  Absolutely positioned overlay. z-20 keeps it in front     */}
          {/*  during the crossover slide so it acts as a curtain.       */}
          {/*  Slides from right (signup) → left (signin).               */}
          {/* ─────────────────────────────────────────────────────────── */}
          <div
            className={`
              hidden lg:flex absolute top-0 right-0 w-1/2 h-full z-20
              overflow-hidden
              transition-all duration-700 ease-in-out
              motion-reduce:transition-none
              ${isSignin
                ? '-translate-x-full bg-[#1C1008]'
                : 'translate-x-0 bg-[#0F172A]'}
            `}
          >
            {/* Static glow decorations — painted once, never animated */}
            <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full bg-[#C2410C]/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-[200px] h-[200px] rounded-full bg-[#C2410C]/10 blur-3xl pointer-events-none" />

            {/* Signup content — crossfades out */}
            <div
              className={`
                absolute inset-0 p-8 xl:p-10 flex flex-col justify-between z-10
                transition-opacity duration-500 ease-in-out
                motion-reduce:transition-none
                ${isSignin ? 'opacity-0 pointer-events-none' : 'opacity-100'}
              `}
            >
              <div>
                <p className="text-[11px] font-semibold text-[#C2410C] uppercase tracking-[0.15em] mb-4">
                  AI-powered answering
                </p>
                <h2 className="text-[1.65rem] xl:text-[1.8rem] font-semibold text-[#F1F5F9] tracking-tight leading-[1.2]">
                  Never lose a job to voicemail again
                </h2>
                <p className="mt-3 text-sm text-[#94A3B8] leading-relaxed">
                  Your AI receptionist answers calls, books appointments, and triages emergencies while you work.
                </p>
              </div>

              <div className="space-y-3 mt-10">
                {SELLING_POINTS_SIGNUP.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.text} className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                        <Icon className="size-4 text-[#C2410C]" />
                      </div>
                      <span className="text-sm text-[#F1F5F9]">{item.text}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-10 pt-6 border-t border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <div className="flex -space-x-1.5">
                    {['bg-amber-500', 'bg-sky-500', 'bg-emerald-500'].map((bg, i) => (
                      <div key={i} className={`size-7 rounded-full ${bg} border-[1.5px] border-[#0F172A] flex items-center justify-center text-[10px] text-white font-semibold`}>
                        {['D', 'J', 'M'][i]}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    Trusted by <span className="text-[#F1F5F9] font-semibold">500+</span> home service businesses
                  </p>
                </div>
              </div>
            </div>

            {/* Signin content — crossfades in */}
            <div
              className={`
                absolute inset-0 p-8 xl:p-10 flex flex-col justify-between z-10
                transition-opacity duration-500 ease-in-out
                motion-reduce:transition-none
                ${isSignin ? 'opacity-100' : 'opacity-0 pointer-events-none'}
              `}
            >
              <div>
                <p className="text-[11px] font-semibold text-[#C2410C] uppercase tracking-[0.15em] mb-4">
                  Welcome back
                </p>
                <h2 className="text-[1.65rem] xl:text-[1.8rem] font-semibold text-[#F1F5F9] tracking-tight leading-[1.2]">
                  Good to see you again
                </h2>
                <p className="mt-3 text-sm text-[#94A3B8] leading-relaxed">
                  Your AI receptionist has been handling calls while you were away. Jump back in.
                </p>
              </div>

              <div className="space-y-3 mt-10">
                {SELLING_POINTS_SIGNIN.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.text} className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                        <Icon className="size-4 text-[#C2410C]" />
                      </div>
                      <span className="text-sm text-[#F1F5F9]">{item.text}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-10 pt-6 border-t border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <Lock className="size-4 text-[#94A3B8] shrink-0" />
                  <p className="text-xs text-[#94A3B8]">
                    Protected by <span className="text-[#F1F5F9] font-semibold">256-bit encryption</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
