'use client';

import { ClipboardList, DollarSign, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function formatCurrency(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const CARDS = [
  {
    key: 'pending_count',
    label: 'Pending Estimates',
    icon: ClipboardList,
    color: 'text-[#C2410C]',
    format: (v) => String(v || 0),
  },
  {
    key: 'approved_value',
    label: 'Approved Value',
    icon: DollarSign,
    color: 'text-emerald-600',
    format: (v) => formatCurrency(v),
  },
  {
    key: 'conversion_rate',
    label: 'Conversion Rate',
    icon: TrendingUp,
    color: 'text-blue-600',
    format: (v) => `${Number(v || 0).toFixed(0)}%`,
  },
];

export default function EstimateSummaryCards({ summary }) {
  if (!summary) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {CARDS.map(({ key, label, icon: Icon, color, format }) => (
        <div
          key={key}
          className="bg-white rounded-lg border border-stone-200 p-6"
        >
          <Icon className={`w-5 h-5 ${color} mb-2`} />
          <p className={`text-[28px] font-semibold leading-tight text-stone-900`}>
            {format(summary[key])}
          </p>
          <p className="text-sm text-stone-500 mt-1">{label}</p>
        </div>
      ))}
    </div>
  );
}
