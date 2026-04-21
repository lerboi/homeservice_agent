'use client';

// Phase 59 Plan 07 — D-17 Customer detail page
// Layout: sticky header + 3 tabs (Activity | Jobs | Invoices)
// Realtime: 3 subscriptions — customers (single row), jobs by customer_id, inquiries by customer_id (D-15)
// Activity data approach A: returned inline in /api/customers/[id] response (≤50 most-recent rows)
// Tab state persists to URL ?tab=<value>

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase-browser';
import { card } from '@/lib/design-tokens';
import CustomerDetailHeader, { CustomerDetailHeaderSkeleton } from '@/components/dashboard/customers/CustomerDetailHeader';
import CustomerActivityTimeline from '@/components/dashboard/customers/CustomerActivityTimeline';
import CustomerJobsList from '@/components/dashboard/customers/CustomerJobsList';
import CustomerInvoicesList from '@/components/dashboard/customers/CustomerInvoicesList';
import UnmergeBanner from '@/components/dashboard/customers/UnmergeBanner';
import JobFlyout from '@/components/dashboard/JobFlyout';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_TABS = ['activity', 'jobs', 'invoices'];
const DEFAULT_TAB = 'activity';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const customerId = params?.id;

  // Core state
  const [customer, setCustomer] = useState(null);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [inquiries, setInquiries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Tab state from URL param
  const tabParam = searchParams.get('tab');
  const activeTab = VALID_TABS.includes(tabParam) ? tabParam : DEFAULT_TAB;

  // Realtime tenant ID
  const [tenantId, setTenantId] = useState(null);

  // UnmergeBanner
  const recentlyMerged = searchParams.get('recently_merged') === '1';
  const auditId = searchParams.get('audit_id');

  // JobFlyout state
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobFlyoutOpen, setJobFlyoutOpen] = useState(false);

  // Integration credentials check
  const [integrationCredentials, setIntegrationCredentials] = useState({ jobber: false, xero: false });

  // VIP — any job or inquiry is_vip = true
  const hasVip = (jobs || []).some((j) => j.is_vip) || (inquiries || []).some((inq) => inq.is_vip);

  // ── Fetch customer detail ─────────────────────────────────────────────────

  const fetchCustomer = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setFetchError(false);
    setNotFound(false);
    try {
      const res = await fetch(`/api/customers/${customerId}?include_activity=1`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error('fetch_failed');
      const data = await res.json();
      setCustomer(data.customer);
      setStats(data.stats);
      setActivity(data.activity || []);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // ── Fetch scoped jobs ─────────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    if (!customerId) return;
    try {
      const res = await fetch(`/api/jobs?customer_id=${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch {
      // Non-fatal — jobs list stays null (shows skeleton until retry)
    }
  }, [customerId]);

  // ── Fetch scoped inquiries ────────────────────────────────────────────────

  const fetchInquiries = useCallback(async () => {
    if (!customerId) return;
    try {
      const res = await fetch(`/api/inquiries?customer_id=${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setInquiries(data.inquiries || []);
      }
    } catch {
      // Non-fatal
    }
  }, [customerId]);

  // ── Fetch integration credentials ────────────────────────────────────────

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/credentials');
      if (res.ok) {
        const data = await res.json();
        const creds = data.credentials || [];
        setIntegrationCredentials({
          jobber: creds.some((c) => c.provider === 'jobber'),
          xero: creds.some((c) => c.provider === 'xero'),
        });
      }
    } catch {
      // Gracefully absent — integration badges just won't show
    }
  }, []);

  // ── Initial data load ─────────────────────────────────────────────────────

  useEffect(() => {
    fetchCustomer();
    fetchJobs();
    fetchInquiries();
    fetchIntegrations();
  }, [fetchCustomer, fetchJobs, fetchInquiries, fetchIntegrations]);

  // ── Get tenant ID for Realtime ────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single()
        .then(({ data }) => setTenantId(data?.id ?? null));
    }).catch(() => {});
  }, []);

  // ── Realtime subscriptions (D-15) ─────────────────────────────────────────
  // 3 subscriptions: customers (single row), jobs by customer_id, inquiries by customer_id

  useEffect(() => {
    if (!tenantId || !customerId) return;

    // Subscription 1: customers — single row update
    const customerChannel = supabase
      .channel(`customer-detail-${customerId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customers',
        filter: `id=eq.${customerId}`,
      }, (payload) => {
        setCustomer((prev) => prev ? { ...prev, ...payload.new } : payload.new);
      })
      .subscribe();

    // Subscription 2: jobs by customer_id
    const jobsChannel = supabase
      .channel(`customer-jobs-${customerId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'jobs',
        filter: `customer_id=eq.${customerId}`,
      }, (payload) => {
        setJobs((prev) => [payload.new, ...(prev || [])]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `customer_id=eq.${customerId}`,
      }, (payload) => {
        setJobs((prev) =>
          (prev || []).map((j) => j.id === payload.new.id ? { ...j, ...payload.new } : j)
        );
      })
      .subscribe();

    // Subscription 3: inquiries by customer_id
    const inquiriesChannel = supabase
      .channel(`customer-inquiries-${customerId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'inquiries',
        filter: `customer_id=eq.${customerId}`,
      }, (payload) => {
        setInquiries((prev) => [payload.new, ...(prev || [])]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'inquiries',
        filter: `customer_id=eq.${customerId}`,
      }, (payload) => {
        setInquiries((prev) =>
          (prev || []).map((inq) => inq.id === payload.new.id ? { ...inq, ...payload.new } : inq)
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(customerChannel);
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(inquiriesChannel);
    };
  }, [tenantId, customerId]);

  // ── Tab change handler ────────────────────────────────────────────────────

  function handleTabChange(tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/dashboard/customers/${customerId}?${params.toString()}`, { scroll: false });
  }

  // ── Customer update handler ───────────────────────────────────────────────

  function handleCustomerUpdate(updatedCustomer) {
    setCustomer(updatedCustomer);
  }

  // ── 404 state ─────────────────────────────────────────────────────────────

  if (notFound) {
    return (
      <div className={`${card.base} p-8 flex flex-col items-center gap-4 text-center`}>
        <p className="text-sm font-medium text-foreground">Customer not found.</p>
        <p className="text-sm text-muted-foreground">
          They may have been merged into another record.
        </p>
        <Button onClick={() => router.push('/dashboard/customers')} className="mt-2">
          Back to Customers
        </Button>
      </div>
    );
  }

  // ── Fetch error state ─────────────────────────────────────────────────────

  if (fetchError) {
    return (
      <div className={`${card.base} p-8 flex flex-col items-center gap-4 text-center`}>
        <p className="text-sm font-medium text-foreground">This customer couldn&apos;t be loaded.</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchCustomer} size="sm">
            Retry
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard/customers')} size="sm">
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <CustomerDetailHeaderSkeleton />
        <div className={`${card.base} p-6`}>
          <div className="space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => router.push('/dashboard/customers')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Customers
        </button>
      </div>

      {/* Sticky header */}
      <CustomerDetailHeader
        customer={customer}
        stats={stats}
        onCustomerUpdate={handleCustomerUpdate}
        hasVip={hasVip}
        integrationCredentials={integrationCredentials}
      />

      {/* UnmergeBanner — appears when navigating from merge flow */}
      {(recentlyMerged || customer?.merged_source_info) && (
        <UnmergeBanner
          customerId={customerId}
          customer={customer}
          auditId={auditId}
        />
      )}

      {/* Tab content */}
      <div className={`${card.base} mt-4`}>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full border-b border-border rounded-none bg-transparent px-6 h-auto pb-0">
            <TabsTrigger
              value="activity"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--brand-accent)] data-[state=active]:bg-transparent pb-3"
            >
              Activity
            </TabsTrigger>
            <TabsTrigger
              value="jobs"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--brand-accent)] data-[state=active]:bg-transparent pb-3"
            >
              Jobs {jobs != null && jobs.length > 0 && (
                <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                  {jobs.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="invoices"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--brand-accent)] data-[state=active]:bg-transparent pb-3"
            >
              Invoices
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="p-6">
            <CustomerActivityTimeline
              activity={activity}
              loading={loading}
            />
          </TabsContent>

          <TabsContent value="jobs" className="p-6">
            <CustomerJobsList
              jobs={jobs}
              loading={jobs === null}
              onView={(jobId) => {
                setSelectedJobId(jobId);
                setJobFlyoutOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="invoices" className="p-6">
            <CustomerInvoicesList
              customerId={customerId}
              loading={loading}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* JobFlyout for jobs tab */}
      <JobFlyout
        jobId={selectedJobId}
        open={jobFlyoutOpen}
        onOpenChange={setJobFlyoutOpen}
        onStatusChange={(updatedJob) => {
          setJobs((prev) =>
            (prev || []).map((j) => j.id === updatedJob.id ? { ...j, ...updatedJob } : j)
          );
        }}
      />
    </>
  );
}
