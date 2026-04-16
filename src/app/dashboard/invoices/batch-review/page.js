'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { card } from '@/lib/design-tokens';

/**
 * Batch Review Page — /dashboard/invoices/batch-review?ids=id1,id2,...
 *
 * Displays batch-created draft invoices for review before sending.
 * Owner can edit individual invoices, remove drafts, or Send All at once.
 */
export default function BatchReviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const invoiceIds = useMemo(() => {
    const raw = searchParams.get('ids') || '';
    return raw.split(',').filter(Boolean);
  }, [searchParams]);

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResults, setSendResults] = useState(null);

  // ── Fetch invoices on mount ────────────────────────────────────────────

  useEffect(() => {
    if (invoiceIds.length === 0) {
      setLoading(false);
      return;
    }

    async function fetchInvoices() {
      try {
        const results = await Promise.all(
          invoiceIds.map((id) =>
            fetch(`/api/invoices/${id}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        );
        const valid = results
          .filter((r) => r?.invoice)
          .map((r) => r.invoice);
        setInvoices(valid);
      } catch {
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, [invoiceIds]);

  // ── Remove draft invoice ───────────────────────────────────────────────

  async function handleRemove(invoiceId) {
    try {
      await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
    } catch {
      // Continue even if delete fails — remove from local list
    }
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
  }

  // ── Send All handler ───────────────────────────────────────────────────

  async function handleSendAll() {
    setSending(true);
    setSendProgress(0);
    setSendResults(null);

    const activeIds = invoices.map((inv) => inv.id);

    try {
      const res = await fetch('/api/invoices/batch-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_ids: activeIds }),
      });

      if (!res.ok) throw new Error('Batch send failed');

      const data = await res.json();
      setSendProgress(100);
      setSendResults(data);
    } catch {
      setSendResults({
        results: activeIds.map((id) => ({ invoice_id: id, status: 'failed', error: 'Network error' })),
        summary: { sent: 0, failed: activeIds.length },
      });
      setSendProgress(100);
    } finally {
      setSending(false);
    }
  }

  // ── Format money ───────────────────────────────────────────────────────

  function formatMoney(val) {
    return Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // ── Empty state ────────────────────────────────────────────────────────

  if (!loading && invoiceIds.length === 0) {
    return (
      <div className={`${card.base} p-6`}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">No invoices to review.</p>
          <button
            type="button"
            onClick={() => router.push('/dashboard/jobs')}
            className="text-sm text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] font-medium"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  // ── Send results view ──────────────────────────────────────────────────

  if (sendResults) {
    const { results, summary } = sendResults;
    const allSuccess = summary.failed === 0;
    return (
      <div className={`${card.base} p-0`}>
        <div className="px-6 pt-6 pb-4">
          <h1 className="text-xl font-semibold text-foreground">Batch Send Results</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {allSuccess
              ? `All ${summary.sent} invoices sent successfully.`
              : `${summary.sent} of ${summary.sent + summary.failed} invoices sent. ${summary.failed} failed.`}
          </p>
        </div>

        <div className="px-6 pb-4 space-y-2">
          {results.map((r) => {
            const inv = invoices.find((i) => i.id === r.invoice_id);
            return (
              <div
                key={r.invoice_id}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                  r.status === 'sent'
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {r.status === 'sent' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {inv?.invoice_number || r.invoice_id}
                    {inv?.customer_name ? ` — ${inv.customer_name}` : ''}
                  </p>
                  {r.error && (
                    <p className="text-xs text-red-600 mt-0.5">{r.error}</p>
                  )}
                </div>
                <span className={`text-xs font-medium ${r.status === 'sent' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {r.status === 'sent' ? 'Sent' : 'Failed'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={() => router.push('/dashboard/invoices')}
            className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${card.base} p-0`}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => router.push('/dashboard/invoices')}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back to invoices"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold text-foreground">Review Batch Invoices</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-7">
            Review each draft invoice before sending. Click any invoice to edit.
          </p>
        </div>

        {invoices.length > 0 && !sending && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Send All
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send {invoices.length} invoices?</AlertDialogTitle>
                <AlertDialogDescription>
                  All {invoices.length} invoices will be emailed to their customers. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSendAll}
                  className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white"
                >
                  Send All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* ── Sending progress ────────────────────────────────────────────── */}
      {sending && (
        <div className="px-6 pb-4">
          <p className="text-sm text-muted-foreground mb-2">
            Sending {invoices.length} invoices...
          </p>
          <Progress value={sendProgress} className="h-2" />
        </div>
      )}

      {/* ── Invoice cards ───────────────────────────────────────────────── */}
      <div className="px-6 pb-6 space-y-3">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground mb-4">No invoices to review.</p>
            <button
              type="button"
              onClick={() => router.push('/dashboard/jobs')}
              className="text-sm text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] font-medium"
            >
              Back to Jobs
            </button>
          </div>
        ) : (
          invoices.map((inv) => (
            <div
              key={inv.id}
              className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {inv.invoice_number}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                      Draft
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {inv.customer_name || 'No customer name'}
                    {inv.customer_email ? ` — ${inv.customer_email}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium text-foreground">
                    ${formatMoney(inv.total)}
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Edit invoice ${inv.invoice_number}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(inv.id)}
                    className="text-muted-foreground hover:text-red-600 transition-colors"
                    aria-label={`Remove invoice ${inv.invoice_number}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
