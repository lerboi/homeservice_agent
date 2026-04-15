'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { TestCallPanel } from '@/components/onboarding/TestCallPanel';
import VoicePickerSection from './VoicePickerSection';

export default function SettingsAISection({ phoneNumber, initialVoice, loading }) {
  return (
    <div id="ai">
      <VoicePickerSection initialVoice={initialVoice} loading={loading} />

      <hr className="my-6 border-border" />

      {/* Phone number display */}
      {loading ? (
        <Skeleton className="h-10 w-48 mb-4" />
      ) : phoneNumber ? (
        <>
          <div
            className="bg-muted rounded-lg px-4 py-2 mb-4"
            aria-label="Your AI phone number"
          >
            <span className="text-sm font-mono text-foreground">{phoneNumber}</span>
          </div>
          <TestCallPanel phoneNumber={phoneNumber} context="settings" onComplete={() => {}} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Phone number not yet assigned</p>
      )}
    </div>
  );
}
