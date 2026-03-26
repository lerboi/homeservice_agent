'use client';

import { useState } from 'react';
import { PRICING_TIERS } from '@/app/(public)/pricing/pricingData';
import { Check, Loader2 } from 'lucide-react';

const tiers = PRICING_TIERS.filter((t) => t.id !== 'enterprise');

export default function PlanSelectionCards() {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  async function handleSelect(planId) {
    setLoading(planId);
    setError(null);

    try {
      const res = await fetch('/api/onboarding/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      // Redirect to Stripe Checkout (external URL — must use window.location.href)
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(null);
    }
  }

  return (
    <div
      className="relative -mx-6 sm:-mx-8 -mb-8 sm:-mb-8 mt-6 pt-2 px-4 sm:px-0"
      aria-busy={loading !== null}
    >
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {tiers.map((tier, index) => (
            <article
              key={tier.id}
              role="article"
              aria-label={`${tier.name} plan — $${tier.monthlyPrice}/month`}
              className={`
                relative bg-white border border-stone-200/60 rounded-xl
                hover:border-[#C2410C]/30 hover:shadow-[0_0_20px_rgba(194,65,12,0.12)]
                hover:-translate-y-0.5 transition-all duration-200
                flex flex-col p-6
                ${tier.highlighted ? 'ring-2 ring-[#C2410C]/40' : ''}
              `}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* Most Popular badge */}
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#C2410C] text-white text-xs font-semibold px-3 py-1 rounded-full">
                    {tier.badge}
                  </span>
                </div>
              )}

              {/* Tier name */}
              <h3 className="text-lg font-semibold text-[#0F172A]">
                {tier.name}
              </h3>

              {/* Description */}
              <p className="text-sm text-[#475569] mt-1">{tier.description}</p>

              {/* Price */}
              <div className="mt-4">
                <span className="text-3xl font-semibold text-[#0F172A]">
                  ${tier.monthlyPrice}
                </span>
                <span className="text-sm font-semibold text-[#475569]">/mo</span>
              </div>

              {/* Feature list */}
              <ul className="mt-4 space-y-2 flex-1" aria-label={`${tier.name} features`}>
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check
                      className="size-4 text-[#F97316] mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-[#475569]">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              <button
                onClick={() => handleSelect(tier.id)}
                disabled={loading !== null}
                aria-disabled={loading !== null}
                aria-label={`Start 14-day free trial on the ${tier.name} plan`}
                className={`
                  mt-6 w-full min-h-[44px] rounded-lg font-medium text-sm
                  flex items-center justify-center gap-2
                  transition-colors duration-150
                  disabled:opacity-60 disabled:cursor-not-allowed
                  ${
                    tier.highlighted
                      ? 'bg-[#C2410C] text-white hover:bg-[#C2410C]/90 shadow-[0_4px_16px_rgba(194,65,12,0.25)]'
                      : 'bg-white border border-stone-300 text-[#0F172A] hover:bg-stone-50'
                  }
                `}
              >
                {loading === tier.id ? (
                  <>
                    <Loader2 className="animate-spin size-4" />
                    Redirecting...
                  </>
                ) : (
                  'Start Free Trial'
                )}
              </button>
            </article>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div role="alert" className="mt-4 text-center text-sm text-red-600">
            Something went wrong. Please try again, or{' '}
            <a href="/contact?type=support" className="underline">
              contact support
            </a>
            .
          </div>
        )}

        {/* Enterprise note */}
        <p className="text-center text-sm text-[#475569] mt-4 pb-4">
          Need more?{' '}
          <a href="/contact?type=sales" className="underline">
            Contact us for Enterprise.
          </a>
        </p>
      </div>
    </div>
  );
}
