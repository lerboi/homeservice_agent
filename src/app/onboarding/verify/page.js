'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

// Step 3 has 3 sub-states: 'phone' | 'otp' | 'provisioning'

export default function OnboardingStep3() {
  const t = useTranslations('onboarding');
  const router = useRouter();

  const [subState, setSubState] = useState('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorPhone, setErrorPhone] = useState('');
  const [errorEmail, setErrorEmail] = useState('');
  const [errorOtp, setErrorOtp] = useState('');
  const [errorProvisioning, setErrorProvisioning] = useState('');

  // Auto-trigger provisioning when sub-state transitions to 'provisioning'
  useEffect(() => {
    if (subState === 'provisioning') {
      handleProvision();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subState]);

  function validatePhone(value) {
    if (!value.trim()) return t('error_phone_invalid');
    if (!value.trim().startsWith('+')) return t('error_phone_invalid');
    return '';
  }

  function validateEmail(value) {
    if (value.trim() && !value.trim().includes('@')) return t('error_email_invalid');
    return '';
  }

  async function handleSendCode() {
    const phoneErr = validatePhone(phone);
    if (phoneErr) {
      setErrorPhone(phoneErr);
      return;
    }
    const emailErr = validateEmail(email);
    if (emailErr) {
      setErrorEmail(emailErr);
      return;
    }
    setErrorPhone('');
    setErrorEmail('');
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/sms-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorPhone(data.error || t('error_phone_invalid'));
        setLoading(false);
        return;
      }
      setSubState('otp');
    } catch {
      setErrorPhone(t('error_phone_invalid'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) {
      setErrorOtp(t('error_otp_incorrect'));
      return;
    }
    setErrorOtp('');
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/sms-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), token: otp.trim(), email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        const msg = data.error || '';
        if (msg.toLowerCase().includes('expired')) {
          setErrorOtp(t('error_otp_expired'));
        } else {
          setErrorOtp(t('error_otp_incorrect'));
        }
        setLoading(false);
        return;
      }
      // Transition to provisioning sub-state
      setSubState('provisioning');
    } catch {
      setErrorOtp(t('error_otp_incorrect'));
      setLoading(false);
    }
  }

  async function handleProvision() {
    setErrorProvisioning('');
    try {
      const res = await fetch('/api/onboarding/provision-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        setErrorProvisioning(t('error_provisioning_failed'));
        return;
      }
      const data = await res.json();
      // Navigate to activation page with provisioned number in query params
      const params = new URLSearchParams({
        number: data.phone_number || '',
        number_pretty: data.phone_number_pretty || data.phone_number || '',
      });
      router.push(`/onboarding/complete?${params.toString()}`);
    } catch {
      setErrorProvisioning(t('error_provisioning_failed'));
    }
  }

  async function handleResendCode() {
    setErrorOtp('');
    setLoading(true);
    try {
      await fetch('/api/onboarding/sms-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
    } catch {
      // Silently fail resend — user can try again
    } finally {
      setLoading(false);
    }
  }

  // ── Sub-state: provisioning ───────────────────────────────────────────────
  if (subState === 'provisioning') {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 leading-tight mb-6">
          {t('step3_heading')}
        </h1>

        {errorProvisioning ? (
          <div>
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{errorProvisioning}</AlertDescription>
            </Alert>
            <Button
              type="button"
              onClick={() => { setErrorProvisioning(''); handleProvision(); }}
              className="w-full min-h-11 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Button
              disabled
              className="w-full min-h-11 bg-blue-600 text-white opacity-50 cursor-not-allowed mt-4"
            >
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              {t('cta_step3_provisioning')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Sub-state: OTP entry ──────────────────────────────────────────────────
  if (subState === 'otp') {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 leading-tight">
          {t('step3_heading')}
        </h1>
        <p className="mt-2 mb-6 text-base text-slate-500">
          {t('step3_subtext')}
        </p>

        <div className="space-y-6">
          <div className="space-y-1">
            <Label htmlFor="otp" className="text-base font-normal text-slate-900">
              {t('otp_label')}
            </Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest min-h-11 border-slate-200"
              autoComplete="one-time-code"
              aria-describedby={errorOtp ? 'otp-error' : undefined}
            />
            {errorOtp && (
              <p id="otp-error" role="alert" className="text-sm text-red-600 mt-1">
                {errorOtp}
              </p>
            )}
            <button
              type="button"
              onClick={handleResendCode}
              disabled={loading}
              className="text-sm text-blue-600 underline mt-2 disabled:opacity-50"
            >
              {t('otp_resend')}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => { setSubState('phone'); setOtp(''); setErrorOtp(''); }}
            disabled={loading}
            className="text-slate-500 hover:text-slate-700 px-0 min-h-11"
          >
            {t('back')}
          </Button>
          <Button
            type="button"
            onClick={handleVerifyOtp}
            disabled={loading}
            className="w-full sm:w-40 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-95
                       text-white min-h-11 transition-all duration-150"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              t('cta_step3_otp')
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── Sub-state: Phone + email entry (default) ──────────────────────────────
  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900 leading-tight">
        {t('step3_heading')}
      </h1>
      <p className="mt-2 mb-6 text-base text-slate-500">
        {t('step3_subtext')}
      </p>

      <div className="space-y-6">
        {/* Phone field */}
        <div className="space-y-1">
          <Label htmlFor="phone" className="text-base font-normal text-slate-900">
            {t('phone_label')}
          </Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setErrorPhone(''); }}
            placeholder="+1 555 000 0000"
            className="min-h-11 border-slate-200 text-base"
            aria-describedby={errorPhone ? 'phone-error' : 'phone-helper'}
          />
          {errorPhone ? (
            <p id="phone-error" role="alert" className="text-sm text-red-600 mt-1">
              {errorPhone}
            </p>
          ) : (
            <p id="phone-helper" className="text-sm text-slate-500 mt-1">
              {t('phone_helper')}
            </p>
          )}
        </div>

        {/* Email field */}
        <div className="space-y-1">
          <Label htmlFor="email" className="text-base font-normal text-slate-900">
            {t('email_label')}
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrorEmail(''); }}
            placeholder={t('email_placeholder')}
            className="min-h-11 border-slate-200 text-base"
            aria-describedby={errorEmail ? 'email-error' : 'email-helper'}
          />
          {errorEmail ? (
            <p id="email-error" role="alert" className="text-sm text-red-600 mt-1">
              {errorEmail}
            </p>
          ) : (
            <p id="email-helper" className="text-sm text-slate-500 mt-1">
              {t('email_helper')}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/onboarding/services')}
          disabled={loading}
          className="text-slate-500 hover:text-slate-700 px-0 min-h-11"
        >
          {t('back')}
        </Button>
        <Button
          type="button"
          onClick={handleSendCode}
          disabled={loading}
          className="w-full sm:w-40 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-95
                     text-white min-h-11 transition-all duration-150"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            t('cta_step3_pre')
          )}
        </Button>
      </div>
    </div>
  );
}
