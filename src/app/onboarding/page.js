'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase-browser';
import { OtpInput } from '@/components/onboarding/OtpInput';

// Google "G" SVG icon
function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function OnboardingCreateAccount() {
  const router = useRouter();

  // 'signup' | 'otp' — drives which UI to show
  const [phase, setPhase] = useState('signup');

  // Form values
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Toggle between signup and sign-in modes
  const [isSignIn, setIsSignIn] = useState(false);

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // OTP resend cooldown
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
          encodeURIComponent('/onboarding/profile'),
      },
    });
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    if (isSignIn) {
      // Sign-in flow for returning users
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError('Invalid email or password. Please try again.');
        setLoading(false);
        return;
      }

      router.push('/onboarding/profile');
      return;
    }

    // Signup flow
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      if (
        signUpError.message.toLowerCase().includes('already registered') ||
        signUpError.message.toLowerCase().includes('already exists') ||
        signUpError.message.toLowerCase().includes('user already')
      ) {
        setError(
          'An account with this email already exists. Sign in instead.'
        );
      } else {
        setError(signUpError.message || 'Something went wrong. Please try again.');
      }
      setLoading(false);
      return;
    }

    // Send OTP to verify email
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });

    if (otpError) {
      setError(otpError.message || 'Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    setCooldown(30);
    setPhase('otp');
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

    router.push('/onboarding/profile');
  }

  async function handleResendCode() {
    if (cooldown > 0) return;
    setError('');

    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });

    if (resendError) {
      setError(resendError.message || 'Something went wrong. Please try again.');
      return;
    }

    setCooldown(30);
  }

  // OTP phase UI
  if (phase === 'otp') {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight">
          Check your email
        </h1>
        <p className="mt-2 mb-8 text-base text-[#475569]">
          Enter the 6-digit code we sent to {email}
        </p>

        {error && (
          <Alert variant="destructive" className="mb-6">
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
            <span className="text-[#475569]">Resend code ({cooldown}s)</span>
          ) : (
            <button
              type="button"
              onClick={handleResendCode}
              className="text-[#C2410C] hover:underline focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1 rounded"
            >
              Resend code
            </button>
          )}
        </p>
      </div>
    );
  }

  // Signup / sign-in phase UI
  return (
    <div>
      <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight">
        Create your account
      </h1>
      <p className="mt-2 mb-6 text-base text-[#475569]">
        Start answering every call in minutes.
      </p>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Google OAuth */}
      <Button
        type="button"
        onClick={handleGoogleOAuth}
        className="w-full min-h-11 bg-white hover:bg-stone-50 active:bg-stone-100 text-[#0F172A] border border-stone-200 shadow-none font-normal mb-4 flex items-center gap-2 justify-center"
        variant="outline"
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      {/* Divider */}
      <div className="relative flex items-center mb-4">
        <div className="flex-1 border-t border-stone-200" />
        <span className="mx-3 text-sm text-[#475569]">or</span>
        <div className="flex-1 border-t border-stone-200" />
      </div>

      {/* Email + password form */}
      <form onSubmit={handleEmailSubmit} noValidate>
        <div className="mb-4">
          <Label htmlFor="email" className="text-base text-[#0F172A] mb-1.5 block">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            placeholder="you@example.com"
            disabled={loading}
            autoComplete="email"
            className="min-h-11 border-stone-200 focus:border-[#C2410C]"
          />
        </div>

        <div className="mb-6">
          <Label htmlFor="password" className="text-base text-[#0F172A] mb-1.5 block">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError('');
            }}
            placeholder="••••••••"
            disabled={loading}
            autoComplete={isSignIn ? 'current-password' : 'new-password'}
            className="min-h-11 border-stone-200 focus:border-[#C2410C]"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] active:scale-95 text-white min-h-11 shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all duration-150"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : isSignIn ? (
            'Sign in'
          ) : (
            'Create account'
          )}
        </Button>
      </form>

      {/* Toggle between signup and sign-in */}
      <p className="mt-4 text-center text-sm text-[#475569]">
        {isSignIn ? (
          <>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => { setIsSignIn(false); setError(''); }}
              className="text-[#C2410C] hover:underline focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1 rounded"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => { setIsSignIn(true); setError(''); }}
              className="text-[#C2410C] hover:underline focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1 rounded"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
