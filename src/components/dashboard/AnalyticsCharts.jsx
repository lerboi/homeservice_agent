'use client';

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
 * AnalyticsCharts — revenue over time (line), conversion funnel (bar), pipeline breakdown (donut).
 *
 * @param {{ leads: Array | null, loading?: boolean }} props
 */
export default function AnalyticsCharts({ leads, loading }) {
  if (loading) {
    return <ChartsSkeleton />;
  }

  const allLeads = leads ?? [];

  // Empty state: fewer than 5 completed leads
  const completedCount = allLeads.filter(
    (l) => l.status === 'completed' || l.status === 'paid'
  ).length;

  if (allLeads.length < 5 || completedCount < 1) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-semibold text-[#0F172A] mb-2">Not enough data yet</h2>
        <p className="text-sm text-[#475569] max-w-xs">
          Revenue and conversion charts appear once you have at least 5 completed leads.
        </p>
      </div>
    );
  }

  const revenueData = buildRevenueData(allLeads);
  const funnelData = buildFunnelData(allLeads);
  const pipelineData = buildPipelineData(allLeads);

  return (
    <div className="space-y-6">

      {/* ── Revenue Over Time (Line) ─────────────────────────────────────── */}
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

      {/* ── Conversion Funnel (Horizontal Bar) ─────────────────────────── */}
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

      {/* ── Pipeline Breakdown (Donut) ───────────────────────────────────── */}
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

    </div>
  );
}
