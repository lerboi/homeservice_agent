'use client';

// Phase 59 Plan 07 — JobFlyout
// Replaces LeadFlyout on the Jobs tab. Scoped to job shape (job.customer, job.appointment).
// Preserves ALL Phase 33-49 affordances from LeadFlyout:
//   - Status change dropdown (scheduled/completed/paid/cancelled/lost)
//   - Revenue input for completed/paid
//   - Audio player
//   - Transcript viewer
//   - Create/View Invoice button (when invoicing flag ON)
//   - VIP toggle (Phase 46)
//   - Escalation indicators (via existing CustomerTimeline)
//
// Data: fetches from /api/jobs/[id] on open.
// Status updates: PATCH /api/jobs/[id]
// Invoice: /api/invoices?job_id=<id>
// VIP toggle: PATCH /api/jobs/[id] {is_vip: bool}

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Phone, MapPin, Calendar, Briefcase, FileText, ExternalLink,
  ClipboardList, Pencil, Check, X, UserCheck, AlertCircle
} from 'lucide-react';
import InvoiceStatusBadge from '@/components/dashboard/InvoiceStatusBadge';
import CustomerTimeline from '@/components/dashboard/CustomerTimeline';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import AudioPlayer from '@/components/dashboard/AudioPlayer';
import TranscriptViewer from '@/components/dashboard/TranscriptViewer';
import RevenueInput from '@/components/dashboard/RevenueInput';
import { supabase } from '@/lib/supabase-browser';
import { btn } from '@/lib/design-tokens';
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY_STYLES = {
  emergency: { badge: 'bg-red-100 text-red-700', label: 'Emergency' },
  routine: { badge: 'bg-foreground/[0.06] text-foreground/70', label: 'Routine' },
  urgent: { badge: 'bg-amber-100 text-amber-700', label: 'Urgent' },
};

// Job status options (Phase 59 schema: D-09)
const STATUS_LABELS = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  paid: 'Paid',
  cancelled: 'Cancelled',
  lost: 'Lost',
};

const STATUS_OPTIONS = ['scheduled', 'completed', 'paid', 'cancelled', 'lost'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function showsRevenueInput(status) {
  return status === 'completed' || status === 'paid';
}

function formatPhone(phone) {
  if (!phone) return phone;
  try {
    const { parsePhoneNumber } = require('libphonenumber-js');
    const parsed = parsePhoneNumber(phone);
    return parsed ? parsed.formatInternational() : phone;
  } catch {
    return phone;
  }
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function JobFlyoutSkeleton() {
  return (
    <div className="px-6 space-y-6 animate-pulse">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Separator />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Separator />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-8 w-36" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * JobFlyout — right Sheet panel with full job detail.
 * Fetches from /api/jobs/[id] on open. Handles status change, revenue, invoice, VIP.
 * Preserves ALL Phase 33-49 affordances from LeadFlyout.
 *
 * @param {{ jobId: string|null, open: boolean, onOpenChange: function, onStatusChange: function }} props
 */
export default function JobFlyout({ jobId, open, onOpenChange, onStatusChange }) {
  const router = useRouter();
  const { invoicing } = useFeatureFlags();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [linkedInvoice, setLinkedInvoice] = useState(null);

  // Status change state
  const [selectedStatus, setSelectedStatus] = useState('');
  const [revenueAmount, setRevenueAmount] = useState('');
  const [revenueError, setRevenueError] = useState('');
  const [saving, setSaving] = useState(false);
  const [markingLost, setMarkingLost] = useState(false);

  // Recording src
  const [recordingSrc, setRecordingSrc] = useState(null);

  // Fetch job detail when flyout opens
  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to fetch job');
      const data = await res.json();
      setJob(data.job);
      setSelectedStatus(data.job.status);
      setRevenueAmount(data.job.revenue_amount ? String(data.job.revenue_amount) : '');
      setRevenueError('');

      // Check for linked invoice
      try {
        const invRes = await fetch(`/api/invoices?job_id=${jobId}`);
        if (invRes.ok) {
          const invData = await invRes.json();
          setLinkedInvoice(invData.invoices?.[0] || null);
        }
      } catch {
        setLinkedInvoice(null);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (open && jobId) {
      fetchJob();
    } else if (!open) {
      setJob(null);
      setLoading(false);
      setFetchError(false);
      setSelectedStatus('');
      setRevenueAmount('');
      setRevenueError('');
      setLinkedInvoice(null);
      setRecordingSrc(null);
    }
  }, [open, jobId, fetchJob]);

  // Resolve recording URL
  const firstCall = job?.calls?.[0]?.call ?? null;
  useEffect(() => {
    if (!firstCall) { setRecordingSrc(null); return; }
    if (firstCall.recording_storage_path) {
      supabase.storage
        .from('call-recordings')
        .createSignedUrl(firstCall.recording_storage_path, 3600)
        .then(({ data }) => setRecordingSrc(data?.signedUrl || null));
    } else {
      setRecordingSrc(firstCall.recording_url || null);
    }
  }, [firstCall]);

  // ── Save status change ──────────────────────────────────────────────────

  async function handleSave() {
    if (!job) return;

    if (selectedStatus === 'paid' && !revenueAmount) {
      setRevenueError('Enter a revenue amount to save this as Paid.');
      return;
    }

    setRevenueError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedStatus,
          revenue_amount: revenueAmount ? parseFloat(revenueAmount) : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Update failed');
      }

      const updatedData = await res.json();
      setJob(updatedData.job);

      if (selectedStatus === 'lost') {
        toast.success('Job marked as Lost');
      } else if (revenueAmount && showsRevenueInput(selectedStatus)) {
        toast.success(`$${parseFloat(revenueAmount).toFixed(2)} recorded for ${job.customer?.name || 'job'}`);
      } else {
        toast.success(`${job.customer?.name || 'Job'} moved to ${STATUS_LABELS[selectedStatus]}`);
      }

      onStatusChange?.(updatedData.job);
    } catch (err) {
      toast.error('Status update failed. Try again — your changes weren\'t saved.');
    } finally {
      setSaving(false);
    }
  }

  // ── Mark as Lost ────────────────────────────────────────────────────────

  async function handleMarkLost() {
    if (!job) return;
    setMarkingLost(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'lost' }),
      });
      if (!res.ok) throw new Error('Failed to mark as lost');
      const updatedData = await res.json();
      toast.success('Job marked as Lost');
      onStatusChange?.(updatedData.job);
      onOpenChange(false);
    } catch {
      toast.error('Status update failed. Try again — your changes weren\'t saved.');
    } finally {
      setMarkingLost(false);
    }
  }

  const urgencyStyle = URGENCY_STYLES[job?.urgency] || URGENCY_STYLES.routine;
  const displayPhone = formatPhone(job?.customer?.phone_e164);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-card">

        {loading && (
          <>
            <SheetHeader className="pb-0">
              <SheetTitle className="sr-only">Loading job details</SheetTitle>
            </SheetHeader>
            <JobFlyoutSkeleton />
          </>
        )}

        {!loading && fetchError && (
          <>
            <SheetHeader>
              <SheetTitle className="text-xl text-foreground">Job Details</SheetTitle>
            </SheetHeader>
            <div className="px-6 flex flex-col items-center gap-4 py-8">
              <p className="text-sm text-muted-foreground text-center">
                Couldn&apos;t load job details.
              </p>
              <Button variant="outline" size="sm" onClick={fetchJob}>
                Retry
              </Button>
            </div>
          </>
        )}

        {!loading && !fetchError && job && (
          <>
            {/* ── SheetHeader ── */}
            <SheetHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs font-semibold ${urgencyStyle.badge}`}>
                    {urgencyStyle.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(job.created_at)}
                  </span>
                </div>
              </div>
              <SheetTitle className="text-xl font-semibold text-foreground leading-snug mt-1">
                {job.customer?.name || 'Unknown Customer'}
              </SheetTitle>
            </SheetHeader>

            <div className="px-6 space-y-6 pb-4">

              {/* ── Customer section ── */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-foreground/80">
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  {displayPhone ? (
                    <a
                      href={`tel:${job.customer?.phone_e164}`}
                      className="font-mono tabular-nums text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] transition-colors"
                    >
                      {displayPhone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">No phone</span>
                  )}
                </div>

                {job.appointment?.start_time && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span>{formatDateTime(job.appointment.start_time)}</span>
                  </div>
                )}
              </div>

              <Separator className="bg-muted" />

              {/* ── Job Details section ── */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Job Details
                </h3>

                {job.job_type && (
                  <div className="flex items-center gap-2 text-sm text-foreground/80">
                    <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="capitalize">{job.job_type}</span>
                  </div>
                )}

                {(job.appointment?.service_address || job.customer?.default_address) && (
                  <div className="flex items-start gap-2 text-sm text-foreground/80">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span>
                      {job.appointment?.service_address || job.customer?.default_address}
                    </span>
                  </div>
                )}

                {/* Urgency selector */}
                <div className="flex items-center gap-2 text-sm text-foreground/80">
                  <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Select
                    value={job.urgency || 'routine'}
                    onValueChange={async (v) => {
                      const prev = job.urgency;
                      setJob((p) => ({ ...p, urgency: v }));
                      try {
                        const res = await fetch(`/api/jobs/${job.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ urgency: v }),
                        });
                        if (!res.ok) throw new Error();
                        toast.success('Urgency updated');
                      } catch {
                        setJob((p) => ({ ...p, urgency: prev }));
                        toast.error('Could not update urgency');
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 w-auto text-sm border-none shadow-none px-2 -mx-2 hover:bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="bg-muted" />

              {/* ── Audio player ── */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Call Recording
                </h3>
                <AudioPlayer src={recordingSrc} />
              </div>

              {/* ── Transcript ── */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Transcript
                </h3>
                <TranscriptViewer
                  transcriptStructured={firstCall?.transcript_structured ?? null}
                  transcriptText={firstCall?.transcript_text ?? null}
                />
              </div>

              {/* ── Invoice section ── (Phase 33-35, gated by invoicing flag) */}
              {invoicing && (job.status === 'scheduled' || job.status === 'completed' || job.status === 'paid') && (
                <>
                  <Separator className="bg-muted" />
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Invoice
                    </h3>

                    {linkedInvoice ? (
                      <button
                        onClick={() => router.push(`/dashboard/invoices/${linkedInvoice.id}`)}
                        className="flex items-center justify-between w-full px-3 py-2.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                      >
                        <span className="flex items-center gap-2 text-foreground font-medium">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {linkedInvoice.invoice_number}
                        </span>
                        <span className="flex items-center gap-2">
                          <InvoiceStatusBadge status={linkedInvoice.status} />
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push(`/dashboard/invoices/new?job_id=${job.id}`)}
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-[var(--brand-accent)] border border-[var(--brand-accent)]/30 rounded-lg hover:bg-accent transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        {job.status === 'scheduled' ? 'Create Draft Invoice' : 'Create Invoice'}
                      </button>
                    )}

                    <button
                      onClick={() => router.push(`/dashboard/estimates/new?job_id=${job.id}`)}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-[var(--brand-accent)] border border-[var(--brand-accent)] rounded-lg hover:bg-[var(--brand-accent)]/10 transition-colors"
                    >
                      <ClipboardList className="h-4 w-4" />
                      Create Estimate
                    </button>
                  </div>
                </>
              )}

              {/* ── Customer Journey Timeline ── */}
              {job.customer?.phone_e164 && (
                <>
                  <Separator className="bg-muted" />
                  <CustomerTimeline phone={job.customer.phone_e164} />
                </>
              )}

              {/* ── VIP toggle (Phase 46) ── */}
              {job.customer?.phone_e164 && (
                <>
                  <Separator className="bg-muted" />
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <UserCheck className={`h-3.5 w-3.5 ${job.is_vip ? 'text-violet-500' : 'text-muted-foreground'}`} />
                      <div>
                        <span className="text-sm font-medium text-foreground">Priority Caller</span>
                        <p className="text-xs text-muted-foreground">
                          Always ring your phone when this caller dials in.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={job.is_vip || false}
                      onCheckedChange={async (checked) => {
                        setJob((prev) => ({ ...prev, is_vip: checked }));
                        try {
                          const res = await fetch(`/api/jobs/${job.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ is_vip: checked }),
                          });
                          if (!res.ok) throw new Error();
                          toast.success(checked ? 'Caller marked as priority' : 'Priority status removed');
                        } catch {
                          setJob((prev) => ({ ...prev, is_vip: !checked }));
                          toast.error('Could not update priority status — try again');
                        }
                      }}
                      aria-label="Toggle priority status"
                    />
                  </div>
                </>
              )}

              <Separator className="bg-muted" />

              {/* ── Pipeline actions ── */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Pipeline Status
                </h3>

                <Select
                  value={selectedStatus}
                  onValueChange={(val) => {
                    setSelectedStatus(val);
                    setRevenueError('');
                    if (!showsRevenueInput(val)) setRevenueAmount('');
                  }}
                >
                  <SelectTrigger className="w-full min-h-[44px] text-sm">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem
                        key={status}
                        value={status}
                        className={
                          status === job.status
                            ? 'border-l-2 border-[var(--brand-accent)] pl-2'
                            : ''
                        }
                      >
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {showsRevenueInput(selectedStatus) && (
                  <RevenueInput
                    value={revenueAmount}
                    onChange={setRevenueAmount}
                    required={selectedStatus === 'paid'}
                    error={revenueError}
                  />
                )}

                <Button
                  onClick={handleSave}
                  disabled={saving || (selectedStatus === job.status && !revenueAmount)}
                  className={`w-full min-h-[44px] font-semibold ${btn.primary}`}
                >
                  {saving ? 'Saving...' : 'Update Status'}
                </Button>
              </div>
            </div>

            {/* ── SheetFooter: Mark as Lost ── */}
            <SheetFooter className="px-6">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={markingLost || job.status === 'lost'}
                  >
                    {markingLost ? 'Moving to Lost...' : 'Mark as Lost'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark this job as Lost?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This job will be moved to Lost. You can still view the call history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleMarkLost}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Yes, Mark as Lost
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
