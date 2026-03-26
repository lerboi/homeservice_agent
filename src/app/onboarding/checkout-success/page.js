'use client';

import { Suspense } from 'react';
import CheckoutSuccessContent from '@/components/onboarding/CheckoutSuccessContent';

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-8">
          <div className="animate-spin size-6 border-2 border-[#C2410C] border-t-transparent rounded-full" />
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
