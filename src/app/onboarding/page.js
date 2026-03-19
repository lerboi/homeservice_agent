'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TONE_PRESETS = [
  {
    id: 'professional',
    nameKey: 'tone_professional',
    descKey: 'tone_professional_desc',
    icon: '🎩',
  },
  {
    id: 'friendly',
    nameKey: 'tone_friendly',
    descKey: 'tone_friendly_desc',
    icon: '😊',
  },
  {
    id: 'local_expert',
    nameKey: 'tone_local_expert',
    descKey: 'tone_local_expert_desc',
    icon: '🏘️',
  },
];

export default function OnboardingStep1() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [tonePreset, setTonePreset] = useState('professional');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!businessName.trim()) {
      setError(t('error_business_name_empty'));
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_name: businessName.trim(), tone_preset: tonePreset }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t('error_save_failed'));
        setLoading(false);
        return;
      }

      router.push('/onboarding/services');
    } catch {
      setError(t('error_save_failed'));
      setLoading(false);
    }
  }

  function handleKeyDown(e, presetId) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setTonePreset(presetId);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900 leading-tight">
        {t('step1_heading')}
      </h1>
      <p className="mt-2 mb-6 text-base text-slate-500">
        {t('step1_subtext')}
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {/* Business name field */}
        <div className="mb-6">
          <Label htmlFor="business_name" className="text-base text-slate-900 mb-2 block">
            {t('business_name_label')}
          </Label>
          <Input
            id="business_name"
            type="text"
            value={businessName}
            onChange={(e) => {
              setBusinessName(e.target.value);
              if (error) setError('');
            }}
            placeholder={t('business_name_placeholder')}
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? 'business-name-error' : undefined}
            className="min-h-11 text-base border-slate-200 focus:border-blue-600"
          />
          {error && (
            <p
              id="business-name-error"
              role="alert"
              className="mt-1 text-sm text-red-600"
            >
              {error}
            </p>
          )}
        </div>

        {/* Tone preset selection */}
        <div className="mb-8">
          <p className="text-base text-slate-900 font-semibold mb-3">
            {t('tone_section_label')}
          </p>
          <div className="space-y-3">
            {TONE_PRESETS.map((preset) => {
              const isSelected = tonePreset === preset.id;
              return (
                <div
                  key={preset.id}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => setTonePreset(preset.id)}
                  onKeyDown={(e) => handleKeyDown(e, preset.id)}
                  className={`
                    min-h-[80px] flex items-start gap-3 p-4 rounded-lg border cursor-pointer
                    transition-colors duration-150
                    focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1
                    ${isSelected
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }
                  `}
                >
                  <span className="text-xl mt-0.5" aria-hidden="true">{preset.icon}</span>
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {t(preset.nameKey)}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {t(preset.descKey)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={loading}
            className="w-full sm:w-40 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-95
                       text-white min-h-11 transition-all duration-150"
          >
            {t('cta_step1')}
          </Button>
        </div>
      </form>
    </div>
  );
}
