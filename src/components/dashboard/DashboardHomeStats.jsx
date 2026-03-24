'use client';

import { useEffect, useRef } from 'react';
import { UserPlus, CalendarCheck, Phone, TrendingUp } from 'lucide-react';

// ─── Stat widget with animated counter ───────────────────────────────────────

function StatWidget({ label, value, Icon, formatter, index }) {
  const numRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const el = numRef.current;
    if (!el) return;

    const target = typeof value === 'number' ? value : 0;

    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      el.textContent = formatter ? formatter(target) : String(target);
      return;
    }

    // Delay start slightly per widget index for stagger feel
    const delay = index * 80;
    const duration = 600;
    let startTime = null;

    function tick(timestamp) {
      if (!startTime) startTime = timestamp - delay;
      const elapsed = Math.max(0, timestamp - startTime - delay);
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;

      el.textContent = formatter ? formatter(current) : String(Math.round(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        el.textContent = formatter ? formatter(target) : String(target);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, formatter, index]);

  return (
    <div className="bg-white rounded-xl border border-stone-200/60 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-5 relative">
      {/* Icon — top right */}
      <div className="absolute top-4 right-4">
        <Icon className="h-4 w-4 text-stone-300" aria-hidden="true" />
      </div>

      {/* Animated number */}
      <p
        ref={numRef}
        className="text-[28px] font-semibold leading-[1.15] text-[#0F172A] tabular-nums"
        aria-live="polite"
      >
        {formatter ? formatter(typeof value === 'number' ? value : 0) : (typeof value === 'number' ? value : 0)}
      </p>

      {/* Label */}
      <p className="text-xs font-semibold uppercase tracking-wider text-[#475569] mt-1.5">
        {label}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * DashboardHomeStats — 4 animated stat widgets for the dashboard home page.
 *
 * @param {{ stats: { newLeadsToday: number, upcomingAppointments: number, callsToday: number, conversionRate: number } }} props
 */
export default function DashboardHomeStats({ stats }) {
  const {
    newLeadsToday = 0,
    upcomingAppointments = 0,
    callsToday = 0,
    conversionRate = 0,
  } = stats ?? {};

  const widgets = [
    {
      label: 'New Leads Today',
      value: newLeadsToday,
      Icon: UserPlus,
      formatter: (v) => String(Math.round(v)),
    },
    {
      label: 'Upcoming Appointments',
      value: upcomingAppointments,
      Icon: CalendarCheck,
      formatter: (v) => String(Math.round(v)),
    },
    {
      label: 'Calls Today',
      value: callsToday,
      Icon: Phone,
      formatter: (v) => String(Math.round(v)),
    },
    {
      label: 'Conversion Rate',
      value: conversionRate,
      Icon: TrendingUp,
      formatter: (v) => `${v.toFixed(1)}%`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {widgets.map((widget, i) => (
        <StatWidget
          key={widget.label}
          label={widget.label}
          value={widget.value}
          Icon={widget.Icon}
          formatter={widget.formatter}
          index={i}
        />
      ))}
    </div>
  );
}
