'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PRICING_TIERS, ENTERPRISE_TIER, getAnnualPrice } from './pricingData';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Building2, ArrowRight } from 'lucide-react';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from '@/app/components/landing/AnimatedSection';

export default function PricingTiers() {
  const [billing, setBilling] = useState('annual');
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return');

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex items-center justify-center mb-5">
        <div className="flex items-center gap-0 rounded-full border border-white/[0.1] bg-white/[0.04] p-1">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-150 min-h-[40px] ${
              billing === 'monthly'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-150 min-h-[40px] flex items-center gap-2 ${
              billing === 'annual'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Annual
            <span className="text-xs bg-[#166534] text-white px-2 py-0.5 rounded-full">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Social proof */}
      <p className="text-center text-sm text-white/35 mb-8">
        The contractors booking jobs at 2 AM aren&apos;t working harder &mdash; they&apos;re using AI.
      </p>

      {/* Tier cards — 3 columns, equal height */}
      <AnimatedStagger className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-5xl mx-auto items-stretch">
        {PRICING_TIERS.map((tier) => {
          const price = billing === 'annual' && tier.monthlyPrice !== null
            ? getAnnualPrice(tier.monthlyPrice)
            : tier.monthlyPrice;

          const isHighlighted = tier.highlighted;

          return (
            <AnimatedItem
              key={tier.id}
              className={`h-full ${isHighlighted ? 'order-first lg:order-none lg:scale-[1.04] lg:z-10' : ''}`}
            >
              <Card
                className={`relative flex flex-col h-full rounded-xl transition-all duration-200 hover:-translate-y-0.5 ${
                  isHighlighted
                    ? 'bg-gradient-to-b from-[#F97316]/[0.06] to-[#1A1816] ring-2 ring-[#F97316] border-[#F97316]/30 hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]'
                    : 'bg-[#1A1816] border border-white/[0.06] hover:border-[rgba(249,115,22,0.3)] hover:shadow-[0_0_20px_rgba(249,115,22,0.1)]'
                }`}
              >
                <CardHeader className="pb-0">
                  {/* Badge */}
                  {tier.badge && (
                    <div className="mb-2">
                      <Badge className="bg-[#F97316] text-white text-xs font-semibold px-3 py-1 rounded-full">
                        {tier.badge}
                      </Badge>
                    </div>
                  )}

                  {/* Tier name */}
                  <div className="text-base font-semibold text-white">{tier.name}</div>

                  {/* Price */}
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold text-white">${price}</span>
                    <span className="text-sm text-white/40">/mo</span>
                  </div>

                  {/* Strikethrough for annual */}
                  {billing === 'annual' && tier.monthlyPrice !== null && (
                    <span className="text-xs text-white/30 line-through">
                      ${tier.monthlyPrice}/mo
                    </span>
                  )}

                  {/* Call limit + overage */}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-[#F97316]/70 bg-[#F97316]/[0.08] px-2 py-0.5 rounded-full">
                      {tier.callLimit} calls/mo
                    </span>
                    {tier.overageRate && (
                      <span className="text-[11px] text-white/30">
                        then ${tier.overageRate.toFixed(2)}/call
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-white/45 mt-2">{tier.description}</p>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 pt-4">
                  {/* Additive feature pattern */}
                  {tier.inheritsFrom && (
                    <p className="text-xs font-medium text-[#F97316]/70 mb-2">
                      Everything in {tier.inheritsFrom}, plus:
                    </p>
                  )}

                  <ul className="space-y-2 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-white/65">
                        <Check className="size-3.5 text-[#F97316] shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA — pinned to bottom */}
                  <div className="mt-5">
                    <Button
                      asChild
                      className={`w-full min-h-[42px] rounded-lg text-sm font-medium ${
                        isHighlighted
                          ? 'bg-[#F97316] text-white hover:bg-[#F97316]/90 shadow-[0_4px_16px_rgba(249,115,22,0.3)]'
                          : 'bg-white/[0.08] border border-white/[0.1] text-white hover:bg-white/[0.12]'
                      }`}
                    >
                      <Link href={returnTo === 'checkout' ? `/onboarding/checkout?plan=${tier.id}&interval=${billing}` : `/onboarding?plan=${tier.id}&interval=${billing}`}>
                        {tier.cta}
                      </Link>
                    </Button>
                    <p className="text-[11px] text-white/25 mt-1.5 text-center">
                      14-day free trial &middot; Cancel anytime
                    </p>
                  </div>
                </CardContent>
              </Card>
            </AnimatedItem>
          );
        })}
      </AnimatedStagger>

      {/* Short-call note */}
      <p className="text-center text-xs text-white/30 mt-4">
        Calls under 20 seconds are never counted &mdash; you only pay for real conversations.
      </p>

      {/* Enterprise section */}
      <AnimatedSection delay={0.15} className="mt-10 max-w-5xl mx-auto">
        <Card className="bg-[#1A1816] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between p-6 md:p-8 gap-6">
            {/* Left */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="size-5 text-[#F97316]/60" />
                <h3 className="text-lg font-semibold text-white">{ENTERPRISE_TIER.name}</h3>
              </div>
              <p className="text-sm text-white/45 mb-4">{ENTERPRISE_TIER.description}</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {ENTERPRISE_TIER.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-white/65">
                    <Check className="size-3.5 text-[#F97316] shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            {/* Right */}
            <div className="flex flex-col items-center md:items-end gap-3 md:min-w-[180px]">
              <span className="text-2xl font-semibold text-white">Custom</span>
              <Button
                asChild
                className="bg-white/[0.08] border border-white/[0.1] text-white hover:bg-white/[0.12] min-h-[42px] px-6 rounded-lg text-sm font-medium"
              >
                <Link href={ENTERPRISE_TIER.ctaHref}>
                  {ENTERPRISE_TIER.cta}
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      </AnimatedSection>
    </div>
  );
}
