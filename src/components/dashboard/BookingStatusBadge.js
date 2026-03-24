import { Badge } from '@/components/ui/badge';

const VARIANTS = {
  confirmed: {
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    label: 'Booked',
  },
  lead_with_slots: {
    className: 'border-[#0F172A]/10 bg-[#0F172A]/[0.04] text-[#0F172A]/70',
    label: 'Lead - slots suggested',
  },
  no_booking: {
    className: 'border-stone-200 bg-[#F5F5F4] text-[#475569]',
    label: 'No booking',
  },
  failed: {
    className: 'border-red-200 bg-red-50 text-red-600',
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
