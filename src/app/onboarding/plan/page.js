'use client';

import PlanSelectionCards from '@/components/onboarding/PlanSelectionCards';

export default function PlanSelectionPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A] text-center">
        Choose your plan
      </h1>
      <p className="mt-2 text-sm text-[#475569] text-center">
        Your 14-day free trial starts today. No charges until your trial ends.
      </p>

      {/* Trial trust badge */}
      <div className="flex justify-center mt-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFF7ED] border border-[#FDBA74]/60 text-sm text-[#92400E]">
          <span className="size-1.5 rounded-full bg-[#F97316]" />
          14-Day Free Trial &middot; Credit card required &middot; Cancel anytime
        </div>
      </div>

      {/* Plan cards - break out of wizard card */}
      <PlanSelectionCards />
    </div>
  );
}
