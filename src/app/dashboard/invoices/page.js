'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, CheckCircle, Send, ArrowRight, Settings, Users, Search, X, Link2, Plug } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import InvoiceSummaryCards from '@/components/dashboard/InvoiceSummaryCards';
import InvoiceStatusBadge from '@/components/dashboard/InvoiceStatusBadge';
import InvoiceSyncIndicator from '@/components/dashboard/InvoiceSyncIndicator';
import RecurringBadge from '@/components/dashboard/RecurringBadge';
import { supabase } from '@/lib/supabase-browser';
import { useDocumentList } from '@/hooks/useDocumentList';
import { StatusTabs, ListError, ListSkeleton, EmptyFiltered } from '@/components/dashboard/DocumentListShell';
import { formatAmount, formatDate } from '@/lib/format-utils';

const STATUS_TABS = [
  { key: 'all',            label: 'All' },
  { key: 'draft',          label: 'Draft' },
  { key: 'sent',           label: 'Sent' },
  { key: 'paid',           label: 'Paid' },
  { key: 'partially_paid', label: 'Partially Paid' },
  { key: 'overdue',        label: 'Overdue' },
  { key: 'void',           label: 'Void' },
  { key: 'recurring',      label: 'Recurring' },
];

function IntegrationPill({ status }) {
  if (status === null) return null; // still loading

  const connectedProvider = status?.xero ? 'xero' : status?.jobber ? 'jobber' : null;

  if (connectedProvider) {
    const name = connectedProvider === 'xero' ? 'Xero' : 'Jobber';
    return (
      <Link
        href="/dashboard/more/integrations"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
        aria-label={`${name} connected — manage integrations`}
      >
        <Link2 className="h-3 w-3" aria-hidden="true" />
        {name} connected
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard/more/integrations"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted text-xs font-medium text-muted-foreground hover:bg-muted/70 transition-colors"
      aria-label="Connect accounting software"
    >
      <Plug className="h-3 w-3" aria-hidden="true" />
      Connect accounting
      <ArrowRight className="h-3 w-3" aria-hidden="true" />
    </Link>
  );
}

export default function InvoicesPage() {
  const router = useRouter();

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef(null);

  const {
    items: invoices,
    summary,
    statusCounts,
    loading,
    error,
    activeStatus,
    setActiveStatus,
    mutate,
  } = useDocumentList('/api/invoices', {
    itemsKey: 'invoices',
    extraParams: { search: debouncedSearch },
  });

  const [settingsComplete, setSettingsComplete] = useState(true);
  const [completedLeadsCount, setCompletedLeadsCount] = useState(0);
  const [syncStatusMap, setSyncStatusMap] = useState({});
  const [integrationStatus, setIntegrationStatus] = useState(null);

  // Fetch settings completeness + completed leads count + integration status
  useEffect(() => {
    async function fetchContext() {
      try {
        const [settingsRes, leadsRes, integrationsRes] = await Promise.all([
          fetch('/api/invoice-settings'),
          fetch('/api/leads?status=completed&limit=0'),
          fetch('/api/integrations/status'),
        ]);
        if (settingsRes.ok) {
          const { settings } = await settingsRes.json();
          setSettingsComplete(!!settings?.business_name);
        }
        if (leadsRes.ok) {
          const { leads } = await leadsRes.json();
          setCompletedLeadsCount(leads?.length || 0);
        }
        if (integrationsRes.ok) {
          const data = await integrationsRes.json();
          setIntegrationStatus(data);
        }
      } catch {}
    }
    fetchContext();
  }, []);

  // Stable key derived from invoice IDs — prevents re-fetch on SWR revalidation with same data
  const invoiceIdKey = invoices.map((inv) => inv.id).join(',');

  // Fetch sync statuses when the set of invoice IDs changes
  useEffect(() => {
    if (!invoiceIdKey) return;
    async function fetchSyncStatuses() {
      try {
        const invoiceIds = invoiceIdKey.split(',');
        const { data: syncLogs } = await supabase
          .from('accounting_sync_log')
          .select('invoice_id, provider, status, error_message')
          .in('invoice_id', invoiceIds);
        if (syncLogs && syncLogs.length > 0) {
          const map = {};
          syncLogs.forEach((log) => {
            map[log.invoice_id] = {
              provider: log.provider,
              status: log.status,
              error_message: log.error_message,
            };
          });
          setSyncStatusMap(map);
        }
      } catch {
        // Sync status is non-critical — fail silently
      }
    }
    fetchSyncStatuses();
  }, [invoiceIdKey]);

  function handleRowClick(invoiceId) {
    router.push(`/dashboard/invoices/${invoiceId}`);
  }

  function handleCreateInvoice() {
    router.push('/dashboard/invoices/new');
  }

  // Search handlers
  function handleSearchChange(e) {
    const value = e.target.value;
    setSearchInput(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }

  function clearSearch() {
    setSearchInput('');
    setDebouncedSearch('');
    clearTimeout(searchTimerRef.current);
  }

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  // Total count across all statuses for "All" tab
  const totalCount =
    (statusCounts.draft || 0) +
    (statusCounts.sent || 0) +
    (statusCounts.paid || 0) +
    (statusCounts.partially_paid || 0) +
    (statusCounts.overdue || 0) +
    (statusCounts.void || 0);

  function getTabCount(key) {
    if (key === 'all') return totalCount;
    if (key === 'recurring') return null; // No count for recurring filter
    return statusCounts[key] || 0;
  }

  return (
    <div className="relative min-h-screen">
      <div className="p-4 sm:p-6 space-y-6 pb-20 sm:pb-6">

        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">Invoices</h1>
            <IntegrationPill status={integrationStatus} />
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/more/invoice-settings"
              className="flex items-center justify-center h-9 w-9 rounded-md border border-border bg-card hover:bg-muted transition-colors"
              aria-label="Invoice settings"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
            </Link>
            <button
              onClick={handleCreateInvoice}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Invoice
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <InvoiceSummaryCards summary={summary || {}} loading={loading && !summary} />

        {/* Search bar */}
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer or invoice #..."
            value={searchInput}
            onChange={handleSearchChange}
            className="pl-9 h-9 text-sm"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status filter tabs */}
        <StatusTabs
          tabs={STATUS_TABS}
          activeStatus={activeStatus}
          onStatusChange={setActiveStatus}
          loading={loading}
          getCount={getTabCount}
        />

        {/* Error state */}
        {error && <ListError message="Couldn't load invoices. Check your connection and try again." onRetry={mutate} />}

        {/* Loading skeleton */}
        {loading && !error && <ListSkeleton />}

        {/* Empty state — no invoices at all */}
        {!loading && !error && invoices.length === 0 && activeStatus === 'all' && !debouncedSearch && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/50 mb-4" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground mb-2">No invoices yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Send professional, white-labeled invoices to your customers in three simple steps.
            </p>

            {/* Workflow visual */}
            <div className="flex items-center gap-3 mb-8">
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center justify-center size-10 rounded-full bg-muted">
                  <CheckCircle className="size-5 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">Complete job</span>
              </div>
              <ArrowRight className="size-4 text-muted-foreground/50 mt-[-18px]" />
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center justify-center size-10 rounded-full bg-orange-50">
                  <FileText className="size-5 text-[var(--brand-accent)]" />
                </div>
                <span className="text-xs text-muted-foreground">Create invoice</span>
              </div>
              <ArrowRight className="size-4 text-muted-foreground/50 mt-[-18px]" />
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center justify-center size-10 rounded-full bg-muted">
                  <Send className="size-5 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">Send to customer</span>
              </div>
            </div>

            {/* Settings nudge */}
            {!settingsComplete && (
              <Link
                href="/dashboard/more/invoice-settings"
                className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800 hover:bg-amber-100 transition-colors"
              >
                <Settings className="size-4" />
                Set up your business info first
                <ArrowRight className="size-3.5 ml-auto" />
              </Link>
            )}

            {/* Completed leads prompt */}
            {completedLeadsCount > 0 && (
              <Link
                href="/dashboard/jobs?status=completed"
                className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <Users className="size-4" />
                {completedLeadsCount} completed job{completedLeadsCount !== 1 ? 's' : ''} ready for invoicing
                <ArrowRight className="size-3.5 ml-auto" />
              </Link>
            )}

            <button
              onClick={handleCreateInvoice}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Your First Invoice
            </button>
          </div>
        )}

        {/* Empty state — filtered with no results */}
        {!loading && !error && invoices.length === 0 && (activeStatus !== 'all' || debouncedSearch) && (
          <EmptyFiltered icon={FileText} activeStatus={activeStatus} documentName="invoices" />
        )}

        {/* Invoice table — desktop */}
        {!loading && !error && invoices.length > 0 && (
          <>
            <div className="hidden sm:block border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead className="text-xs font-medium text-muted-foreground">Invoice #</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Customer</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Job Type</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Amount</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Issued</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Due</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      onClick={() => handleRowClick(invoice.id)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(invoice.id); }}}
                      className="cursor-pointer hover:bg-muted transition-colors"
                    >
                      <TableCell className="text-sm font-medium text-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          {invoice.invoice_number}
                          <InvoiceSyncIndicator syncStatus={syncStatusMap[invoice.id]} />
                          {invoice.is_recurring_template && <RecurringBadge className="text-[10px] py-0 px-1.5" />}
                          {invoice.generated_from_id && !invoice.is_recurring_template && (
                            <span className="text-[10px] text-muted-foreground">Recurring</span>
                          )}
                        </span>
                        {invoice.title && (
                          <span className="block text-xs text-muted-foreground font-normal truncate max-w-[200px]">
                            {invoice.title}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{invoice.customer_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{invoice.job_type || '\u2014'}</TableCell>
                      <TableCell className="text-sm font-medium text-foreground">{formatAmount(invoice.total)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(invoice.issued_date)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(invoice.due_date)}</TableCell>
                      <TableCell><InvoiceStatusBadge status={invoice.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Invoice cards — mobile */}
            <div className="sm:hidden space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  onClick={() => handleRowClick(invoice.id)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(invoice.id); }}}
                  role="button"
                  className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate inline-flex items-center gap-1.5">
                        {invoice.invoice_number}
                        <InvoiceSyncIndicator syncStatus={syncStatusMap[invoice.id]} />
                        {invoice.is_recurring_template && <RecurringBadge className="text-[10px] py-0 px-1.5" />}
                        {invoice.generated_from_id && !invoice.is_recurring_template && (
                          <span className="text-[10px] text-muted-foreground">Recurring</span>
                        )}
                      </p>
                      {invoice.title && (
                        <p className="text-xs text-muted-foreground truncate">{invoice.title}</p>
                      )}
                      <p className="text-sm text-foreground truncate">{invoice.customer_name}</p>
                    </div>
                    <p className="text-sm font-medium text-foreground flex-shrink-0">{formatAmount(invoice.total)}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <InvoiceStatusBadge status={invoice.status} />
                    <p className="text-xs text-muted-foreground">Due {formatDate(invoice.due_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Mobile floating action button */}
      <button
        onClick={handleCreateInvoice}
        className="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white shadow-lg flex items-center justify-center transition-colors"
        aria-label="Create Invoice"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
