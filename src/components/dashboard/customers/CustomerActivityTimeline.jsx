'use client';

// Phase 59 Plan 07 — D-17 Customer Activity Timeline
// Activity data fetched inline from /api/customers/[id] response (approach A: ≤50 rows).
// Day separator when date changes; icon per event type.
// Empty state: "No activity yet" per UI-SPEC.

import { Phone, Calendar, FileText, StickyNote, PhoneIncoming, Clock, GitMerge } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Event type icons ─────────────────────────────────────────────────────────

const EVENT_ICONS = {
  call_received: Phone,
  inquiry_opened: PhoneIncoming,
  inquiry_converted: PhoneIncoming,
  inquiry_lost: PhoneIncoming,
  job_booked: Calendar,
  job_completed: Calendar,
  job_paid: Calendar,
  job_cancelled: Calendar,
  customer_created: Clock,
  customer_updated: StickyNote,
  customer_merged: GitMerge,
  customer_unmerged: GitMerge,
  invoice_created: FileText,
  invoice_paid: FileText,
  invoice_voided: FileText,
  other: Clock,
};

const EVENT_LABELS = {
  call_received: 'Call received',
  inquiry_opened: 'Inquiry opened',
  inquiry_converted: 'Inquiry converted to job',
  inquiry_lost: 'Inquiry marked as lost',
  job_booked: 'Job booked',
  job_completed: 'Job completed',
  job_paid: 'Job paid',
  job_cancelled: 'Job cancelled',
  customer_created: 'Customer created',
  customer_updated: 'Customer updated',
  customer_merged: 'Merged into another customer',
  customer_unmerged: 'Merge undone',
  invoice_created: 'Invoice created',
  invoice_paid: 'Invoice paid',
  invoice_voided: 'Invoice voided',
  other: 'Event',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
}

function formatEventDate(iso) {
  // Returns "today", "yesterday", or full date string for day separators
  if (!iso) return '';
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDate(iso);
}

function getEventDayKey(iso) {
  if (!iso) return '';
  return new Date(iso).toDateString();
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

export function CustomerActivityTimelineSkeleton() {
  return (
    <div className="space-y-4 px-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * CustomerActivityTimeline — renders chronological activity events for a customer.
 * Receives activity rows from the parent page (passed via /api/customers/[id] response).
 * Activity approach A: ≤50 most-recent events returned inline in customer detail.
 *
 * @param {{ activity: Array|null, loading: boolean }} props
 */
export default function CustomerActivityTimeline({ activity, loading }) {
  if (loading) {
    return <CustomerActivityTimelineSkeleton />;
  }

  if (!activity || activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="rounded-full bg-muted p-3">
          <Clock className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">No activity yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Calls, bookings, and notes for this customer will appear here.
          </p>
        </div>
      </div>
    );
  }

  // Group by day for day separators
  const rows = [];
  let lastDayKey = null;

  for (const event of activity) {
    const dayKey = getEventDayKey(event.created_at);
    if (dayKey !== lastDayKey) {
      rows.push({ type: 'separator', label: formatEventDate(event.created_at), key: `sep-${dayKey}` });
      lastDayKey = dayKey;
    }
    rows.push({ type: 'event', event, key: event.id });
  }

  return (
    <div className="space-y-1">
      {rows.map((row) => {
        if (row.type === 'separator') {
          return (
            <div key={row.key} className="flex items-center gap-3 py-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs font-medium text-muted-foreground">{row.label}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          );
        }

        const { event } = row;
        const IconComponent = EVENT_ICONS[event.event_type] || Clock;
        const label = EVENT_LABELS[event.event_type] || 'Event';

        return (
          <div
            key={row.key}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex-shrink-0 rounded-full bg-muted p-1.5 mt-0.5">
              <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                {label}
                {event.metadata?.job_type && (
                  <span className="text-muted-foreground ml-1">— {event.metadata.job_type}</span>
                )}
                {event.metadata?.invoice_number && (
                  <span className="text-muted-foreground ml-1">— {event.metadata.invoice_number}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatTime(event.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
