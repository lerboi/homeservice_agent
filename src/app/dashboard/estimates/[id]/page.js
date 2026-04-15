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
  XCircle,
  Clock,
  FileText,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import EstimateStatusBadge from '@/components/dashboard/EstimateStatusBadge';
import { card } from '@/lib/design-tokens';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatMoney(val) {
  return Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr) {
  if (!dateStr) return null;
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

// ── Loading Skeleton ────────────────────────────────────────────────────────

function EstimateDetailSkeleton() {
  return (
    <div className="min-h-screen bg-muted">
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-6 w-40" />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
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
            </div>
          </div>
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

// ── Line Items Table ────────────────────────────────────────────────────────

function LineItemsTable({ lineItems }) {
  return (
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
                <td className="py-2 text-muted-foreground">{hideQtyRate ? '\u2014' : item.quantity || 1}</td>
                <td className="py-2 text-muted-foreground">
                  {isDiscount ? '\u2014' : `$${formatMoney(item.unit_price)}`}
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
  );
}

// ── Tier Card ───────────────────────────────────────────────────────────────

function TierCard({ tier, lineItems }) {
  const tierItems = lineItems.filter((li) => li.tier_id === tier.id);
  const subtotal = Number(tier.subtotal || 0);
  const taxAmount = Number(tier.tax_amount || 0);
  const total = Number(tier.total || 0);

  return (
    <div className={`${card.base} p-5 flex-1`}>
      <h3 className="text-lg font-semibold text-foreground mb-4">{tier.tier_label || 'Tier'}</h3>
      <LineItemsTable lineItems={tierItems} />
      <div className="flex justify-end">
        <div className="w-48">
          <div className="flex justify-between py-1 text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${formatMoney(subtotal)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between py-1 text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="text-foreground">${formatMoney(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between py-2 border-t border-border mt-1">
            <span className="font-bold text-foreground">Total</span>
            <span className="font-bold text-foreground">${formatMoney(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Estimate Preview ────────────────────────────────────────────────────────

function EstimatePreview({ estimate, settings, lineItems, tiers }) {
  const isTiered = tiers && tiers.length > 0;
  const subtotal = Number(estimate.subtotal || 0);
  const taxAmount = Number(estimate.tax_amount || 0);
  const total = Number(estimate.total || 0);

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
          <p className="text-2xl font-bold text-foreground">ESTIMATE</p>
          <p className="text-muted-foreground text-xs">#{estimate.estimate_number}</p>
          <p className="text-muted-foreground text-xs">Created: {estimate.created_date || '\u2014'}</p>
          {estimate.valid_until && (
            <p className="text-muted-foreground text-xs">Valid Until: {estimate.valid_until}</p>
          )}
        </div>
      </div>

      {/* Estimate For */}
      <div className="mb-6">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Estimate For</p>
        <p className="font-bold text-foreground">{estimate.customer_name || '\u2014'}</p>
        {estimate.customer_address && (
          <p className="text-muted-foreground text-xs">{estimate.customer_address}</p>
        )}
        {estimate.customer_phone && (
          <p className="text-muted-foreground text-xs">{estimate.customer_phone}</p>
        )}
        {estimate.customer_email && (
          <p className="text-muted-foreground text-xs">{estimate.customer_email}</p>
        )}
      </div>

      {isTiered ? (
        /* Tiered Layout */
        <div>
          <p className="text-xs text-muted-foreground mb-4">Options for your consideration</p>
          <div className="flex flex-col md:flex-row gap-4">
            {tiers.map((tier) => (
              <TierCard key={tier.id} tier={tier} lineItems={lineItems} />
            ))}
          </div>
        </div>
      ) : (
        /* Single-Price Layout */
        <div>
          <LineItemsTable lineItems={lineItems.filter((li) => !li.tier_id)} />
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
                <span className="font-bold text-foreground text-sm">Estimated Total</span>
                <span className="font-bold text-foreground text-sm">${formatMoney(total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {(estimate.valid_until || estimate.notes) && (
        <div className="border-t border-border pt-4 space-y-1">
          {estimate.valid_until && (
            <p className="text-xs text-muted-foreground">
              This estimate is valid until {estimate.valid_until}.
            </p>
          )}
          {estimate.notes && (
            <p className="text-xs text-muted-foreground">{estimate.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Convert to Invoice Dialog (Tier Selection) ──────────────────────────────

function ConvertToInvoiceDialog({ open, onOpenChange, tiers, estimateId, onConverted }) {
  const [selectedTierId, setSelectedTierId] = useState(tiers[0]?.id || '');
  const [converting, setConverting] = useState(false);

  async function handleConvert() {
    setConverting(true);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier_id: selectedTierId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to convert');
      }
      const data = await res.json();
      onConverted(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConverting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert to Invoice</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Select which tier to use for the invoice:
        </p>
        <div className="space-y-3">
          {tiers.map((tier) => (
            <label
              key={tier.id}
              className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                selectedTierId === tier.id
                  ? 'border-[var(--brand-accent)] bg-orange-50/50'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <input
                type="radio"
                name="tier_id"
                value={tier.id}
                checked={selectedTierId === tier.id}
                onChange={() => setSelectedTierId(tier.id)}
                className="accent-[var(--brand-accent)]"
              />
              <div className="flex-1">
                <p className="font-medium text-foreground">{tier.tier_label}</p>
                <p className="text-sm text-muted-foreground">${formatMoney(tier.total)}</p>
              </div>
            </label>
          ))}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white"
            onClick={handleConvert}
            disabled={converting}
          >
            {converting ? 'Converting...' : 'Create Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function EstimateDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [estimate, setEstimate] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);

      const [estimateRes, settingsRes] = await Promise.all([
        fetch(`/api/estimates/${id}`),
        fetch('/api/invoice-settings'),
      ]);

      if (!estimateRes.ok) throw new Error('Failed to fetch estimate');

      const estimateData = await estimateRes.json();
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};

      setEstimate(estimateData.estimate);
      setLineItems(estimateData.line_items || []);
      setTiers(estimateData.tiers || []);
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

  // ── Action handlers ─────────────────────────────────────────────────────

  const handleSend = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/estimates/${id}/send`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send estimate');
      }
      toast.success('Estimate sent');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/estimates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`Failed to update status`);
      const data = await res.json();
      setEstimate(data.estimate);
      toast.success(
        newStatus === 'approved'
          ? 'Estimate approved'
          : newStatus === 'declined'
          ? 'Estimate declined'
          : 'Estimate marked as expired'
      );
    } catch {
      toast.error('Failed to update estimate status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertSinglePrice = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/estimates/${id}/convert`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to convert');
      }
      const data = await res.json();
      toast.success('Invoice created');
      router.push(`/dashboard/invoices/${data.invoice_id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertTiered = (data) => {
    setShowConvertDialog(false);
    toast.success('Invoice created');
    router.push(`/dashboard/invoices/${data.invoice_id}`);
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await fetch(`/api/estimates/${id}/pdf`);
      if (!res.ok) throw new Error('Failed to download PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${estimate?.estimate_number || 'estimate'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  // ── Loading ──
  if (loading) return <EstimateDetailSkeleton />;

  // ── Error ──
  if (error || !estimate) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className={`${card.base} p-8 max-w-md text-center`}>
          <p className="text-foreground font-medium mb-2">Couldn&apos;t load estimate</p>
          <p className="text-muted-foreground text-sm mb-4">Check your connection and try again.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={fetchData}>Retry</Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/estimates">Back to Estimates</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isDraft = estimate.status === 'draft';
  const isSent = estimate.status === 'sent';
  const isApproved = estimate.status === 'approved';
  const isTiered = tiers.length > 0;
  const canConvert = isApproved && !estimate.converted_to_invoice_id;

  return (
    <div className="min-h-screen bg-muted">
      {/* ── Page Header ── */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link
            href="/dashboard/estimates"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Back to Estimates"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-base font-semibold text-foreground">
            Estimate {estimate.estimate_number}
          </h1>
          <EstimateStatusBadge status={estimate.status} />
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Left Column (70%): Estimate Preview ── */}
          <div className="lg:flex-1">
            <EstimatePreview
              estimate={estimate}
              settings={settings}
              lineItems={lineItems}
              tiers={tiers}
            />
          </div>

          {/* ── Right Column (30%): Metadata + Actions ── */}
          <div className="lg:w-72 xl:w-80 space-y-4">

            {/* Metadata card */}
            <div className={`${card.base} p-5`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Details</p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd><EstimateStatusBadge status={estimate.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="text-foreground">{formatDate(estimate.created_date) || formatDate(estimate.created_at) || '\u2014'}</dd>
                </div>
                {estimate.valid_until && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Valid Until</dt>
                    <dd className="text-foreground">{formatDate(estimate.valid_until)}</dd>
                  </div>
                )}
                {estimate.sent_at && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Sent</dt>
                    <dd className="text-foreground">{formatDate(estimate.sent_at)}</dd>
                  </div>
                )}
                {estimate.approved_at && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Approved</dt>
                    <dd className="text-foreground">{formatDate(estimate.approved_at)}</dd>
                  </div>
                )}
                {estimate.converted_to_invoice_id && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Invoice</dt>
                    <dd>
                      <Link
                        href={`/dashboard/invoices/${estimate.converted_to_invoice_id}`}
                        className="text-[var(--brand-accent)] hover:underline text-xs"
                      >
                        View Invoice
                      </Link>
                    </dd>
                  </div>
                )}
                {estimate.lead_id && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Linked Lead</dt>
                    <dd>
                      <Link
                        href={`/dashboard/leads?open=${estimate.lead_id}`}
                        className="text-[var(--brand-accent)] hover:underline text-xs"
                      >
                        View Lead
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Actions card */}
            <div className={`${card.base} p-5 space-y-3`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Actions</p>

              {/* Download PDF -- always visible */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleDownloadPdf}
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>

              {/* Send Estimate -- draft only */}
              {isDraft && (
                <Button
                  className="w-full justify-start gap-2 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white"
                  onClick={handleSend}
                  disabled={actionLoading}
                >
                  <Send className="h-4 w-4" />
                  Send Estimate
                </Button>
              )}

              {/* Edit -- draft only */}
              {isDraft && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => router.push(`/dashboard/estimates/new?id=${id}`)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              )}

              {/* Mark as Approved -- sent only */}
              {isSent && (
                <Button
                  className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleStatusChange('approved')}
                  disabled={actionLoading}
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark as Approved
                </Button>
              )}

              {/* Mark as Declined -- sent only */}
              {isSent && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      disabled={actionLoading}
                    >
                      <XCircle className="h-4 w-4" />
                      Mark as Declined
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Decline estimate {estimate.estimate_number}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This marks it as declined. You can still convert it later if needed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => handleStatusChange('declined')}
                      >
                        Decline Estimate
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Mark as Expired -- sent only */}
              {isSent && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => handleStatusChange('expired')}
                  disabled={actionLoading}
                >
                  <Clock className="h-4 w-4" />
                  Mark as Expired
                </Button>
              )}

              {/* Convert to Invoice -- approved only, not yet converted */}
              {canConvert && (
                isTiered ? (
                  <Button
                    className="w-full justify-start gap-2 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white"
                    onClick={() => setShowConvertDialog(true)}
                    disabled={actionLoading}
                  >
                    <FileText className="h-4 w-4" />
                    Convert to Invoice
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="w-full justify-start gap-2 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white"
                        disabled={actionLoading}
                      >
                        <FileText className="h-4 w-4" />
                        Convert to Invoice
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Convert to Invoice?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will create a new draft invoice from estimate {estimate.estimate_number} for ${formatMoney(estimate.total)}.
                          You can edit the invoice before sending it.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white"
                          onClick={handleConvertSinglePrice}
                        >
                          Create Invoice
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )
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
          onClick={handleDownloadPdf}
        >
          <Download className="h-3.5 w-3.5" />
          PDF
        </Button>
        {isDraft && (
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white"
            onClick={handleSend}
            disabled={actionLoading}
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        )}
        {isSent && (
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => handleStatusChange('approved')}
            disabled={actionLoading}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Approve
          </Button>
        )}
        {canConvert && (
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white"
            onClick={isTiered ? () => setShowConvertDialog(true) : handleConvertSinglePrice}
            disabled={actionLoading}
          >
            <FileText className="h-3.5 w-3.5" />
            Convert
          </Button>
        )}
      </div>

      {/* ── Tiered convert dialog ── */}
      {isTiered && (
        <ConvertToInvoiceDialog
          open={showConvertDialog}
          onOpenChange={setShowConvertDialog}
          tiers={tiers}
          estimateId={id}
          onConverted={handleConvertTiered}
        />
      )}
    </div>
  );
}
