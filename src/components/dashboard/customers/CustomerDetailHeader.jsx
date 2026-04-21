'use client';

// Phase 59 Plan 07 — D-17 Customer detail sticky header
// - Name (display typography), phone (mono + copy), default address, stats
// - Jobber/Xero badges when connected
// - VIP indicator when any related job/inquiry is_vip = true
// - Edit Customer CTA + overflow dropdown (Merge, View merge history)
// D-19 expanded: overflow menu "View merge history" shows only when customer
// appears in customer_merge_audit (checked via /api/admin/merges?focus=<id>&count_only=1)

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Phone, Copy, MapPin, Star, Wrench, FileSpreadsheet,
  ChevronDown, MoreHorizontal, History
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { card, focus } from '@/lib/design-tokens';
import CustomerEditModal from './CustomerEditModal';
import CustomerMergeDialog from './CustomerMergeDialog';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(phone) {
  if (!phone) return '';
  // Basic international formatting: +1 555 123 4567
  // Uses libphonenumber-js pattern from the project
  try {
    const { parsePhoneNumber } = require('libphonenumber-js');
    const parsed = parsePhoneNumber(phone);
    return parsed ? parsed.formatInternational() : phone;
  } catch {
    // Fallback: display as-is
    return phone;
  }
}

function formatCurrency(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── Header skeleton ──────────────────────────────────────────────────────────

export function CustomerDetailHeaderSkeleton() {
  return (
    <div className={`${card.base} px-6 py-6 space-y-4`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>
      <div className="flex gap-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * CustomerDetailHeader — sticky header for /dashboard/customers/[id].
 * Renders customer name, phone (mono), address, lifetime value, outstanding balance,
 * Jobber/Xero badges (when credentials present), VIP badge, Edit CTA + overflow.
 *
 * @param {{
 *   customer: object,
 *   stats: { lifetime_value: number, outstanding_balance: number|null, jobs_count: number, open_inquiries_count: number },
 *   onCustomerUpdate: function,
 *   hasVip: boolean,
 *   integrationCredentials: { jobber: boolean, xero: boolean }
 * }} props
 */
export default function CustomerDetailHeader({
  customer,
  stats,
  onCustomerUpdate,
  hasVip = false,
  integrationCredentials = { jobber: false, xero: false },
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeHistoryCount, setMergeHistoryCount] = useState(null); // null = loading, 0 = hide

  const formattedPhone = formatPhone(customer?.phone_e164);

  // D-19 expanded: preflight to check if this customer has merge history
  const checkMergeHistory = useCallback(async () => {
    if (!customer?.id) return;
    try {
      const res = await fetch(`/api/admin/merges?focus=${customer.id}&count_only=1`);
      if (res.ok) {
        const data = await res.json();
        setMergeHistoryCount(data.count ?? 0);
      }
    } catch {
      setMergeHistoryCount(0);
    }
  }, [customer?.id]);

  useEffect(() => {
    checkMergeHistory();
  }, [checkMergeHistory]);

  function handleCopyPhone() {
    if (!customer?.phone_e164) return;
    navigator.clipboard.writeText(formattedPhone).then(() => {
      toast.success('Phone number copied');
    }).catch(() => {
      toast.error('Could not copy phone number');
    });
  }

  function handleMergeSuccess({ target_id, audit_id }) {
    router.push(`/dashboard/customers/${target_id}?recently_merged=1&audit_id=${audit_id}`);
  }

  if (!customer) return <CustomerDetailHeaderSkeleton />;

  const outstandingBalance = stats?.outstanding_balance ?? null;
  const lifetimeValue = stats?.lifetime_value ?? 0;

  return (
    <>
      <div className={`${card.base} sticky top-0 z-20 px-6 py-6`}>
        <div className="flex items-start justify-between gap-4">
          {/* ── Left: name, phone, address, badges ── */}
          <div className="space-y-2 min-w-0 flex-1">
            {/* Customer name + VIP badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {customer.name || 'Unknown Customer'}
              </h1>
              {hasVip && (
                <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  Priority
                </Badge>
              )}
            </div>

            {/* Phone number — mono + copy button */}
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span
                className="font-mono tabular-nums text-sm text-foreground/80"
                aria-label={`Phone number, ${formattedPhone}`}
              >
                {formattedPhone || customer.phone_e164 || '—'}
              </span>
              {customer.phone_e164 && (
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  aria-label="Copy phone number"
                  className={`p-1 rounded text-muted-foreground hover:text-foreground transition-colors ${focus.ring}`}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Default address */}
            {customer.default_address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span>{customer.default_address}</span>
              </div>
            )}

            {/* Integration badges */}
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              {integrationCredentials?.jobber && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Wrench className="h-3 w-3" />
                  Jobber
                </Badge>
              )}
              {integrationCredentials?.xero && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <FileSpreadsheet className="h-3 w-3" />
                  Xero
                </Badge>
              )}
            </div>
          </div>

          {/* ── Right: actions ── */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setEditOpen(true)}
              className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-[var(--brand-accent-fg)] font-semibold"
              size="sm"
            >
              Edit Customer
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-2">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setMergeOpen(true)}
                >
                  Merge into another customer…
                </DropdownMenuItem>
                {mergeHistoryCount > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/admin/merges?focus=${customer.id}`)}
                    >
                      <History className="h-4 w-4 mr-2" />
                      View merge history
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Stats row: lifetime value + outstanding balance ── */}
        <div className="flex gap-6 mt-4 pt-4 border-t border-border">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Lifetime Value
            </p>
            <p className="text-base font-semibold tabular-nums text-foreground">
              {formatCurrency(lifetimeValue)}
            </p>
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Outstanding
            </p>
            <p className={`text-base font-semibold tabular-nums ${
              outstandingBalance > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-foreground'
            }`}>
              {outstandingBalance != null ? formatCurrency(outstandingBalance) : '—'}
            </p>
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Jobs
            </p>
            <p className="text-base font-semibold tabular-nums text-foreground">
              {stats?.jobs_count ?? '—'}
            </p>
          </div>

          {stats?.open_inquiries_count > 0 && (
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Open Inquiries
              </p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {stats.open_inquiries_count}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Dialogs (portaled) ── */}
      <CustomerEditModal
        customer={customer}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={onCustomerUpdate}
      />

      <CustomerMergeDialog
        sourceCustomer={customer}
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        onMergeSuccess={handleMergeSuccess}
      />
    </>
  );
}
