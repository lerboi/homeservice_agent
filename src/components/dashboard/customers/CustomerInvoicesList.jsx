'use client';

// Phase 59 Plan 07 — D-17 Customer Invoices tab list
// Gated by features_enabled.invoicing (Phase 53).
// If invoicing OFF → "Invoicing is off" empty state with link to features page.
// If invoicing ON but no invoices → "No invoices yet" empty state.
// Reuses existing invoice data passed from parent (fetched via /api/invoices?customer_id=<id>).

import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import InvoiceStatusBadge from '@/components/dashboard/InvoiceStatusBadge';
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';

// ─── Loading skeleton ─────────────────────────────────────────────────────────

export function CustomerInvoicesListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
      ))}
    </div>
  );
}

// ─── Invoice row ──────────────────────────────────────────────────────────────

function InvoiceRow({ invoice, onClick }) {
  function formatCurrency(amount) {
    if (amount == null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 2,
    }).format(amount);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {invoice.invoice_number || `INV-${invoice.id.slice(0, 8).toUpperCase()}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(invoice.created_at)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(invoice.amount_due ?? invoice.total_amount)}
        </span>
        <InvoiceStatusBadge status={invoice.status} />
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * CustomerInvoicesList — invoices tab for customer detail page.
 * Gated by features_enabled.invoicing flag.
 *
 * @param {{ customerId: string, loading: boolean }} props
 */
export default function CustomerInvoicesList({ customerId, loading: parentLoading }) {
  const router = useRouter();
  const { invoicing } = useFeatureFlags();
  const [invoices, setInvoices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!customerId || !invoicing) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/invoices?customer_id=${customerId}`)
      .then((r) => r.ok ? r.json() : Promise.reject('Failed to fetch'))
      .then((data) => {
        setInvoices(data.invoices || []);
        setError(null);
      })
      .catch(() => {
        setError('Invoices could not be loaded.');
        setInvoices([]);
      })
      .finally(() => setLoading(false));
  }, [customerId, invoicing]);

  if (parentLoading || loading) {
    return <CustomerInvoicesListSkeleton />;
  }

  // Feature flag off
  if (!invoicing) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="rounded-full bg-muted p-3">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Invoicing is off</p>
          <p className="text-sm text-muted-foreground mt-1">
            Enable invoicing in Settings → Features to track invoices per customer.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/more/features')}
          className="text-sm text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] font-medium transition-colors"
        >
          Go to Features settings
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetch(`/api/invoices?customer_id=${customerId}`)
              .then((r) => r.ok ? r.json() : Promise.reject())
              .then((data) => { setInvoices(data.invoices || []); setError(null); })
              .catch(() => setError('Invoices could not be loaded.'))
              .finally(() => setLoading(false));
          }}
          className="text-sm text-[var(--brand-accent)] font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="rounded-full bg-muted p-3">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">No invoices yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create an invoice from a completed job to start tracking revenue for this customer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {invoices.map((invoice) => (
        <InvoiceRow
          key={invoice.id}
          invoice={invoice}
          onClick={() => router.push(`/dashboard/invoices/${invoice.id}`)}
        />
      ))}
    </div>
  );
}
