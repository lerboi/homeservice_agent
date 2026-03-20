'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AnimatedStagger, AnimatedItem } from '@/app/components/landing/AnimatedSection';

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
      <h1 className="text-3xl font-semibold text-[#0F172A] leading-tight tracking-tight">
        {t('step1_heading')}
      </h1>
      <p className="mt-2 mb-6 text-base text-[#475569]">
        {t('step1_subtext')}
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {/* Business name field */}
        <div className="mb-6">
          <Label htmlFor="business_name" className="text-base text-[#0F172A] mb-2 block">
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
            className="min-h-11 text-base border-stone-200 focus:border-[#C2410C]"
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
          <p className="text-base text-[#0F172A] font-semibold mb-3">
            {t('tone_section_label')}
          </p>
          <AnimatedStagger className="space-y-3">
            {TONE_PRESETS.map((preset) => {
              const isSelected = tonePreset === preset.id;
              return (
                <AnimatedItem key={preset.id}>
                  <div
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => setTonePreset(preset.id)}
                    onKeyDown={(e) => handleKeyDown(e, preset.id)}
                    className={`
                      min-h-[80px] flex items-start gap-3 p-4 rounded-2xl border cursor-pointer
                      transition-all duration-200
                      focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1
                      ${isSelected
                        ? 'border-[#C2410C] bg-[#C2410C]/[0.04] shadow-[0_0_0_1px_rgba(194,65,12,0.15)]'
                        : 'border-stone-200 bg-[#F5F5F4] hover:bg-stone-100 hover:shadow-[0_2px_8px_0_rgba(0,0,0,0.04)] hover:-translate-y-0.5'
                      }
                    `}
                  >
                    <span className="text-xl mt-0.5" aria-hidden="true">{preset.icon}</span>
                    <div>
                      <p className="text-base font-semibold text-[#0F172A]">
                        {t(preset.nameKey)}
                      </p>
                      <p className="text-sm text-[#475569] mt-0.5">
                        {t(preset.descKey)}
                      </p>
                    </div>
                  </div>
                </AnimatedItem>
              );
            })}
          </AnimatedStagger>
        </div>

        {/* CTA */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={loading}
            className="w-full sm:w-40 bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] active:scale-95
                       text-white min-h-11 transition-all duration-150 shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)]"
          >
            {t('cta_step1')}
          </Button>
        </div>
      </form>
    </div>
  );
}
