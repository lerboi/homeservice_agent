'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Send,
  Pencil,
  CheckCircle,
  Ban,
  Repeat,
} from 'lucide-react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import InvoiceStatusBadge from '@/components/dashboard/InvoiceStatusBadge';
import RecurringBadge from '@/components/dashboard/RecurringBadge';
import RecurringSetupDialog from '@/components/dashboard/RecurringSetupDialog';
import PaymentLog from '@/components/dashboard/PaymentLog';
import { ReminderToggle } from '@/components/dashboard/ReminderToggle';
import { card } from '@/lib/design-tokens';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMoney(val) {
  return Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getItemDescription(item) {
  if (item.item_type === 'materials' && item.markup_pct > 0) {
    return `${item.description} (${(item.markup_pct * 100).toFixed(0)}% markup)`;
  }
  return item.description || '';
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function InvoiceDetailSkeleton() {
  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-6 w-40" />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left — invoice preview */}
          <div className="flex-1 lg:w-[70%]">
            <div className={`${card.base} p-8`}>
              <div className="flex justify-between mb-8">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <div className="space-y-2 text-right">
                  <Skeleton className="h-8 w-28 ml-auto" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                </div>
              </div>
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-5 w-40 mb-6" />
              <Skeleton className="h-px w-full mb-4" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 mb-3">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
              <div className="flex justify-end mt-6 gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
          {/* Right — actions */}
          <div className="lg:w-[30%] space-y-4">
            <div className={`${card.base} p-5`}>
              <Skeleton className="h-6 w-20 mb-4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
            <div className={`${card.base} p-5 space-y-3`}>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Invoice Preview (HTML version of PDF layout) ────────────────────────────

function InvoicePreview({ invoice, settings, lineItems }) {
  const subtotal = Number(invoice.subtotal || 0);
  const taxAmount = Number(invoice.tax_amount || 0);
  const total = Number(invoice.total || 0);

  return (
    <div className={`${card.base} p-8 text-sm`}>
      {/* Header */}
      <div className="flex justify-between mb-8">
        <div className="max-w-xs">
          {settings.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logo_url}
              alt="Business logo"
              className="max-h-12 max-w-[120px] object-contain mb-2"
            />
          )}
          <p className="font-bold text-base text-foreground">{settings.business_name || ''}</p>
          {settings.address && (
            <p className="text-muted-foreground text-xs leading-relaxed">{settings.address}</p>
          )}
          {(settings.phone || settings.email) && (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {settings.phone}{settings.phone && settings.email ? ' | ' : ''}{settings.email}
            </p>
          )}
          {settings.license_number && (
            <p className="text-muted-foreground text-xs">License: {settings.license_number}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-foreground">INVOICE</p>
          {invoice.title && (
            <p className="text-sm font-medium text-foreground">{invoice.title}</p>
          )}
          <p className="text-muted-foreground text-xs">#{invoice.invoice_number}</p>
          <p className="text-muted-foreground text-xs">Issued: {invoice.issued_date || '—'}</p>
          <p className="text-muted-foreground text-xs">Due: {invoice.due_date || '—'}</p>
        </div>
      </div>

      {/* Bill To */}
      <div className="mb-6">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Bill To</p>
        <p className="font-bold text-foreground">{invoice.customer_name || '—'}</p>
        {invoice.customer_address && (
          <p className="text-muted-foreground text-xs">{invoice.customer_address}</p>
        )}
        {invoice.customer_phone && (
          <p className="text-muted-foreground text-xs">{invoice.customer_phone}</p>
        )}
        {invoice.customer_email && (
          <p className="text-muted-foreground text-xs">{invoice.customer_email}</p>
        )}
      </div>

      {/* Line Items Table */}
      <table className="w-full mb-6 border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs font-bold text-muted-foreground uppercase pb-2 w-1/2">Description</th>
            <th className="text-left text-xs font-bold text-muted-foreground uppercase pb-2 w-[15%]">Qty</th>
            <th className="text-left text-xs font-bold text-muted-foreground uppercase pb-2 w-[15%]">Rate</th>
            <th className="text-right text-xs font-bold text-muted-foreground uppercase pb-2 w-[20%]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-4 text-muted-foreground text-center text-xs">
                No line items
              </td>
            </tr>
          ) : (
            lineItems.map((item, index) => {
              const isDiscount = item.item_type === 'discount';
              const hideQtyRate = item.item_type === 'travel' || item.item_type === 'flat_rate' || isDiscount;
              const lineTotal = Number(item.line_total || 0);

              return (
                <tr
                  key={item.id || index}
                  className={`border-b border-border ${index % 2 === 1 ? 'bg-muted/50' : ''}`}
                >
                  <td className="py-2 pr-4 text-foreground">{getItemDescription(item)}</td>
                  <td className="py-2 text-muted-foreground">{hideQtyRate ? '—' : item.quantity || 1}</td>
                  <td className="py-2 text-muted-foreground">
                    {isDiscount ? '—' : `$${formatMoney(item.unit_price)}`}
                  </td>
                  <td className={`py-2 text-right font-medium ${isDiscount ? 'text-red-600' : 'text-foreground'}`}>
                    {isDiscount
                      ? `-$${formatMoney(Math.abs(lineTotal))}`
                      : `$${formatMoney(lineTotal)}`}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-52">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${formatMoney(subtotal)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Tax</span>
              <span className="text-foreground">${formatMoney(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between py-2 border-t border-border mt-1">
            <span className="font-bold text-foreground text-sm">Total Due</span>
            <span className="font-bold text-foreground text-sm">${formatMoney(total)}</span>
          </div>
        </div>
      </div>

      {/* Footer: payment terms + notes */}
      {(invoice.payment_terms || invoice.notes) && (
        <div className="border-t border-border pt-4 space-y-1">
          {invoice.payment_terms && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-muted-foreground">Payment Terms:</span> {invoice.payment_terms}
            </p>
          )}
          {invoice.notes && (
            <p className="text-xs text-muted-foreground">{invoice.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [invoice, setInvoice] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);

      const [invoiceRes, settingsRes] = await Promise.all([
        fetch(`/api/invoices/${id}`),
        fetch('/api/invoice-settings'),
      ]);

      if (!invoiceRes.ok) throw new Error('Failed to fetch invoice');

      const invoiceData = await invoiceRes.json();
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};

      setInvoice(invoiceData.invoice);
      setLineItems(invoiceData.line_items || []);
      setSettings(settingsData || {});
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkAsPaid = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });
      if (!res.ok) throw new Error('Failed to mark as paid');
      const data = await res.json();
      setInvoice(data.invoice);
      toast.success(`Invoice ${invoice.invoice_number} marked as paid`);
    } catch {
      toast.error('Failed to update invoice status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'void' }),
      });
      if (!res.ok) throw new Error('Failed to void invoice');
      const data = await res.json();
      setInvoice(data.invoice);
      toast.success(`Invoice ${invoice.invoice_number} voided`);
    } catch {
      toast.error('Failed to void invoice.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendClick = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send invoice');
      }
      toast.success('Invoice sent successfully');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopRecurring = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurring_active: false }),
      });
      if (!res.ok) throw new Error('Failed to stop recurring');
      toast.success('Recurring schedule stopped');
      fetchData();
    } catch {
      toast.error('Failed to stop recurring schedule.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Loading ──
  if (loading) return <InvoiceDetailSkeleton />;

  // ── Error ──
  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className={`${card.base} p-8 max-w-md text-center`}>
          <p className="text-foreground font-medium mb-2">Couldn&apos;t load invoice</p>
          <p className="text-muted-foreground text-sm mb-4">Check your connection and try again.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={fetchData}>Retry</Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/invoices">Back to Invoices</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isDraft = invoice.status === 'draft';
  const isSentOrOverdue = invoice.status === 'sent' || invoice.status === 'overdue';
  const isPaidOrVoid = invoice.status === 'paid' || invoice.status === 'void';

  return (
    <div className="min-h-screen bg-muted">
      {/* ── Page Header ── */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link
            href="/dashboard/invoices"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Back to Invoices"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            {invoice.title && (
              <h1 className="text-base font-semibold text-foreground truncate">{invoice.title}</h1>
            )}
            <p className={`${invoice.title ? 'text-xs text-muted-foreground' : 'text-base font-semibold text-foreground'}`}>
              {invoice.title ? `#${invoice.invoice_number}` : `Invoice ${invoice.invoice_number}`}
            </p>
          </div>
          <InvoiceStatusBadge status={invoice.status} />
          {invoice.is_recurring_template && <RecurringBadge />}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Left Column (70%): Invoice Preview ── */}
          <div className="lg:flex-1">
            <InvoicePreview invoice={invoice} settings={settings} lineItems={lineItems} />
          </div>

          {/* ── Right Column (30%): Metadata + Actions ── */}
          <div className="lg:w-72 xl:w-80 space-y-4">

            {/* Metadata card */}
            <div className={`${card.base} p-5`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Details</p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd><InvoiceStatusBadge status={invoice.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="text-foreground">{formatDate(invoice.created_at)}</dd>
                </div>
                {invoice.sent_at && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Sent</dt>
                    <dd className="text-foreground">{formatDate(invoice.sent_at)}</dd>
                  </div>
                )}
                {invoice.paid_at && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Paid</dt>
                    <dd className="text-foreground">{formatDate(invoice.paid_at)}</dd>
                  </div>
                )}
                {invoice.voided_at && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Voided</dt>
                    <dd className="text-foreground">{formatDate(invoice.voided_at)}</dd>
                  </div>
                )}
                {invoice.lead_id && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Linked Lead</dt>
                    <dd>
                      <Link
                        href={`/dashboard/leads?open=${invoice.lead_id}`}
                        className="text-[var(--brand-accent)] hover:underline text-xs"
                      >
                        View Lead
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Recurring info */}
            {invoice.is_recurring_template && (
              <div className={`${card.base} p-5`}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recurring Schedule</p>
                {invoice.recurring_active ? (
                  <p className="text-sm text-muted-foreground">
                    Next invoice: {invoice.recurring_next_date} ({invoice.recurring_frequency})
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Recurring paused</p>
                )}
                {invoice.recurring_active && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="text-sm text-muted-foreground hover:text-foreground underline mt-2">
                        Stop Recurring
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Stop recurring invoices?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Stop generating recurring invoices from this template? Existing generated invoices are not affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={handleStopRecurring}
                        >
                          Stop Recurring
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}

            {invoice.generated_from_id && (
              <div className={`${card.base} p-5`}>
                <p className="text-sm text-muted-foreground">Generated from recurring template</p>
              </div>
            )}

            {/* Payment Log */}
            <PaymentLog
              invoiceId={invoice.id}
              invoiceTotal={invoice.total}
              onStatusChange={() => fetchData()}
            />

            {/* Reminder Toggle */}
            <div className={`${card.base} p-5`}>
              <ReminderToggle
                invoiceId={invoice.id}
                initialEnabled={invoice.reminders_enabled}
              />
            </div>

            {/* Actions card */}
            <div className={`${card.base} p-5 space-y-3`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Actions</p>

              {/* Download PDF — always visible */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => window.open(`/api/invoices/${id}/pdf`, '_blank')}
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>

              {/* Send Invoice — draft only */}
              {isDraft && (
                <Button
                  className="w-full justify-start gap-2 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white"
                  onClick={handleSendClick}
                  disabled={actionLoading}
                >
                  <Send className="h-4 w-4" />
                  Send Invoice
                </Button>
              )}

              {/* Edit — draft only */}
              {isDraft && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => router.push(`/dashboard/invoices/new?edit=${id}`)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              )}

              {/* Mark as Paid — sent or overdue only */}
              {isSentOrOverdue && (
                <Button
                  className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleMarkAsPaid}
                  disabled={actionLoading}
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark as Paid
                </Button>
              )}

              {/* Resend Invoice — sent or overdue only */}
              {isSentOrOverdue && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={handleSendClick}
                  disabled={actionLoading}
                >
                  <Send className="h-4 w-4" />
                  Resend Invoice
                </Button>
              )}

              {/* Make Recurring — only for non-recurring, non-generated invoices */}
              {!invoice.is_recurring_template && !invoice.generated_from_id && !isPaidOrVoid && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setRecurringDialogOpen(true)}
                >
                  <Repeat className="h-4 w-4" />
                  Make Recurring
                </Button>
              )}

              {/* Void Invoice — not paid, not void */}
              {!isPaidOrVoid && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      disabled={actionLoading}
                    >
                      <Ban className="h-4 w-4" />
                      Void Invoice
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Void this invoice?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This marks invoice {invoice.invoice_number} as cancelled. The customer will
                        not be notified. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={handleVoid}
                      >
                        Void Invoice
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile sticky action bar ── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border p-4 flex gap-2 safe-bottom">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => window.open(`/api/invoices/${id}/pdf`, '_blank')}
        >
          <Download className="h-3.5 w-3.5" />
          PDF
        </Button>
        {isDraft && (
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white"
            onClick={handleSendClick}
            disabled={actionLoading}
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        )}
        {isSentOrOverdue && (
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleMarkAsPaid}
            disabled={actionLoading}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Paid
          </Button>
        )}
        {isSentOrOverdue && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleSendClick}
            disabled={actionLoading}
          >
            <Send className="h-3.5 w-3.5" />
            Resend
          </Button>
        )}
        {!isPaidOrVoid && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-red-600 border-red-200"
                disabled={actionLoading}
              >
                <Ban className="h-3.5 w-3.5" />
                Void
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Void this invoice?</AlertDialogTitle>
                <AlertDialogDescription>
                  This marks invoice {invoice.invoice_number} as cancelled. The customer will not be
                  notified. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleVoid}
                >
                  Void Invoice
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Recurring Setup Dialog */}
      <RecurringSetupDialog
        open={recurringDialogOpen}
        onOpenChange={setRecurringDialogOpen}
        invoiceId={invoice.id}
        onSetup={() => fetchData()}
      />
    </div>
  );
}
