'use client';

import { UserPlus, ArrowRight, Bell, CalendarCheck, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

// ─── Event type configuration ─────────────────────────────────────────────────

const EVENT_CONFIG = {
  lead_created: {
    Icon: UserPlus,
    color: 'text-[#C2410C]',
    bg: 'bg-[#C2410C]/[0.08]',
    describe: (meta) => `New lead from ${meta?.caller_name || 'unknown caller'}`,
  },
  status_changed: {
    Icon: ArrowRight,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    describe: (meta) =>
      meta?.caller_name && meta?.new_status
        ? `${meta.caller_name} moved to ${capitalize(meta.new_status)}`
        : 'Lead status changed',
  },
  notification_sent: {
    Icon: Bell,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    describe: (meta) =>
      meta?.to_number
        ? `SMS sent to ${meta.to_number}`
        : 'Notification sent',
  },
  booking_created: {
    Icon: CalendarCheck,
    color: 'text-[#166534]',
    bg: 'bg-green-50',
    describe: (meta) =>
      meta?.caller_name
        ? `Booking confirmed for ${meta.caller_name}`
        : 'Booking confirmed',
  },
};

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getConfig(eventType) {
  return EVENT_CONFIG[eventType] ?? {
    Icon: Bell,
    color: 'text-stone-400',
    bg: 'bg-stone-100',
    describe: () => capitalize(eventType?.replace(/_/g, ' ') ?? 'Activity'),
  };
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

function ActivityItem({ activity }) {
  const config = getConfig(activity.event_type);
  const { Icon, color, bg } = config;
  const description = config.describe(activity.metadata ?? {});

  return (
    <div className="flex items-start gap-3">
      {/* Icon bubble */}
      <div className={`flex-shrink-0 h-8 w-8 rounded-full ${bg} flex items-center justify-center`}>
        <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#0F172A] leading-snug">{description}</p>
        <p className="text-xs text-[#475569] mt-0.5">{formatRelative(activity.created_at)}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * RecentActivityFeed — chronological list of up to 20 recent events.
 *
 * @param {{ activities: Array | null, loading?: boolean }} props
 */
export default function RecentActivityFeed({ activities, loading }) {
  if (loading) {
    return <ActivitySkeleton />;
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="h-10 w-10 text-stone-300 mb-4" aria-hidden="true" />
        <h3 className="text-base font-semibold text-[#0F172A] mb-2">No recent activity</h3>
        <p className="text-sm text-[#475569] max-w-sm">
          Your AI&apos;s actions — new leads, bookings, and notifications — appear here as calls come in.
        </p>
      </div>
    );
  }

  // Cap at 20 items
  const items = activities.slice(0, 20);

  return (
    <div className="space-y-4" role="list" aria-label="Recent activity">
      {items.map((activity) => (
        <div key={activity.id} role="listitem">
          <ActivityItem activity={activity} />
        </div>
      ))}
    </div>
  );
}
