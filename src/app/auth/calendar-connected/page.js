'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';

const PROVIDER_LABELS = {
  google: 'Google Calendar',
  outlook: 'Outlook Calendar',
};

export default function CalendarConnectedPage() {
  const searchParams = useSearchParams();
  const provider = searchParams.get('provider') || 'google';
  const isError = searchParams.get('error') === 'true';
  const reason = searchParams.get('reason');
  const [showFallback, setShowFallback] = useState(false);

  const label = PROVIDER_LABELS[provider] || 'Calendar';

  useEffect(() => {
    // Notify parent window
    const message = isError
      ? { type: 'calendar-error', provider, reason }
      : { type: 'calendar-connected', provider };

    window.opener?.postMessage(message, window.location.origin);

    // Try to close the popup
    try {
      window.close();
    } catch {
      // Browser blocked window.close()
    }

    // If still open after 500ms, show fallback UI
    const t = setTimeout(() => setShowFallback(true), 500);
    return () => clearTimeout(t);
  }, [provider, isError]);

  // Brief blank screen while attempting auto-close
  if (!showFallback) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9] px-6">
      <div className="text-center max-w-sm">
        {isError ? (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-[#0F172A] mb-2">
              Connection Failed
            </h1>
            <p className="text-sm text-[#64748B] mb-6">
              Couldn&apos;t connect {label}. Please close this window and try again.
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-[#0F172A] mb-2">
              {label} Connected
            </h1>
            <p className="text-sm text-[#64748B] mb-6">
              You can close this window now.
            </p>
          </>
        )}
        <button
          onClick={() => window.close()}
          className="text-sm text-[#C2410C] hover:underline"
        >
          Close Window
        </button>
      </div>
    </div>
  );
}
