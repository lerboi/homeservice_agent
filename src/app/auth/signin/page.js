'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Phone, Calendar, ArrowLeft, Shield, Zap, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase-browser';
import { OtpInput } from '@/components/onboarding/OtpInput';

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

const SELLING_POINTS = [
  { icon: Phone, text: 'Every call answered 24/7' },
  { icon: Calendar, text: 'Auto-books appointments' },
  { icon: Zap, text: 'Setup in under 5 minutes' },
  { icon: Shield, text: 'No credit card required' },
];

function VocoLogo({ textColor = 'text-[#0F172A]' }) {
  return (
    <Link href="/" className="flex items-center gap-2 justify-center">
      <div className="size-8 rounded-lg bg-gradient-to-br from-[#C2410C] to-[#9A3412] flex items-center justify-center shadow-sm">
        <svg viewBox="0 0 16 16" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M8 2v6M4 6l4-4 4 4M3 10h10M5 14h6" />
        </svg>
      </div>
      <span className={`${textColor} font-semibold text-[15px] tracking-tight`}>Voco</span>
    </Link>
  );
}

export default function AuthPage() {
  // 'signup' | 'signin' | 'otp'
  const [mode, setMode] = useState('signup');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

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

    // Signup: check if user exists via signUp
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes('after')) {
        setError('Please wait a moment before trying again.');
      } else {
        setError(signUpError.message || 'Something went wrong. Please try again.');
      }
      setLoading(false);
      return;
    }

    // Empty identities = email already registered
    if (signUpData?.user?.identities?.length === 0) {
      setError('An account with this email already exists. Sign in instead.');
      setLoading(false);
      return;
    }

    // Send OTP to verify email
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });

    if (otpError) {
      if (otpError.message.toLowerCase().includes('after')) {
        setError('Please wait a moment before trying again.');
      } else {
        setError(otpError.message || 'Something went wrong. Please try again.');
      }
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
      if (verifyError.message.toLowerCase().includes('expired')) {
        setError('That code has expired. Request a new one.');
      } else {
        setError("That code didn't match. Check your email and try again.");
      }
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
      if (resendError.message.toLowerCase().includes('after')) {
        setError('Please wait a moment before trying again.');
      } else {
        setError(resendError.message || 'Something went wrong. Please try again.');
      }
      return;
    }

    setCooldown(30);
  }

  function switchMode(newMode) {
    setMode(newMode);
    setError('');
  }

  // ─── OTP View ─────────────────────────────────────────────────────────
  if (mode === 'otp') {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          {/* Logo */}
          <div className="mb-8">
            <VocoLogo textColor="text-[#0F172A]" />
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl p-8 sm:p-10 text-center shadow-2xl">
            {/* Copper email icon */}
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

          {/* Back link */}
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

  // ─── Signin View — compact centered card ──────────────────────────────
  if (mode === 'signin') {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          {/* Logo */}
          <div className="mb-8">
            <VocoLogo textColor="text-[#0F172A]" />
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-2xl">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold text-[#0F172A] tracking-tight">
                Welcome back
              </h1>
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
            <form onSubmit={handleSignin} noValidate>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="signin-email" className="text-sm text-[#0F172A] mb-1.5 block">
                    Email address
                  </Label>
                  <Input
                    id="signin-email"
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
                  <Label htmlFor="signin-password" className="text-sm text-[#0F172A] mb-1.5 block">
                    Password
                  </Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                    placeholder="Your password"
                    disabled={loading}
                    autoComplete="current-password"
                    className="h-11 bg-white border border-stone-300 text-[#0F172A] rounded-xl text-sm placeholder:text-stone-400 focus:border-[#C2410C] focus:ring-2 focus:ring-[#C2410C]/20 focus:outline-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] mt-6 bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] text-white rounded-xl text-sm font-semibold shadow-none transition-colors"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            {/* Toggle link */}
            <p className="mt-6 text-center text-sm text-[#475569]">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-[#C2410C] font-semibold hover:underline focus:outline-none"
              >
                Get started
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Signup View — split layout (default) ─────────────────────────────
  return (
    <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[960px]">
        {/* Card container */}
        <div className="rounded-2xl overflow-hidden flex flex-col lg:flex-row shadow-2xl">

          {/* Left panel — form (WHITE) */}
          <div className="flex-1 bg-white p-8 sm:p-10 lg:p-12">
            <div className="mb-6">
              <VocoLogo textColor="text-[#0F172A]" />
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-[#0F172A] tracking-tight">
                Create your account
              </h1>
              <p className="mt-1.5 text-sm text-[#475569]">
                Start your 5-minute setup
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
            <form onSubmit={handleEmailAuth} noValidate>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="signup-email" className="text-sm font-semibold text-[#0F172A] mb-1.5 block">
                    Email address
                  </Label>
                  <Input
                    id="signup-email"
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
                  <Label htmlFor="signup-password" className="text-sm font-semibold text-[#0F172A] mb-1.5 block">
                    Password
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                    placeholder="Min. 6 characters"
                    disabled={loading}
                    autoComplete="new-password"
                    className="h-11 bg-white border border-stone-300 text-[#0F172A] rounded-xl text-sm placeholder:text-stone-400 focus:border-[#C2410C] focus:ring-2 focus:ring-[#C2410C]/20 focus:outline-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] mt-6 bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] text-white rounded-xl text-sm font-semibold shadow-none transition-colors"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  'Create account'
                )}
              </Button>
            </form>

            {/* Toggle link */}
            <p className="mt-6 text-center text-sm text-[#475569]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-[#C2410C] font-semibold hover:underline focus:outline-none"
              >
                Sign in
              </button>
            </p>
          </div>

          {/* Right panel — brand (hidden on mobile) */}
          <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] bg-[#0F172A] relative overflow-hidden flex-col justify-center p-8 xl:p-10">
            {/* Copper radial glow blobs */}
            <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full bg-[#C2410C]/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-[200px] h-[200px] rounded-full bg-[#C2410C]/10 blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160px] h-[160px] rounded-full bg-[#C2410C]/[0.05] blur-[60px] pointer-events-none" />

            <div className="relative z-10 flex flex-col h-full justify-between">
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

              {/* Feature chips */}
              <div className="space-y-3 mt-10">
                {SELLING_POINTS.map((item) => {
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

              {/* Social proof */}
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
          </div>

        </div>
      </div>
    </div>
  );
}
