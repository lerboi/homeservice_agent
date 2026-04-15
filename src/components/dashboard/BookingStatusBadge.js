import { Badge } from '@/components/ui/badge';

const VARIANTS = {
  confirmed: {
    className: 'border-green-200 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/60',
    label: 'Booked',
  },
  lead_with_slots: {
    className: 'border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
    label: 'Lead - slots suggested',
  },
  no_booking: {
    className: 'border-stone-200 bg-stone-100 text-stone-700 dark:bg-muted dark:text-muted-foreground dark:border-border',
    label: 'No booking',
  },
  failed: {
    className: 'border-red-200 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60',
    label: 'Booking failed',
  },
};

export default function BookingStatusBadge({ status }) {
  const variant = VARIANTS[status] || VARIANTS.no_booking;

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}
