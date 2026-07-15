// Server Component — Phase 54 D-04 + D-10 (Pattern A).
// Renders the Calendar Connections section (a real, shipped feature) and, when
// integrations are enabled, delegates the Xero/Jobber provider cards to
// BusinessIntegrationsClient for interactive state.
//
// v1: the Xero/Jobber "Accounting & Job Management" surface is flagged OFF via
// INTEGRATIONS_ENABLED (see My Prompts/Jobber-Xero-Disable.md). When off we skip
// the status fetch entirely and render a "Coming soon" panel — no connectable
// OAuth cards, no reader query, no permanently-broken reconnect state. Flip
// NEXT_PUBLIC_INTEGRATIONS_ENABLED=true to restore the full provider cards.

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTenantId } from '@/lib/get-tenant-id';
import { getIntegrationStatus } from '@/lib/integrations/status';
import CalendarSyncCard from '@/components/dashboard/CalendarSyncCard';
import BusinessIntegrationsClient from '@/components/dashboard/BusinessIntegrationsClient';
import { card } from '@/lib/design-tokens';
import { ErrorState } from '@/components/ui/error-state';
import IntegrationsRetryButton from '@/components/dashboard/IntegrationsRetryButton';
import { INTEGRATIONS_ENABLED } from '@/lib/integrations-enabled';

export default async function IntegrationsPage() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    redirect('/auth/signin');
  }

  // Only reach for the (cached) provider status when integrations are enabled.
  let initialStatus = null;
  let statusError = null;
  if (INTEGRATIONS_ENABLED) {
    try {
      initialStatus = await getIntegrationStatus(tenantId);
    } catch {
      statusError = "Couldn't load your integrations. Check your connection and try again.";
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">Business Integrations</h1>
      <p className="text-sm text-muted-foreground">
        {INTEGRATIONS_ENABLED
          ? "Connect Xero and Jobber so your AI receptionist knows your customers' history during calls."
          : 'Connect the tools your business runs on.'}
      </p>

      {/* Calendar Connections — preserved from pre-Phase-54 page, unchanged copy */}
      <h2 className="text-base font-semibold text-foreground mt-8 mb-1">Calendar Connections</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Connect your calendar to automatically sync appointments.
      </p>
      <div className={`${card.base} p-5`}>
        <CalendarSyncCard />
      </div>

      {/* Accounting &amp; Job Management — live cards when enabled, else "Coming soon". */}
      <h2 className="text-base font-semibold text-foreground mt-10 mb-1">Accounting &amp; Job Management</h2>

      {INTEGRATIONS_ENABLED ? (
        <>
          <p className="text-sm text-muted-foreground mb-6">
            Connect Xero or Jobber to share customer history with your AI receptionist.
          </p>
          {statusError ? (
            <div className={`${card.base} p-4`}>
              <ErrorState message={statusError} />
              <div className="flex justify-center">
                <IntegrationsRetryButton />
              </div>
            </div>
          ) : (
            <Suspense fallback={null}>
              <BusinessIntegrationsClient initialStatus={initialStatus} />
            </Suspense>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-6">
            Xero and Jobber integrations are coming soon — your AI receptionist will be
            able to recognize repeat callers and read back their job and invoice history
            during a call.
          </p>
          <div className={`${card.base} p-5`}>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Coming soon
              </span>
              <p className="text-sm text-muted-foreground">Xero &amp; Jobber — not yet available.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
