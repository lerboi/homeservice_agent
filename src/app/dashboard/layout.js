import { getTenantId } from '@/lib/get-tenant-id';
import { getTenantFeatures } from '@/lib/features';
import DashboardLayoutClient from './DashboardLayoutClient';

/**
 * Server-side dashboard layout wrapper (Phase 53).
 *
 * Resolves the current tenant's feature flags ONCE per request and hands them
 * to the Client layout for distribution via FeatureFlagsProvider. This avoids
 * a client-side flash where invoicing UI renders briefly before the flag value
 * arrives (which would happen if features were fetched client-side via useEffect).
 *
 * Auth: getTenantId() returns null for unauthenticated users — the proxy gate
 * (src/proxy.js) redirects unauthenticated dashboard requests to /auth/signin
 * before this layout runs, so reaching here without a session means we're either
 * mid-redirect or in an unusual edge case. We fail-closed: features default to
 * { invoicing: false } so no flagged UI leaks.
 */
export default async function DashboardLayout({ children }) {
  const tenantId = await getTenantId();
  const features = tenantId
    ? await getTenantFeatures(tenantId)
    : { invoicing: false };

  return (
    <DashboardLayoutClient features={features}>
      {children}
    </DashboardLayoutClient>
  );
}
