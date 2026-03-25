'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneIncoming, PhoneOff, Search, X, Play, Clock, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { card } from '@/lib/design-tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY_BADGE = {
  emergency: 'bg-red-100 text-red-700',
  routine: 'bg-stone-100 text-stone-600',
  high_ticket: 'bg-amber-100 text-amber-700',
};

const URGENCY_LABEL = {
  emergency: 'Emergency',
  routine: 'Routine',
  high_ticket: 'High Ticket',
};

const OUTCOME_BADGE = {
  booked: 'bg-green-100 text-green-700',
  attempted: 'bg-amber-100 text-amber-700',
  declined: 'bg-stone-100 text-stone-600',
  not_attempted: 'bg-stone-100 text-stone-500',
};

const OUTCOME_LABEL = {
  booked: 'Booked',
  attempted: 'Attempted',
  declined: 'Declined',
  not_attempted: 'No Booking',
};

const STATUS_ICON = {
  started: Clock,
  ended: PhoneOff,
  analyzed: PhoneIncoming,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  // ts can be a bigint (unix ms) or ISO string
  const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(date.getTime())) return '—';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

function formatPhone(number) {
  if (!number) return 'Unknown';
  // Simple US format: +1XXXXXXXXXX → (XXX) XXX-XXXX
  const digits = number.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return number;
}

// ─── Call Row ─────────────────────────────────────────────────────────────────

function CallRow({ call, index }) {
  const urgency = call.urgency_classification;
  const outcome = call.booking_outcome;
  const StatusIcon = STATUS_ICON[call.status] || Phone;
  const isShort = (call.duration_seconds ?? 0) < 15;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: index * 0.02, ease: 'easeOut' }}
      className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/60 transition-colors border-b border-stone-100 last:border-b-0"
    >
      {/* Status icon */}
      <div className={`flex items-center justify-center h-9 w-9 rounded-full shrink-0 ${
        call.status === 'analyzed' ? 'bg-green-50 text-green-600' :
        call.status === 'ended' ? 'bg-stone-100 text-stone-500' :
        'bg-amber-50 text-amber-600'
      }`}>
        <StatusIcon className="h-4 w-4" />
      </div>

      {/* Caller info */}
      <div className="min-w-0 w-36 shrink-0">
        <p className="text-sm font-medium text-[#0F172A] truncate">{formatPhone(call.from_number)}</p>
        <p className="text-xs text-[#475569]">{formatTimestamp(call.created_at)}</p>
      </div>

      {/* Duration */}
      <div className="w-16 shrink-0 text-center">
        <p className={`text-sm font-medium ${isShort ? 'text-stone-400' : 'text-[#0F172A]'}`}>
          {formatDuration(call.duration_seconds)}
        </p>
        {isShort && <p className="text-[10px] text-stone-400">Short</p>}
      </div>

      {/* Badges */}
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        {urgency && (
          <Badge className={`${URGENCY_BADGE[urgency] || URGENCY_BADGE.routine} text-xs`}>
            {URGENCY_LABEL[urgency] || urgency}
          </Badge>
        )}
        {outcome && (
          <Badge className={`${OUTCOME_BADGE[outcome] || OUTCOME_BADGE.not_attempted} text-xs`}>
            {OUTCOME_LABEL[outcome] || outcome}
          </Badge>
        )}
        {call.language_barrier && (
          <Badge className="bg-purple-100 text-purple-700 text-xs">
            Language Barrier
          </Badge>
        )}
        {call.detected_language && call.detected_language !== 'en' && !call.language_barrier && (
          <Badge className="bg-blue-50 text-blue-600 text-xs">
            {call.detected_language.toUpperCase()}
          </Badge>
        )}
      </div>

      {/* Recording indicator */}
      <div className="w-8 shrink-0 flex justify-center">
        {(call.recording_url || call.recording_storage_path) && (
          <Play className="h-4 w-4 text-stone-400" />
        )}
      </div>
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Phone className="h-10 w-10 text-stone-300 mb-3" />
      {hasFilters ? (
        <>
          <p className="text-sm font-medium text-[#0F172A] mb-1">No calls match your filters</p>
          <p className="text-xs text-[#475569] mb-3">Try adjusting your search or filters</p>
          <Button variant="outline" size="sm" onClick={onClear}>Clear filters</Button>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-[#0F172A] mb-1">No calls yet</p>
          <p className="text-xs text-[#475569]">Calls will appear here once your AI receptionist starts answering</p>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS = { search: '', urgency: '', bookingOutcome: '', dateRange: '' };

export default function CallLogsPage() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const hasFilters = filters.search || filters.urgency || filters.bookingOutcome || filters.dateRange;

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.urgency) params.set('urgency', filters.urgency);
      if (filters.bookingOutcome) params.set('booking_outcome', filters.bookingOutcome);
      if (filters.search) params.set('search', filters.search);

      // Date range presets
      if (filters.dateRange) {
        const now = new Date();
        let dateFrom;
        if (filters.dateRange === 'today') {
          dateFrom = now.toISOString().split('T')[0];
        } else if (filters.dateRange === '7d') {
          const d = new Date(now); d.setDate(d.getDate() - 7);
          dateFrom = d.toISOString().split('T')[0];
        } else if (filters.dateRange === '30d') {
          const d = new Date(now); d.setDate(d.getDate() - 30);
          dateFrom = d.toISOString().split('T')[0];
        }
        if (dateFrom) params.set('date_from', dateFrom);
      }

      const qs = params.toString();
      const res = await fetch(`/api/calls${qs ? `?${qs}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  // Stats summary
  const totalCalls = calls.length;
  const analyzedCalls = calls.filter((c) => c.status === 'analyzed').length;
  const bookedCalls = calls.filter((c) => c.booking_outcome === 'booked').length;
  const avgDuration = totalCalls > 0
    ? Math.round(calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / totalCalls)
    : 0;

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-4">Call Logs</h1>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total Calls', value: totalCalls },
          { label: 'Analyzed', value: analyzedCalls },
          { label: 'Booked', value: bookedCalls },
          { label: 'Avg Duration', value: formatDuration(avgDuration) },
        ].map((stat) => (
          <div key={stat.label} className={`${card.base} px-4 py-3`}>
            <p className="text-xs text-[#475569]">{stat.label}</p>
            <p className="text-lg font-semibold text-[#0F172A]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Call list card */}
      <div className={`${card.base} overflow-hidden`}>
        {/* Header + search */}
        <div className="px-4 pt-4 pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input
                placeholder="Search phone number..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="pl-9 h-9 text-sm"
              />
              {filters.search && (
                <button
                  onClick={() => updateFilter('search', '')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <Button
              variant="outline"
              size="sm"
              className={`h-9 gap-1.5 ${hasFilters ? 'border-[#C2410C] text-[#C2410C]' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {hasFilters && <span className="text-xs">({[filters.urgency, filters.bookingOutcome, filters.dateRange].filter(Boolean).length})</span>}
            </Button>

            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-xs text-[#475569]" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>

          {/* Expanded filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="flex flex-wrap gap-2 pt-3">
                  <Select value={filters.dateRange} onValueChange={(v) => updateFilter('dateRange', v)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue placeholder="Time range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.urgency} onValueChange={(v) => updateFilter('urgency', v)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue placeholder="Urgency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="high_ticket">High Ticket</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.bookingOutcome} onValueChange={(v) => updateFilter('bookingOutcome', v)}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue placeholder="Booking result" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="booked">Booked</SelectItem>
                      <SelectItem value="attempted">Attempted</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                      <SelectItem value="not_attempted">No Booking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Call list */}
        {loading ? (
          <div className="px-4 py-3 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : calls.length === 0 ? (
          <EmptyState hasFilters={!!hasFilters} onClear={clearFilters} />
        ) : (
          <div>
            {calls.map((call, i) => (
              <CallRow key={call.id} call={call} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
