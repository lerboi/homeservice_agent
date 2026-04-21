// Phase 59 Plan 07 — D-19 expanded: Admin Merges page
// Server component. Fetches /api/admin/merges and renders MergesTable.
//
// NOT linked from DashboardSidebar or BottomTabBar — admin-only surface.
// Discoverable via: direct URL OR CustomerDetailHeader overflow menu "View merge history".
//
// If ?focus=<customer_id> in URL: prefilters + shows breadcrumb.
// Empty state: "No merges yet. When you merge a customer, it shows up here."
// Header subtitle: retained-forever semantics documented per D-19 expanded.
//
// T-59-07-09: accepted — any authenticated tenant owner sees their own merge history;
//             no sub-tenant role in V1; "admin" means ops/audit surface.

import { cookies } from 'next/headers';
import MergesTable from '@/components/dashboard/admin/MergesTable';
import { ArrowLeft } from 'lucide-react';

// Next.js 16 + Cache Components: do NOT set `export const dynamic = 'force-dynamic'`
// (incompatible with nextConfig.cacheComponents). This page is already dynamic
// because it reads cookies() and passes cache: 'no-store' to the downstream fetch.

async function fetchMerges({ focus, active }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = new URL('/api/admin/merges', baseUrl);
  if (focus) url.searchParams.set('focus', focus);
  if (active === '1') url.searchParams.set('active', '1');

  try {
    const cookieStore = await cookies();
    const res = await fetch(url.toString(), {
      cache: 'no-store',
      headers: {
        cookie: cookieStore.toString(),
      },
    });
    if (!res.ok) return { merges: [], count: 0 };
    return res.json();
  } catch {
    return { merges: [], count: 0 };
  }
}

/**
 * Admin Merges page — surfaces customer_merge_audit rows for the caller's tenant.
 * D-19 expanded (2026-04-21): retained forever, shown regardless of undo status.
 */
export default async function AdminMergesPage({ searchParams }) {
  const { focus, active } = await searchParams;
  const data = await fetchMerges({ focus, active });

  // Derive focused customer name from first merge result if available
  let focusedCustomerName = null;
  if (focus && data.merges?.length > 0) {
    const firstMerge = data.merges[0];
    if (firstMerge.source_customer?.id === focus) {
      focusedCustomerName = firstMerge.source_customer.name;
    } else if (firstMerge.target_customer?.id === focus) {
      focusedCustomerName = firstMerge.target_customer.name;
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Breadcrumb / back link */}
      <div className="flex items-center gap-2 mb-6">
        <a
          href="/dashboard/customers"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Customers
        </a>
      </div>

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Merge history
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Every customer merge is recorded here permanently. This view is for audit and
          reference — merges cannot be reversed from this page (use the customer detail
          page within 7 days).
        </p>
      </div>

      {/* Focus filter breadcrumb */}
      {focus && focusedCustomerName && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-muted text-sm text-muted-foreground">
          <span>
            Showing merges involving{' '}
            <strong className="text-foreground">{focusedCustomerName}</strong>
          </span>
          <a
            href="/dashboard/admin/merges"
            className="ml-auto text-xs text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] font-medium transition-colors"
          >
            Clear filter
          </a>
        </div>
      )}

      {/* Merges table (client component) */}
      <MergesTable merges={data.merges || []} focus={focus} />

      {/* Count footer */}
      {data.count > 0 && (
        <p className="text-xs text-muted-foreground mt-4">
          {data.count} {data.count === 1 ? 'merge' : 'merges'} total
          {focus ? ' (filtered)' : ''}
        </p>
      )}
    </div>
  );
}
