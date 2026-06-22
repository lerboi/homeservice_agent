'use client';

import Link from 'next/link';
import {
  Phone,
  PhoneIncoming,
  ArrowRight,
  CalendarCheck,
  FileText,
  StickyNote,
  UserPlus,
  GitMerge,
  Bell,
  Activity,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { focus } from '@/lib/design-tokens';
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';

// ─── Event type configuration ─────────────────────────────────────────────────
// Keys match the 16-value activity_event_type strict enum (migration 061).
// Labels mirror CustomerActivityTimeline.jsx so both surfaces speak the same
// language.

const TONES = {
  accent: { color: 'text-[var(--accent-violet)]', bg: 'bg-[var(--accent-violet)]/[0.08]' },
  blue: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40' },
  emerald: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  amber: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  red: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40' },
  muted: { color: 'text-muted-foreground', bg: 'bg-muted' },
};

const EVENT_CONFIG = {
  call_received: { Icon: Phone, tone: 'blue', label: 'Call received' },
  inquiry_opened: { Icon: PhoneIncoming, tone: 'accent', label: 'Inquiry opened' },
  inquiry_converted: { Icon: ArrowRight, tone: 'emerald', label: 'Inquiry converted to job' },
  inquiry_lost: { Icon: PhoneIncoming, tone: 'red', label: 'Inquiry marked as lost' },
  job_booked: { Icon: CalendarCheck, tone: 'emerald', label: 'Job booked' },
  job_completed: { Icon: CalendarCheck, tone: 'emerald', label: 'Job completed' },
  job_paid: { Icon: CalendarCheck, tone: 'emerald', label: 'Job paid' },
  job_cancelled: { Icon: CalendarCheck, tone: 'red', label: 'Job cancelled' },
  customer_created: { Icon: UserPlus, tone: 'accent', label: 'Customer created' },
  customer_updated: { Icon: StickyNote, tone: 'muted', label: 'Customer updated' },
  customer_merged: { Icon: GitMerge, tone: 'blue', label: 'Merged into another customer' },
  customer_unmerged: { Icon: GitMerge, tone: 'blue', label: 'Merge undone' },
  invoice_created: { Icon: FileText, tone: 'amber', label: 'Invoice created' },
  invoice_paid: { Icon: FileText, tone: 'emerald', label: 'Invoice paid' },
  invoice_voided: { Icon: FileText, tone: 'red', label: 'Invoice voided' },
  other: { Icon: Bell, tone: 'muted', label: 'Activity' },
};

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getConfig(eventType) {
  return (
    EVENT_CONFIG[eventType] ?? {
      Icon: Bell,
      tone: 'muted',
      label: capitalize(eventType?.replace(/_/g, ' ') ?? 'Activity'),
    }
  );
}

/**
 * Resolve where an activity row should navigate. Only links what's reliably
 * derivable: the event-type family maps to a tab surface; customer events
 * deep-link only when the row carries customer_id (nullable for system events).
 * Invoice events link only when the invoicing feature flag is on.
 */
function getHref(activity, invoicing) {
  const type = activity.event_type || '';
  if (type === 'call_received') return '/dashboard/calls';
  // Inquiries → Calls merge: inquiry events land on the Callbacks view.
  if (type.startsWith('inquiry_')) return '/dashboard/calls?view=callbacks';
  if (type.startsWith('job_')) return '/dashboard/jobs';
  if (type.startsWith('invoice_')) return invoicing ? '/dashboard/invoices' : null;
  if (type.startsWith('customer_')) {
    return activity.customer_id ? `/dashboard/customers/${activity.customer_id}` : null;
  }
  return null;
}

/** Caller/customer name from the metadata payload, when the writer recorded one. */
function getName(meta) {
  return meta?.caller_name || meta?.customer_name || meta?.name || null;
}

function formatRelative(iso) {
  if (!iso) return '';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Single activity item ─────────────────────────────────────────────────────

function ActivityItem({ activity, invoicing }) {
  const { Icon, tone, label } = getConfig(activity.event_type);
  const { color, bg } = TONES[tone] ?? TONES.muted;
  const meta = activity.metadata ?? {};
  const detail = [getName(meta), meta.job_type || meta.invoice_number]
    .filter(Boolean)
    .join(' · ');
  const href = getHref(activity, invoicing);

  const content = (
    <>
      {/* Icon bubble */}
      <div className={`flex-shrink-0 h-8 w-8 rounded-full ${bg} flex items-center justify-center`}>
        <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">
          {label}
          {detail && <span className="text-muted-foreground"> — {detail}</span>}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatRelative(activity.created_at)}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`flex min-h-[44px] items-start gap-3 -mx-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-muted/50 ${focus.ring}`}
      >
        {content}
      </Link>
    );
  }

  return <div className="flex items-start gap-3 py-1.5">{content}</div>;
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * RecentActivityFeed — chronological list of up to 20 recent events.
 *
 * @param {{ activities: Array | null, loading?: boolean }} props
 */
export default function RecentActivityFeed({ activities, loading }) {
  const { invoicing } = useFeatureFlags();

  if (loading) {
    return <ActivitySkeleton />;
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="h-10 w-10 text-muted-foreground/30 mb-4" aria-hidden="true" />
        <h3 className="text-base font-semibold text-foreground mb-2">No recent activity</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your AI&apos;s actions — calls, inquiries, bookings, and invoices — appear here as calls come in.
        </p>
      </div>
    );
  }

  // Cap at 20 items
  const items = activities.slice(0, 20);

  return (
    <div className="space-y-2" role="list" aria-label="Recent activity">
      {items.map((activity) => (
        <div key={activity.id} role="listitem">
          <ActivityItem activity={activity} invoicing={invoicing} />
        </div>
      ))}
    </div>
  );
}
