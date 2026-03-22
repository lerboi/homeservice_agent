'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Phone, Calendar, BarChart3, ArrowRight, ArrowLeft, Shield, Zap } from 'lucide-react';
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    if (mode === 'signin') {
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
      return;
    }

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

  async function handleResendCode() {
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

  // ─── OTP Screen ───────────────────────────────────────────────────────
  if (mode === 'otp') {
    return (
      <div className="min-h-screen bg-[#F5F5F4] relative flex items-center justify-center px-4 py-12">
        {/* Background texture */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse_at_center_top,rgba(194,65,12,0.06),transparent_70%)] pointer-events-none" />

        <div className="relative w-full max-w-[440px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 justify-center mb-8">
            <div className="size-8 rounded-lg bg-gradient-to-br from-[#C2410C] to-[#9A3412] flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 16 16" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 2v6M4 6l4-4 4 4M3 10h10M5 14h6" />
              </svg>
            </div>
            <span className="text-[#0F172A] font-semibold text-[15px] tracking-tight">Voco</span>
          </Link>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_8px_32px_-8px_rgba(0,0,0,0.08)] border border-stone-200/60 p-8 sm:p-10">
            <div className="text-center mb-8">
              <div className="size-14 rounded-2xl bg-[#C2410C]/[0.08] flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-[#0F172A] tracking-tight">
                Check your email
              </h1>
              <p className="mt-2 text-[15px] text-[#475569] leading-relaxed">
                We sent a 6-digit code to<br />
                <span className="font-medium text-[#0F172A]">{email}</span>
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-6 rounded-xl">
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

            <p className="text-center text-sm text-[#475569]">
              {cooldown > 0 ? (
                <span className="text-[#94A3B8]">Resend code in {cooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  className="text-[#C2410C] font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-2 rounded px-1"
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

  // ─── Sign In / Sign Up ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F5F4] relative flex items-center justify-center px-4 py-12">
      {/* Background texture */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(ellipse_at_center_top,rgba(194,65,12,0.06),transparent_70%)] pointer-events-none" />

      <div className="relative w-full max-w-[960px]">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="size-8 rounded-lg bg-gradient-to-br from-[#C2410C] to-[#9A3412] flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 16 16" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 2v6M4 6l4-4 4 4M3 10h10M5 14h6" />
            </svg>
          </div>
          <span className="text-[#0F172A] font-semibold text-[15px] tracking-tight">Voco</span>
        </Link>

        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_8px_32px_-8px_rgba(0,0,0,0.08)] border border-stone-200/60 overflow-hidden">
          <div className="flex flex-col lg:flex-row">

            {/* ─── Left: Auth Form ─── */}
            <div className="flex-1 p-8 sm:p-10 lg:p-12">

              {/* Tab switcher */}
              <div className="flex bg-[#F5F5F4] rounded-xl p-1 mb-8">
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    mode === 'signup'
                      ? 'bg-white text-[#0F172A] shadow-sm'
                      : 'text-[#64748B] hover:text-[#475569]'
                  }`}
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    mode === 'signin'
                      ? 'bg-white text-[#0F172A] shadow-sm'
                      : 'text-[#64748B] hover:text-[#475569]'
                  }`}
                >
                  Sign in
                </button>
              </div>

              {/* Heading */}
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-[#0F172A] tracking-tight">
                  {mode === 'signin' ? 'Welcome back' : 'Get started for free'}
                </h1>
                <p className="mt-1.5 text-[15px] text-[#64748B]">
                  {mode === 'signin'
                    ? 'Sign in to your account to continue.'
                    : 'Create your account and set up in 5 minutes.'}
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
                className="w-full min-h-[44px] bg-white hover:bg-stone-50 active:bg-stone-100 text-[#0F172A] border border-stone-200 shadow-none font-medium flex items-center gap-3 justify-center rounded-xl text-sm transition-colors"
              >
                <GoogleIcon />
                Continue with Google
              </Button>

              {/* Divider */}
              <div className="relative flex items-center my-5">
                <div className="flex-1 border-t border-stone-200/80" />
                <span className="mx-4 text-xs text-[#94A3B8] select-none">or</span>
                <div className="flex-1 border-t border-stone-200/80" />
              </div>

              {/* Email + password form */}
              <form onSubmit={handleSubmit} noValidate>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium text-[#0F172A] mb-1.5 block">
                      Email address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                      placeholder="you@company.com"
                      disabled={loading}
                      autoComplete="email"
                      className="h-11 border-stone-200 rounded-xl text-sm bg-white focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C]/20 placeholder:text-stone-400"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-sm font-medium text-[#0F172A] mb-1.5 block">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                      placeholder="Min. 6 characters"
                      disabled={loading}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      className="h-11 border-stone-200 rounded-xl text-sm bg-white focus:border-[#C2410C] focus:ring-1 focus:ring-[#C2410C]/20 placeholder:text-stone-400"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 mt-6 bg-[#C2410C] hover:bg-[#B53B0A] active:bg-[#9A3412] active:scale-[0.99] text-white rounded-xl text-sm font-medium shadow-[0_1px_2px_0_rgba(0,0,0,0.2),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all duration-150"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : mode === 'signin' ? (
                    'Sign in'
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="ml-2 size-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Footer text */}
              <p className="mt-5 text-center text-xs text-[#94A3B8]">
                {mode === 'signup'
                  ? 'By creating an account, you agree to our Terms of Service.'
                  : '\u00A0'}
              </p>
            </div>

            {/* ─── Right: Visual Panel ─── */}
            <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] bg-[#0F172A] relative overflow-hidden flex-col justify-between p-10 xl:p-12">
              {/* Background layers */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px]" />
              <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full bg-[#C2410C]/[0.07] blur-[80px]" />
              <div className="absolute -bottom-20 -left-20 w-[200px] h-[200px] rounded-full bg-[#C2410C]/[0.04] blur-[60px]" />

              <div className="relative z-10 flex flex-col h-full">
                {/* Headline */}
                <div className="mb-auto">
                  <p className="text-[11px] font-semibold text-[#C2410C] uppercase tracking-[0.15em] mb-4">
                    AI-powered answering
                  </p>
                  <h2 className="text-[1.65rem] xl:text-[1.8rem] font-semibold text-white tracking-tight leading-[1.2]">
                    Never lose a job to voicemail again
                  </h2>
                  <p className="mt-3 text-[14px] text-white/40 leading-relaxed">
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
                        <span className="text-[13px] text-white/60 font-medium">{item.text}</span>
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
                    <p className="text-[12px] text-white/30">
                      Trusted by <span className="text-white/50 font-medium">500+</span> trades businesses
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom link */}
        <p className="text-center text-xs text-[#94A3B8] mt-6">
          <Link href="/" className="hover:text-[#475569] transition-colors">
            &larr; Back to homepage
          </Link>
        </p>
      </div>
    </div>
  );
}
