'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWizardSession } from '@/hooks/useWizardSession';

const COUNTRY_CONFIG = {
  SG: { prefix: '+65', placeholder: '9123 4567', label: 'Singapore' },
  US: { prefix: '+1', placeholder: '555 000 0000', label: 'United States' },
  CA: { prefix: '+1', placeholder: '555 000 0000', label: 'Canada' },
};

function buildE164(country, localNumber) {
  const config = COUNTRY_CONFIG[country];
  if (!config) return localNumber;
  const digits = localNumber.replace(/\D/g, '');
  return `${config.prefix}${digits}`;
}

export default function OnboardingStep3Contact() {
  const router = useRouter();

  const [ownerName, setOwnerName] = useWizardSession('owner_name', '');
  const [country, setCountry] = useWizardSession('country', '');
  const [phone, setPhone] = useWizardSession('phone', '');

  const [sgAvailable, setSgAvailable] = useState(null);
  const [sgLoading, setSgLoading] = useState(false);
  const [waitlistMode, setWaitlistMode] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ name: '', phone: '', country: '' });

  async function handleCountryChange(val) {
    setCountry(val);
    setPhone('');
    setWaitlistMode(false);
    setSgAvailable(null);

    if (val === 'SG') {
      setSgLoading(true);
      try {
        const res = await fetch('/api/onboarding/sg-availability');
        const data = await res.json();
        setSgAvailable(data.available_count);
        if (data.available_count === 0) {
          setWaitlistMode(true);
        }
      } catch {
        setSgAvailable(null);
      } finally {
        setSgLoading(false);
      }
    }
  }

  function validate() {
    const errors = { name: '', phone: '', country: '' };
    let valid = true;
    if (!ownerName.trim() || ownerName.trim().length < 2) {
      errors.name = 'Please enter your full name.';
      valid = false;
    }
    if (!country) {
      errors.country = 'Please select your country.';
      valid = false;
    }
    const digits = phone.replace(/\D/g, '');
    if (!digits || digits.length < 7) {
      errors.phone = "That phone number doesn't look right. Check the format and try again.";
      valid = false;
    }
    setFieldErrors(errors);
    return valid;
  }

  async function handleContinue() {
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const e164Phone = buildE164(country, phone);
      const res = await fetch('/api/onboarding/sms-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: e164Phone, owner_name: ownerName.trim(), country }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }
      router.push('/onboarding/plan');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  async function handleWaitlistJoin() {
    if (!waitlistEmail.includes('@')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/sg-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail.trim() }),
      });
      if (res.ok) setWaitlistSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (waitlistSubmitted) {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight">
          You&apos;re on the list
        </h1>
        <p className="mt-2 text-base text-[#475569]">
          We&apos;ll email you at {waitlistEmail} as soon as a Singapore number becomes available.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight">
        Your Details
      </h1>
      <p className="mt-2 mb-6 text-base text-[#475569]">
        {waitlistMode
          ? "Singapore numbers are currently full. Join the waitlist and we'll notify you when a slot opens."
          : 'Tell us who you are and where your business is based.'}
      </p>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {waitlistMode ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="waitlist_email" className="text-base font-normal text-[#0F172A]">
              Email address
            </Label>
            <Input
              id="waitlist_email"
              type="email"
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-h-11 border-stone-200 text-base focus:border-[#C2410C]"
            />
          </div>
          <Button
            type="button"
            onClick={handleWaitlistJoin}
            disabled={loading || !waitlistEmail.includes('@')}
            className="w-full bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] active:scale-95
                       text-white min-h-11 transition-all duration-150 shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              'Join waitlist'
            )}
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {/* Full name */}
            <div className="space-y-1">
              <Label htmlFor="owner_name" className="text-base font-normal text-[#0F172A]">
                Full name
              </Label>
              <Input
                id="owner_name"
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Jane Smith"
                className="min-h-11 border-stone-200 text-base focus:border-[#C2410C]"
              />
              {fieldErrors.name && (
                <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>
              )}
            </div>

            {/* Phone number */}
            <div className="space-y-1">
              <Label htmlFor="owner_phone" className="text-base font-normal text-[#0F172A]">
                Phone number
              </Label>
              <div className="flex items-center min-h-11 border border-stone-200 rounded-md focus-within:border-[#C2410C] overflow-hidden">
                {country && (
                  <span className="pl-3 text-base text-[#0F172A] select-none whitespace-nowrap">
                    {COUNTRY_CONFIG[country]?.prefix}
                  </span>
                )}
                <input
                  id="owner_phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={COUNTRY_CONFIG[country]?.placeholder || ''}
                  className="flex-1 min-h-11 px-3 text-base bg-transparent outline-none border-none"
                />
              </div>
              {fieldErrors.phone && (
                <p className="text-xs text-destructive mt-1">{fieldErrors.phone}</p>
              )}
            </div>

            {/* Country */}
            <div className="space-y-1">
              <Label htmlFor="country" className="text-base font-normal text-[#0F172A]">
                Country
              </Label>
              <Select value={country} onValueChange={handleCountryChange}>
                <SelectTrigger
                  id="country"
                  className="min-h-11 border-stone-200 text-base focus:border-[#C2410C]"
                >
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SG">Singapore</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.country && (
                <p className="text-xs text-destructive mt-1">{fieldErrors.country}</p>
              )}

              {/* SG availability badge */}
              {country === 'SG' && (
                <div className="mt-1">
                  {sgLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin inline text-[#475569]" />
                  ) : sgAvailable !== null && sgAvailable > 0 ? (
                    <p className="text-xs text-[#C2410C]">{sgAvailable} Singapore numbers available</p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-8">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push('/onboarding/services')}
              disabled={loading}
              className="text-[#475569] hover:text-[#0F172A] px-0 min-h-11"
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={handleContinue}
              disabled={loading}
              className="w-full sm:w-40 bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] active:scale-95
                         text-white min-h-11 transition-all duration-150 shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)]"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
