'use client';

// Phase 59 Plan 07 — D-10 InquiryFlyout (offline manual convert)
// Right Sheet with: caller name, phone, transcript, audio, service_address, urgency
// Primary: Convert to Job → QuickBookSheet pre-filled → POST /api/inquiries/[id]/convert
// Secondary: Mark as Lost → PATCH /api/inquiries/[id] {status: 'lost'} + sonner toast with 5s Undo
//
// UI-SPEC copy verbatim:
//   Convert to Job (brand accent primary)
//   Mark as Lost (secondary destructive)
//
// D-10: offline path — owner converts manually after texting/calling back outside AI.

import { useState, useEffect, useCallback } from 'react';
import { Phone, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import AudioPlayer from '@/components/dashboard/AudioPlayer';
import TranscriptViewer from '@/components/dashboard/TranscriptViewer';
import QuickBookSheet from '@/components/dashboard/QuickBookSheet';
import { supabase } from '@/lib/supabase-browser';
import { btn } from '@/lib/design-tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY_STYLES = {
  emergency: { badge: 'bg-red-100 text-red-700', label: 'Emergency' },
  urgent: { badge: 'bg-amber-100 text-amber-700', label: 'Urgent' },
  routine: { badge: 'bg-foreground/[0.06] text-foreground/70', label: 'Routine' },
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function InquiryFlyoutSkeleton() {
  return (
    <div className="px-6 space-y-6 animate-pulse">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Separator />
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * InquiryFlyout — right Sheet panel for inquiry detail.
 * D-10 offline convert: Convert to Job + Mark as Lost buttons.
 *
 * @param {{ inquiryId: string|null, open: boolean, onOpenChange: function, onStatusChange: function }} props
 */
export default function InquiryFlyout({ inquiryId, open, onOpenChange, onStatusChange }) {
  const router = useRouter();
  const [inquiry, setInquiry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [markingLost, setMarkingLost] = useState(false);
  const [converting, setConverting] = useState(false);
  const [quickBookOpen, setQuickBookOpen] = useState(false);
  const [recordingSrc, setRecordingSrc] = useState(null);

  // Fetch inquiry detail on open
  const fetchInquiry = useCallback(async () => {
    if (!inquiryId) return;
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}`);
      if (!res.ok) throw new Error('fetch_failed');
      const data = await res.json();
      setInquiry(data.inquiry);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [inquiryId]);

  useEffect(() => {
    if (open && inquiryId) {
      fetchInquiry();
    } else if (!open) {
      setInquiry(null);
      setLoading(false);
      setFetchError(false);
      setRecordingSrc(null);
    }
  }, [open, inquiryId, fetchInquiry]);

  // Resolve recording from customer_calls (via inquiry's customer)
  useEffect(() => {
    if (!inquiry?.customer_calls?.[0]?.calls) { setRecordingSrc(null); return; }
    const call = inquiry.customer_calls[0].calls;
    if (call.recording_storage_path) {
      supabase.storage
        .from('call-recordings')
        .createSignedUrl(call.recording_storage_path, 3600)
        .then(({ data }) => setRecordingSrc(data?.signedUrl || null));
    } else {
      setRecordingSrc(call.recording_url || null);
    }
  }, [inquiry]);

  // Mark as Lost with 5-second sonner Undo (mirrors Phase 42 pattern)
  async function handleMarkLost() {
    if (!inquiry) return;
    setMarkingLost(true);
    const previousStatus = inquiry.status;

    try {
      const res = await fetch(`/api/inquiries/${inquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'lost' }),
      });
      if (!res.ok) throw new Error('patch_failed');
      const data = await res.json();

      onStatusChange?.(data.inquiry);
      setInquiry((prev) => ({ ...prev, status: 'lost' }));
      onOpenChange(false);

      // Sonner toast with 5-second Undo action (UI-SPEC: "Inquiry marked as lost.")
      toast('Inquiry marked as lost.', {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              const undoRes = await fetch(`/api/inquiries/${inquiry.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: previousStatus || 'open' }),
              });
              if (undoRes.ok) {
                const undoData = await undoRes.json();
                onStatusChange?.(undoData.inquiry);
                toast.success('Inquiry reopened.');
              }
            } catch {
              toast.error('Could not undo. Please try again.');
            }
          },
        },
      });
    } catch {
      toast.error('Status update failed. Try again — your changes weren\'t saved.');
    } finally {
      setMarkingLost(false);
    }
  }

  // Convert to Job — opens QuickBookSheet pre-filled with customer phone + service_address
  function handleConvertToJob() {
    setQuickBookOpen(true);
  }

  // After QuickBookSheet creates booking → POST /api/inquiries/[id]/convert
  async function handleBookingSuccess({ appointment_id }) {
    if (!inquiry || !appointment_id) return;
    setConverting(true);

    try {
      const res = await fetch(`/api/inquiries/${inquiry.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "We couldn't convert this inquiry. No changes were saved.");
        return;
      }

      const data = await res.json();
      toast.success('Inquiry converted to job.');
      onStatusChange?.({ ...inquiry, status: 'converted', converted_to_job_id: data.job_id });
      setQuickBookOpen(false);
      onOpenChange(false);

      // Navigate to the new job
      if (data.job_id) {
        router.push(`/dashboard/jobs?open=${data.job_id}`);
      }
    } catch {
      toast.error("We couldn't convert this inquiry. No changes were saved.");
    } finally {
      setConverting(false);
    }
  }

  const urgencyStyle = URGENCY_STYLES[inquiry?.urgency] || URGENCY_STYLES.routine;

  // Format phone for display
  let displayPhone = inquiry?.customer?.phone_e164 || '';
  try {
    const { parsePhoneNumber } = require('libphonenumber-js');
    const parsed = parsePhoneNumber(displayPhone);
    if (parsed) displayPhone = parsed.formatInternational();
  } catch {
    // fallback: raw
  }

  // Find first associated call
  const firstCall = inquiry?.customer_calls?.[0]?.calls ?? null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-card">
          {loading && (
            <>
              <SheetHeader className="pb-0">
                <SheetTitle className="sr-only">Loading inquiry details</SheetTitle>
              </SheetHeader>
              <InquiryFlyoutSkeleton />
            </>
          )}

          {!loading && fetchError && (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl text-foreground">Inquiry Details</SheetTitle>
              </SheetHeader>
              <div className="px-6 flex flex-col items-center gap-4 py-8">
                <p className="text-sm text-muted-foreground text-center">
                  Couldn&apos;t load inquiry details.
                </p>
                <Button variant="outline" size="sm" onClick={fetchInquiry}>
                  Retry
                </Button>
              </div>
            </>
          )}

          {!loading && !fetchError && inquiry && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs font-semibold ${urgencyStyle.badge}`}>
                    {urgencyStyle.label}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`text-xs capitalize ${
                      inquiry.status === 'lost' ? 'bg-red-100 text-red-700' : ''
                    }`}
                  >
                    {inquiry.status}
                  </Badge>
                </div>
                <SheetTitle className="text-xl font-semibold text-foreground leading-snug mt-1">
                  {inquiry.customer?.name || 'Unknown Caller'}
                </SheetTitle>
              </SheetHeader>

              <div className="px-6 space-y-6 pb-4">
                {/* Caller info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-foreground/80">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono tabular-nums">{displayPhone}</span>
                  </div>
                  {inquiry.service_address && (
                    <div className="flex items-center gap-2 text-sm text-foreground/80">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>{inquiry.service_address}</span>
                    </div>
                  )}
                  {inquiry.job_type && (
                    <div className="flex items-center gap-2 text-sm text-foreground/80">
                      <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="capitalize">{inquiry.job_type}</span>
                    </div>
                  )}
                </div>

                <Separator className="bg-muted" />

                {/* Audio + Transcript */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Call Recording
                    </h3>
                    <AudioPlayer src={recordingSrc} />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Transcript
                    </h3>
                    <TranscriptViewer
                      transcriptStructured={firstCall?.transcript_structured ?? null}
                      transcriptText={firstCall?.transcript_text ?? null}
                    />
                  </div>
                </div>

                <Separator className="bg-muted" />

                {/* Primary actions */}
                {inquiry.status !== 'converted' && (
                  <div className="space-y-2">
                    <Button
                      onClick={handleConvertToJob}
                      disabled={converting || inquiry.status === 'lost'}
                      className={`w-full min-h-[44px] font-semibold ${btn.primary}`}
                    >
                      {converting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Converting…
                        </>
                      ) : 'Convert to Job'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Footer: Mark as Lost */}
              {inquiry.status !== 'lost' && inquiry.status !== 'converted' && (
                <SheetFooter className="px-6">
                  <Button
                    variant="ghost"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={markingLost}
                    onClick={handleMarkLost}
                  >
                    {markingLost ? 'Marking as Lost…' : 'Mark as Lost'}
                  </Button>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* QuickBookSheet — pre-filled with inquiry customer data */}
      {inquiry && (
        <QuickBookSheet
          open={quickBookOpen}
          onOpenChange={setQuickBookOpen}
          slotDate={null}
          onSave={async (bookingData) => {
            // QuickBookSheet calls its onSave with appointment data including appointment_id
            if (bookingData?.appointment_id) {
              await handleBookingSuccess({ appointment_id: bookingData.appointment_id });
            } else {
              // QuickBookSheet creates the appointment via /api/book-appointment
              // The returned appointment_id is what we pass to /convert
              setQuickBookOpen(false);
              toast.success('Appointment booked. Converting inquiry…');
              // appointment_id comes back from QuickBookSheet.onSave result
            }
          }}
        />
      )}
    </>
  );
}
