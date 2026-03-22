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
  const [billing, setBilling] = useState('monthly');

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex items-center justify-center mb-12">
        <div className="flex items-center gap-0 rounded-full border border-white/[0.12] bg-white/[0.04] p-1">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-150 min-h-[44px] ${
              billing === 'monthly'
                ? 'bg-[#C2410C] text-white shadow-sm'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-150 min-h-[44px] flex items-center gap-2 ${
              billing === 'annual'
                ? 'bg-[#C2410C] text-white shadow-sm'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Annual
            <span className="text-xs bg-[#166534] text-white px-2 py-0.5 rounded-full">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Tier cards */}
      <AnimatedStagger className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
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
                className={`relative flex flex-col h-full hover:-translate-y-0.5 transition-all duration-200 hover:shadow-lg bg-white ${
                  isHighlighted
                    ? 'ring-2 ring-[#C2410C] shadow-lg'
                    : ''
                }`}
              >
                <CardHeader className="pb-0">
                  {/* Badge */}
                  {tier.badge && (
                    <div className="mb-3">
                      <Badge className="bg-[#C2410C] text-white text-xs">
                        {tier.badge}
                      </Badge>
                    </div>
                  )}

                  {/* Tier name */}
                  <div className="text-xl font-semibold text-[#0F172A]">{tier.name}</div>

                  {/* Price */}
                  <div className="mt-3 flex items-baseline gap-1">
                    {tier.monthlyPrice === null ? (
                      <span className="text-4xl font-semibold text-[#0F172A]">Custom</span>
                    ) : (
                      <>
                        <span className="text-4xl font-semibold text-[#0F172A]">${price}</span>
                        <span className="text-sm text-[#475569]">/mo</span>
                      </>
                    )}
                  </div>

                  {/* Strikethrough for annual */}
                  {billing === 'annual' && tier.monthlyPrice !== null && (
                    <span className="text-xs text-[#475569] line-through">
                      ${tier.monthlyPrice}/mo
                    </span>
                  )}

                  {/* Description */}
                  <p className="text-sm text-[#475569] mt-2">{tier.description}</p>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 pt-6">
                  {/* Feature list */}
                  <ul className="space-y-3 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-[#0F172A]">
                        <Check className="size-4 text-[#166534] shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-6">
                    <Button
                      asChild
                      className={`w-full min-h-[44px] ${
                        isHighlighted
                          ? 'bg-[#C2410C] text-white hover:bg-[#C2410C]/90 shadow-[0_4px_16px_0_rgba(194,65,12,0.4)]'
                          : 'border border-[#0F172A] text-[#0F172A] hover:bg-[#0F172A]/5 bg-transparent'
                      }`}
                    >
                      <Link href={tier.ctaHref}>{tier.cta}</Link>
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
