'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Plan selection now happens on the pricing page.
// This page exists only as a fallback redirect.
export default function PlanSelectionRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/pricing');
  }, [router]);

  return (
    <div className="flex justify-center py-8">
      <div className="animate-spin size-6 border-2 border-[#C2410C] border-t-transparent rounded-full" />
    </div>
  );
}
