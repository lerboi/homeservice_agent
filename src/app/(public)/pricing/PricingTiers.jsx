'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PRICING_TIERS, ENTERPRISE_TIER, getAnnualPrice } from './pricingData';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Building2, ArrowRight, ShieldCheck } from 'lucide-react';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from '@/app/components/landing/AnimatedSection';

// A couple of foundational capabilities surfaced as dimmed "also included"
// reminders on the inheriting (Growth/Scale) cards so the recommended card no
// longer looks emptier than Starter. Computed from the base tier so it can't
// drift from the real feature list.
const FOUNDATION_FEATURES = (PRICING_TIERS.find((t) => !t.inheritsFrom)?.features ?? []).slice(0, 2);

export default function PricingTiers() {
  const [billing, setBilling] = useState('annual');
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return');

  return (
    <div>
      {/* Billing toggle — extra gap below so it clears the floating "Most
          Popular" badge (which pokes ~12px up into this gap) */}
      <div className="flex items-center justify-center mb-14">
        <div className="flex items-center gap-0 rounded-full border border-white/[0.1] bg-white/[0.04] p-1">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-150 min-h-[44px] ${
              billing === 'monthly'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-150 min-h-[44px] flex items-center gap-2 ${
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

      {/* Tier cards — 3 columns, equal height */}
      <AnimatedStagger className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-7 max-w-5xl mx-auto items-stretch">
        {PRICING_TIERS.map((tier) => {
          const price = billing === 'annual' && tier.monthlyPrice !== null
            ? getAnnualPrice(tier.monthlyPrice)
            : tier.monthlyPrice;

          // Annual disclosure: the yearly total Stripe charges, derived from the
          // same rounded per-month value so it matches the annual price IDs.
          const annualMonthly = tier.monthlyPrice !== null ? getAnnualPrice(tier.monthlyPrice) : null;
          const yearlyTotal = annualMonthly !== null ? annualMonthly * 12 : null;

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
                {/* Badge — floats on the card's top border so header heights stay aligned */}
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-[#F97316] text-white text-xs font-semibold px-3 py-1 rounded-full shadow-[0_2px_12px_rgba(249,115,22,0.4)] whitespace-nowrap">
                      {tier.badge}
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-0">
                  {/* Chunk 1 — name + who-it's-for subtitle */}
                  <div className="text-base font-semibold text-white">{tier.name}</div>
                  <p className="text-sm text-white/60 mt-1.5 leading-snug">{tier.description}</p>

                  {/* Chunk 2 — price, capped at two numbers (strikethrough inline) */}
                  <div className="mt-4 flex items-baseline gap-2 flex-wrap">
                    <span className="text-3xl font-semibold text-white">${price}</span>
                    <span className="text-sm text-white/50">/mo</span>
                    {billing === 'annual' && tier.monthlyPrice !== null && (
                      <span className="text-sm text-white/40 line-through">${tier.monthlyPrice}</span>
                    )}
                  </div>

                  {/* Chunk 3 — annual billing disclosure, one quiet line */}
                  {billing === 'annual' && yearlyTotal !== null && (
                    <p className="text-xs text-white/50 mt-1">
                      Billed ${yearlyTotal.toLocaleString()}/yr
                    </p>
                  )}

                  {/* Chunk 4 — call allotment promoted to a hero line (the real
                      dimension buyers compare) */}
                  <div className="mt-4">
                    <p className="text-sm font-medium text-white/85">
                      <span className="text-[#F97316] font-semibold">{tier.callLimit} calls</span> included / mo
                    </p>
                    {tier.overageRate && (
                      <p className="text-xs text-white/50 mt-0.5">
                        then ${tier.overageRate.toFixed(2)}/call after
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 pt-5">
                  {/* List header — every card gets one so the lists start at the same line */}
                  {tier.inheritsFrom ? (
                    <p className="text-xs font-semibold text-[#F97316]/90 mb-3">
                      Everything in {tier.inheritsFrom}, plus:
                    </p>
                  ) : (
                    <p className="text-xs font-semibold text-white/55 uppercase tracking-wide mb-3">
                      What&apos;s included:
                    </p>
                  )}

                  <ul className="space-y-3 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm leading-snug text-white/70">
                        <Check className="size-3.5 text-[#F97316] shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                    {/* Dimmed inherited reminders so the recommended cards read as the richest, not the emptiest */}
                    {tier.inheritsFrom && FOUNDATION_FEATURES.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm leading-snug text-white/45">
                        <Check className="size-3.5 text-white/30 shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA — pinned to bottom */}
                  <div className="mt-6">
                    <Button
                      asChild
                      className={`w-full min-h-[44px] rounded-lg text-sm font-medium ${
                        isHighlighted
                          ? 'bg-[#F97316] text-white hover:bg-[#F97316]/90 shadow-[0_4px_16px_rgba(249,115,22,0.3)]'
                          : 'bg-white/[0.08] border border-white/[0.1] text-white hover:bg-white/[0.12]'
                      }`}
                    >
                      <Link href={returnTo === 'checkout' ? `/onboarding/checkout?plan=${tier.id}&interval=${billing}` : `/onboarding?plan=${tier.id}&interval=${billing}`}>
                        {tier.cta}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </AnimatedItem>
          );
        })}
      </AnimatedStagger>

      {/* Trust strip — risk-reversal at the decision point, directly under the
          cards. Consolidates the old per-card trial lines, the short-call note,
          and the Risk-Free Guarantee that used to sit below Enterprise. */}
      <AnimatedSection className="mt-12 max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-center sm:text-left rounded-xl border border-white/[0.07] bg-white/[0.03] px-6 py-5">
          <div className="flex items-center justify-center size-10 rounded-full bg-[#F97316]/[0.1] shrink-0">
            <ShieldCheck className="size-5 text-[#F97316]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/90">
              Risk-free: try Voco free for 14 days. If it doesn&apos;t book you a job, you pay nothing.
            </p>
            <p className="text-xs text-white/55 mt-0.5">
              No contracts, cancel anytime &middot; Calls under 20 seconds are never counted &mdash; you only pay for real conversations.
            </p>
          </div>
        </div>
      </AnimatedSection>

      {/* Enterprise section */}
      <AnimatedSection delay={0.15} className="mt-12 max-w-5xl mx-auto">
        <Card className="bg-[#1A1816] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between p-6 md:p-8 gap-6">
            {/* Left */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="size-5 text-[#F97316]/60" />
                <h3 className="text-lg font-semibold text-white">{ENTERPRISE_TIER.name}</h3>
              </div>
              <p className="text-sm text-white/60 mb-4">{ENTERPRISE_TIER.description}</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {ENTERPRISE_TIER.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-white/70">
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
                className="bg-white/[0.08] border border-white/[0.1] text-white hover:bg-white/[0.12] min-h-[44px] px-6 rounded-lg text-sm font-medium"
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
