// Server Component — Phase 54 D-04 + D-10 (Pattern A).
// Reads cached per-tenant integration status via getIntegrationStatus
// ('use cache' + cacheTag inside status.js). Renders the Calendar Connections
// section (preserved, unchanged) and delegates the Xero/Jobber provider cards
// to BusinessIntegrationsClient for interactive state.

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTenantId } from '@/lib/get-tenant-id';
import { getIntegrationStatus } from '@/lib/integrations/status';
import CalendarSyncCard from '@/components/dashboard/CalendarSyncCard';
import BusinessIntegrationsClient from '@/components/dashboard/BusinessIntegrationsClient';
import { card } from '@/lib/design-tokens';

export default async function IntegrationsPage() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    redirect('/auth/signin');
  }

  const initialStatus = await getIntegrationStatus(tenantId);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">Business Integrations</h1>
      <p className="text-sm text-muted-foreground">
        Connect Xero and Jobber so your AI receptionist knows your customers&apos; history during calls.
      </p>

      {/* Calendar Connections — preserved from pre-Phase-54 page, unchanged copy */}
      <h2 className="text-base font-semibold text-foreground mt-8 mb-1">Calendar Connections</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Connect your calendar to automatically sync appointments.
      </p>
      <div className={`${card.base} p-5`}>
        <CalendarSyncCard />
      </div>

      {/* Accounting &amp; Job Management — provider-first cards per UI-SPEC */}
      <h2 className="text-base font-semibold text-foreground mt-10 mb-1">Accounting &amp; Job Management</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Connect Xero or Jobber to share customer history with your AI receptionist.
      </p>

      <Suspense fallback={null}>
        <BusinessIntegrationsClient initialStatus={initialStatus} />
      </Suspense>
    </div>
  );
}
