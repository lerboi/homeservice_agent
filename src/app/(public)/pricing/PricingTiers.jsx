'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PRICING_TIERS, getAnnualPrice } from './pricingData';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { AnimatedStagger, AnimatedItem } from '@/app/components/landing/AnimatedSection';

export default function PricingTiers() {
  const [billing, setBilling] = useState('annual');

  return (
    <div>
      {/* Trial banner — per D-02 */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] text-sm font-medium text-white/80">
          <span className="size-1.5 rounded-full bg-[#F97316]" />
          14-Day Free Trial &bull; Cancel Anytime
        </div>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center mb-10">
        <div className="flex items-center gap-0 rounded-full border border-white/[0.1] bg-white/[0.04] p-1">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-150 min-h-[44px] ${
              billing === 'monthly'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-150 min-h-[44px] flex items-center gap-2 ${
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

      {/* Tier cards */}
      <AnimatedStagger className="grid grid-cols-1 md:grid-cols-4 gap-5 max-w-6xl mx-auto">
        {PRICING_TIERS.map((tier) => {
          const price = billing === 'annual' && tier.monthlyPrice !== null
            ? getAnnualPrice(tier.monthlyPrice)
            : tier.monthlyPrice;

          const orderClass = tier.id === 'starter'
            ? 'md:order-1'
            : tier.id === 'growth'
            ? 'order-first md:order-2'
            : tier.id === 'scale'
            ? 'md:order-3'
            : 'md:order-4';

          const isHighlighted = tier.highlighted;

          return (
            <AnimatedItem key={tier.id} className={orderClass}>
              <Card
                className={`relative flex flex-col h-full bg-[#1A1816] border border-white/[0.06] rounded-xl transition-all duration-200 hover:border-[rgba(249,115,22,0.3)] hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] hover:-translate-y-0.5 ${
                  isHighlighted
                    ? 'ring-2 ring-[#F97316]/50'
                    : ''
                }`}
              >
                <CardHeader className="pb-0">
                  {/* Badge */}
                  {tier.badge && (
                    <div className="mb-3">
                      <Badge className="bg-[#F97316] text-white text-xs font-semibold px-3 py-1 rounded-full">
                        {tier.badge}
                      </Badge>
                    </div>
                  )}

                  {/* Tier name */}
                  <div className="text-lg font-semibold text-white">{tier.name}</div>

                  {/* Price */}
                  <div className="mt-2 flex items-baseline gap-1">
                    {tier.monthlyPrice === null ? (
                      <span className="text-3xl font-semibold text-white">Custom</span>
                    ) : (
                      <>
                        <span className="text-3xl font-semibold text-white">${price}</span>
                        <span className="text-sm text-white/40">/mo</span>
                      </>
                    )}
                  </div>

                  {/* Strikethrough for annual */}
                  {billing === 'annual' && tier.monthlyPrice !== null && (
                    <span className="text-xs text-white/30 line-through">
                      ${tier.monthlyPrice}/mo
                    </span>
                  )}

                  {/* Description */}
                  <p className="text-sm text-white/50 mt-2">{tier.description}</p>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 pt-5">
                  {/* Feature list */}
                  <ul className="space-y-2.5 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-white/70">
                        <Check className="size-4 text-[#F97316] shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-5">
                    <Button
                      asChild
                      className={`w-full min-h-[44px] rounded-lg text-sm font-medium ${
                        isHighlighted
                          ? 'bg-[#F97316] text-white hover:bg-[#F97316]/90 shadow-[0_4px_16px_rgba(249,115,22,0.3)]'
                          : 'bg-white/[0.08] border border-white/[0.1] text-white hover:bg-white/[0.12]'
                      }`}
                    >
                      <Link href={tier.id === 'enterprise' ? tier.ctaHref : `/onboarding?plan=${tier.id}&interval=${billing}`}>
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
    </div>
  );
}
