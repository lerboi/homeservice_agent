'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { TestCallPanel } from '@/components/onboarding/TestCallPanel';

export default function SettingsAISection({ phoneNumber, loading }) {
  return (
    <div id="ai">
      {/* Phone number display */}
      {loading ? (
        <Skeleton className="h-10 w-48 mb-4" />
      ) : phoneNumber ? (
        <>
          <div
            className="bg-stone-50 rounded-lg px-4 py-2 mb-4"
            aria-label="Your AI phone number"
          >
            <span className="text-sm font-mono text-[#0F172A]">{phoneNumber}</span>
          </div>
          <TestCallPanel phoneNumber={phoneNumber} context="settings" onComplete={() => {}} />
        </>
      ) : (
        <p className="text-sm text-[#475569]">Phone number not yet assigned</p>
      )}
    </div>
  );
}
