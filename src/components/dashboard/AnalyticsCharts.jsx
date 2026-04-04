'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Constants ────────────────────────────────────────────────────────────────

// Pipeline status colors per UI-SPEC
const STATUS_COLORS = {
  new: '#C2410C',
  booked: '#1d4ed8',
  completed: '#57534e',
  paid: '#166534',
  lost: '#DC2626',
};

const STATUS_LABELS = {
  new: 'New',
  booked: 'Booked',
  completed: 'Completed',
  paid: 'Paid',
  lost: 'Lost',
};

// ─── Data derivation helpers ──────────────────────────────────────────────────

function getMonthKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key) {
  const [year, month] = key.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

function buildRevenueData(leads) {
  // Group revenue by month
  const monthMap = {};
  for (const lead of leads) {
    if (!lead.created_at) continue;
    const amount = parseFloat(lead.revenue_amount ?? 0) || 0;
    const key = getMonthKey(lead.created_at);
    monthMap[key] = (monthMap[key] ?? 0) + amount;
  }

  // Sort months and build cumulative series
  const sortedKeys = Object.keys(monthMap).sort();
  let cumulative = 0;
  return sortedKeys.map((key) => {
    cumulative += monthMap[key];
    return { month: getMonthLabel(key), revenue: Math.round(cumulative) };
  });
}

function buildFunnelData(leads) {
  const statuses = ['new', 'booked', 'completed', 'paid'];
  return statuses.map((status) => ({
    status: STATUS_LABELS[status],
    count: leads.filter((l) => l.status === status).length,
    color: STATUS_COLORS[status],
  }));
}

function buildPipelineData(leads) {
  const statuses = ['new', 'booked', 'completed', 'paid', 'lost'];
  return statuses.map((status) => ({
    name: STATUS_LABELS[status],
    value: leads.filter((l) => l.status === status).length,
    color: STATUS_COLORS[status],
  })).filter((d) => d.value > 0);
}

// ─── Call data helpers ───────────────────────────────────────────────────────

const URGENCY_COLORS = {
  routine: '#57534e',
  emergency: '#DC2626',
  urgent: '#C2410C',
  unknown: '#94a3b8',
};

const BOOKING_COLORS = {
  booked: '#166534',
  declined: '#DC2626',
  not_attempted: '#57534e',
  failed: '#94a3b8',
};

function buildCallVolumeData(calls) {
  const dayMap = {};
  for (const call of calls) {
    if (!call.created_at) continue;
    const day = call.created_at.slice(0, 10);
    dayMap[day] = (dayMap[day] ?? 0) + 1;
  }
  const sortedDays = Object.keys(dayMap).sort();
  // Show last 30 days max
  const recent = sortedDays.slice(-30);
  return recent.map((day) => ({
    date: new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    calls: dayMap[day],
  }));
}

function buildUrgencyData(calls) {
  const counts = {};
  for (const call of calls) {
    const u = call.urgency_classification || 'unknown';
    counts[u] = (counts[u] ?? 0) + 1;
  }
  return Object.entries(counts).map(([key, value]) => ({
    name: key === 'urgent' ? 'Urgent' : key.charAt(0).toUpperCase() + key.slice(1),
    value,
    color: URGENCY_COLORS[key] || '#94a3b8',
  })).filter((d) => d.value > 0);
}

function buildBookingOutcomeData(calls) {
  const counts = {};
  for (const call of calls) {
    const o = call.booking_outcome || 'not_attempted';
    counts[o] = (counts[o] ?? 0) + 1;
  }
  return Object.entries(counts).map(([key, value]) => ({
    name: key === 'not_attempted' ? 'Not Attempted' : key.charAt(0).toUpperCase() + key.slice(1),
    value,
    color: BOOKING_COLORS[key] || '#94a3b8',
  })).filter((d) => d.value > 0);
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm px-3 py-2">
      <p className="text-xs text-[#475569] mb-1">{label}</p>
      <p className="text-sm font-semibold text-[#0F172A]">
        ${payload[0]?.value?.toLocaleString()}
      </p>
    </div>
  );
}

function CountTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm px-3 py-2">
      <p className="text-xs text-[#475569] mb-1">{label}</p>
      <p className="text-sm font-semibold text-[#0F172A]">
        {payload[0]?.value} leads
      </p>
    </div>
  );
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200/60 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-5">
      <h3 className="text-xl font-semibold text-[#0F172A] mb-5">{title}</h3>
      {children}
    </div>
  );
}

// ─── Skeleton state ───────────────────────────────────────────────────────────

function ChartsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[300px] w-full rounded-xl" />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * AnalyticsCharts — call volume, urgency, booking outcomes, revenue, conversion funnel, pipeline.
 *
 * @param {{ leads: Array | null, calls: Array | null, loading?: boolean }} props
 */
export default function AnalyticsCharts({ leads, calls, loading }) {
  const allLeads = leads ?? [];
  const allCalls = calls ?? [];

  const revenueData = useMemo(() => buildRevenueData(allLeads), [allLeads]);
  const funnelData = useMemo(() => buildFunnelData(allLeads), [allLeads]);
  const pipelineData = useMemo(() => buildPipelineData(allLeads), [allLeads]);
  const callVolumeData = useMemo(() => buildCallVolumeData(allCalls), [allCalls]);
  const urgencyData = useMemo(() => buildUrgencyData(allCalls), [allCalls]);
  const bookingOutcomeData = useMemo(() => buildBookingOutcomeData(allCalls), [allCalls]);

  if (loading) {
    return <ChartsSkeleton />;
  }

  if (allLeads.length === 0 && allCalls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-semibold text-[#0F172A] mb-2">No data yet</h2>
        <p className="text-sm text-[#475569] max-w-xs">
          Charts will appear once calls start coming in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Call Volume (Bar) ─────────────────────────────────────────────── */}
      {callVolumeData.length > 0 && (
        <ChartCard title="Call Volume">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={callVolumeData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                formatter={(value) => [`${value} calls`, 'Calls']}
              />
              <Bar dataKey="calls" fill="#C2410C" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── Urgency & Booking Outcomes (side by side donuts) ───────────── */}
      {(urgencyData.length > 0 || bookingOutcomeData.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {urgencyData.length > 0 && (
            <ChartCard title="Call Urgency">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={urgencyData} cx="50%" cy="45%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value">
                    {urgencyData.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 12, color: '#475569' }}>{value}</span>} />
                  <Tooltip formatter={(value, name) => [`${value} calls`, name]} contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
          {bookingOutcomeData.length > 0 && (
            <ChartCard title="Booking Outcomes">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={bookingOutcomeData} cx="50%" cy="45%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value">
                    {bookingOutcomeData.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 12, color: '#475569' }}>{value}</span>} />
                  <Tooltip formatter={(value, name) => [`${value} calls`, name]} contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      {/* ── Revenue Over Time (Line) ─────────────────────────────────────── */}
      {revenueData.length > 0 && (
        <ChartCard title="Revenue Over Time">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                tick={{ fontSize: 12, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#C2410C"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#C2410C' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── Conversion Funnel (Horizontal Bar) ─────────────────────────── */}
      {allLeads.length > 0 && (
        <ChartCard title="Conversion Funnel">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={funnelData}
              layout="vertical"
              margin={{ top: 4, right: 8, left: 56, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="status"
                tick={{ fontSize: 12, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip content={<CountTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={36}>
                {funnelData.map((entry) => (
                  <Cell key={entry.status} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── Pipeline Breakdown (Donut) ───────────────────────────────────── */}
      {pipelineData.length > 0 && (
        <ChartCard title="Pipeline Breakdown">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pipelineData}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pipelineData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ fontSize: 12, color: '#475569' }}>{value}</span>
                )}
              />
              <Tooltip
                formatter={(value, name) => [`${value} leads`, name]}
                contentStyle={{
                  fontSize: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

    </div>
  );
}
