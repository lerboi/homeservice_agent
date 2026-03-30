'use client';

import { useState, useEffect, useCallback } from 'react';
import { Phone, MapPin, Calendar, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY_STYLES = {
  emergency: { badge: 'bg-red-100 text-red-700', label: 'Emergency' },
  routine: { badge: 'bg-[#0F172A]/[0.06] text-[#0F172A]/70', label: 'Routine' },
  high_ticket: { badge: 'bg-amber-100 text-amber-700', label: 'High Ticket' },
};

const STATUS_LABELS = {
  new: 'New',
  booked: 'Booked',
  completed: 'Completed',
  paid: 'Paid',
  lost: 'Lost',
};

const STATUS_OPTIONS = ['new', 'booked', 'completed', 'paid', 'lost'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function showsRevenueInput(status) {
  return status === 'completed' || status === 'paid';
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LeadFlyoutSkeleton() {
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
 * LeadFlyout — right Sheet panel with full lead detail.
 * Fetches from /api/leads/[id] on open. Handles status change + revenue input.
 *
 * @param {{ leadId: string | null, open: boolean, onOpenChange: Function, onStatusChange: Function }} props
 */
export default function LeadFlyout({ leadId, open, onOpenChange, onStatusChange }) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Status change state
  const [selectedStatus, setSelectedStatus] = useState('');
  const [revenueAmount, setRevenueAmount] = useState('');
  const [revenueError, setRevenueError] = useState('');
  const [saving, setSaving] = useState(false);
  const [markingLost, setMarkingLost] = useState(false);

  // Fetch lead detail when flyout opens
  const fetchLead = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) throw new Error('Failed to fetch lead');
      const data = await res.json();
      setLead(data.lead);
      setSelectedStatus(data.lead.status);
      // Pre-fill revenue if already set
      setRevenueAmount(data.lead.revenue_amount ? String(data.lead.revenue_amount) : '');
      setRevenueError('');
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (open && leadId) {
      fetchLead();
    } else if (!open) {
      // Reset on close
      setLead(null);
      setLoading(false);
      setFetchError(false);
      setSelectedStatus('');
      setRevenueAmount('');
      setRevenueError('');
    }
  }, [open, leadId, fetchLead]);

  // First call associated with this lead (for recording/transcript)
  const firstCall = lead?.lead_calls?.[0]?.calls ?? null;
  const urgencyStyle = URGENCY_STYLES[lead?.urgency] || URGENCY_STYLES.routine;

  // Resolve recording URL — prefer Supabase Storage (new calls), fall back to recording_url (historical)
  const [recordingSrc, setRecordingSrc] = useState(null);
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

  // ─── Save status change ──────────────────────────────────────────────────

  async function handleSave() {
    if (!lead) return;

    // Validate paid requires revenue
    if (selectedStatus === 'paid' && !revenueAmount) {
      setRevenueError('Enter a revenue amount to save this as Paid.');
      return;
    }

    setRevenueError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedStatus,
          previous_status: lead.status,
          revenue_amount: revenueAmount ? parseFloat(revenueAmount) : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Update failed');
      }

      const updatedData = await res.json();
      setLead(updatedData.lead);

      // Toast notifications per UI-SPEC
      if (selectedStatus === 'lost') {
        toast.success('Lead marked as Lost');
      } else if (revenueAmount && (selectedStatus === 'paid' || selectedStatus === 'completed')) {
        toast.success(`$${parseFloat(revenueAmount).toFixed(2)} recorded for ${lead.caller_name || 'lead'}`);
      } else {
        toast.success(`${lead.caller_name || 'Lead'} moved to ${STATUS_LABELS[selectedStatus]}`);
      }

      onStatusChange?.(updatedData.lead);
    } catch (err) {
      toast.error('Status update failed. Try again — your changes weren\'t saved.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Mark as Lost ────────────────────────────────────────────────────────

  async function handleMarkLost() {
    if (!lead) return;
    setMarkingLost(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'lost',
          previous_status: lead.status,
        }),
      });
      if (!res.ok) throw new Error('Failed to mark as lost');
      const updatedData = await res.json();
      toast.success('Lead marked as Lost');
      onStatusChange?.(updatedData.lead);
      onOpenChange(false);
    } catch {
      toast.error('Status update failed. Try again — your changes weren\'t saved.');
    } finally {
      setMarkingLost(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">

        {/* Loading state */}
        {loading && (
          <>
            <SheetHeader className="pb-0">
              <SheetTitle className="sr-only">Loading lead details</SheetTitle>
            </SheetHeader>
            <LeadFlyoutSkeleton />
          </>
        )}

        {/* Error state */}
        {!loading && fetchError && (
          <>
            <SheetHeader>
              <SheetTitle className="text-xl text-[#0F172A]">Lead Details</SheetTitle>
            </SheetHeader>
            <div className="px-6 flex flex-col items-center gap-4 py-8">
              <p className="text-sm text-stone-500 text-center">
                Couldn&apos;t load lead details.
              </p>
              <Button variant="outline" size="sm" onClick={fetchLead}>
                Retry
              </Button>
            </div>
          </>
        )}

        {/* Lead detail */}
        {!loading && !fetchError && lead && (
          <>
            {/* ── SheetHeader: Urgency badge + status select + lead age ── */}
            <SheetHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs font-semibold ${urgencyStyle.badge}`}>
                    {urgencyStyle.label}
                  </Badge>
                  <span className="text-xs text-stone-400">
                    {formatRelativeTime(lead.created_at)}
                  </span>
                </div>
              </div>
              <SheetTitle className="text-xl font-semibold text-[#0F172A] leading-snug mt-1">
                {lead.caller_name || 'Unknown Caller'}
              </SheetTitle>
            </SheetHeader>

            <div className="px-6 space-y-6 pb-4">

              {/* ── Caller section ── */}
              <div className="space-y-2">
                {lead.from_number && (
                  <div className="flex items-center gap-2 text-sm text-[#0F172A]/80">
                    <Phone className="h-4 w-4 text-stone-400 flex-shrink-0" />
                    <a
                      href={`tel:${lead.from_number}`}
                      className="text-[#C2410C] hover:text-[#9A3412] transition-colors"
                    >
                      {lead.from_number}
                    </a>
                  </div>
                )}
                {firstCall?.start_timestamp && (
                  <div className="flex items-center gap-2 text-sm text-stone-500">
                    <Calendar className="h-4 w-4 text-stone-400 flex-shrink-0" />
                    <span>{formatDateTime(firstCall.start_timestamp)}</span>
                  </div>
                )}
              </div>

              <Separator className="bg-stone-100" />

              {/* ── Job section ── */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-[#475569] uppercase tracking-wider">
                  Job Details
                </h3>
                {lead.job_type && (
                  <div className="flex items-center gap-2 text-sm text-[#0F172A]/80">
                    <Briefcase className="h-4 w-4 text-stone-400 flex-shrink-0" />
                    <span className="capitalize">{lead.job_type}</span>
                  </div>
                )}
                {(lead.street_name || lead.postal_code || lead.service_address) && (
                  <div className="flex items-start gap-2 text-sm text-[#0F172A]/80">
                    <MapPin className="h-4 w-4 text-stone-400 flex-shrink-0 mt-0.5" />
                    <span>{lead.street_name && lead.postal_code
                      ? `${lead.street_name}, ${lead.postal_code}`
                      : lead.service_address}</span>
                  </div>
                )}
                {firstCall && (
                  <div className="flex items-center gap-2 text-xs text-stone-400">
                    <span>
                      Triage: {firstCall.urgency_classification}
                      {firstCall.urgency_confidence != null && (
                        <span className="ml-1">
                          ({Math.round(firstCall.urgency_confidence * 100)}% confidence)
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              <Separator className="bg-stone-100" />

              {/* ── Audio player ── */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-[#475569] uppercase tracking-wider">
                  Call Recording
                </h3>
                <AudioPlayer src={recordingSrc} />
              </div>

              {/* ── Transcript ── */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-[#475569] uppercase tracking-wider">
                  Transcript
                </h3>
                <TranscriptViewer
                  transcriptStructured={firstCall?.transcript_structured ?? null}
                  transcriptText={firstCall?.transcript_text ?? null}
                />
              </div>

              <Separator className="bg-stone-100" />

              {/* ── Pipeline actions: status select + revenue input ── */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[#475569] uppercase tracking-wider">
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
                          status === lead.status
                            ? 'border-l-2 border-[#C2410C] pl-2'
                            : ''
                        }
                      >
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Revenue input — visible for completed or paid */}
                {showsRevenueInput(selectedStatus) && (
                  <RevenueInput
                    value={revenueAmount}
                    onChange={setRevenueAmount}
                    required={selectedStatus === 'paid'}
                    error={revenueError}
                  />
                )}

                {/* Save button */}
                <Button
                  onClick={handleSave}
                  disabled={saving || (selectedStatus === lead.status && !revenueAmount)}
                  className="w-full min-h-[44px] bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] text-white font-semibold shadow-sm transition-all duration-150"
                >
                  {saving ? 'Saving...' : 'Update Status'}
                </Button>
              </div>
            </div>

            {/* ── SheetFooter: Mark as Lost (destructive) ── */}
            <SheetFooter className="px-6">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={markingLost || lead.status === 'lost'}
                  >
                    {markingLost ? 'Moving to Lost...' : 'Mark as Lost'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark this lead as Lost?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This lead will be moved to Lost. You can still view the call history.
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
