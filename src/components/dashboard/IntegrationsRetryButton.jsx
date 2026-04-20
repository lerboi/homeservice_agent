'use client';

// Phase 58 Plan 58-05 (POLISH-04): server-component companion for
// /dashboard/more/integrations — the page is a server component, but
// <ErrorState onRetry> wants a client callback. This wrapper uses
// router.refresh() which re-runs the server render (including the
// getIntegrationStatus fetch) without a full page navigation.

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function IntegrationsRetryButton() {
  const router = useRouter();
  return (
    <Button variant="outline" size="sm" onClick={() => router.refresh()}>
      Try again
    </Button>
  );
}
