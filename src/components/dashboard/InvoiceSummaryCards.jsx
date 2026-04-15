'use client';

import { DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function formatCurrency(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const CARDS = [
  {
    key: 'total_outstanding',
    label: 'Total Outstanding',
    icon: DollarSign,
    color: 'text-[var(--brand-accent)]',
  },
  {
    key: 'overdue_amount',
    label: 'Overdue Amount',
    icon: AlertCircle,
    color: 'text-red-600',
  },
  {
    key: 'paid_this_month',
    label: 'Paid This Month',
    icon: CheckCircle2,
    color: 'text-emerald-600',
  },
];

export default function InvoiceSummaryCards({ summary = {}, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {CARDS.map(({ key, label, icon: Icon, color }) => (
        <div
          key={key}
          className="bg-card rounded-lg border border-border p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 ${color}`} />
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
          </div>
          <p className={`text-[28px] font-semibold leading-tight ${color}`}>
            {formatCurrency(summary[key])}
          </p>
        </div>
      ))}
    </div>
  );
}
