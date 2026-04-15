'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneIncoming, PhoneOff, PhoneMissed, Search, X,
  Clock, Filter, ChevronDown, CalendarCheck, AlertTriangle,
  Globe, Mic, PhoneOutgoing, Users, ExternalLink,
} from 'lucide-react';
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
import AudioPlayer from '@/components/dashboard/AudioPlayer';
import { supabase } from '@/lib/supabase-browser';

// ─── Visual maps ──────────────────────────────────────────────────────────────

const URGENCY_STYLE = {
  emergency: { badge: 'bg-red-100 text-red-700', border: 'border-l-red-500', label: 'Emergency' },
  routine:   { badge: 'bg-stone-100 text-stone-600', border: 'border-l-stone-300', label: 'Routine' },
  urgent: { badge: 'bg-amber-100 text-amber-700', border: 'border-l-amber-500', label: 'Urgent' },
};

const OUTCOME_STYLE = {
  booked:        { badge: 'bg-green-100 text-green-700', icon: CalendarCheck, label: 'Booked' },
  attempted:     { badge: 'bg-amber-100 text-amber-700', icon: Phone, label: 'Attempted' },
  declined:      { badge: 'bg-stone-100 text-stone-600', icon: PhoneOff, label: 'Declined' },
  not_attempted: { badge: 'bg-stone-50 text-stone-400', icon: PhoneMissed, label: 'No Booking' },
};

const ROUTING_STYLE = {
  ai:             { badge: 'bg-stone-100 text-stone-600',  border: 'border-l-stone-300',  label: 'AI' },
  owner_pickup:   { badge: 'bg-blue-100 text-blue-700',    border: 'border-l-blue-500',   label: 'You answered' },
  fallback_to_ai: { badge: 'bg-amber-100 text-amber-700',  border: 'border-l-amber-500',  label: 'Missed \u2192 AI' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime(ts) {
  if (!ts) return '';
  const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDate(ts) {
  if (!ts) return '';
  const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatPhone(number) {
  if (!number) return 'Unknown caller';
  const digits = number.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return number;
}

// Urgency weight for sorting (emergency first, then urgent, then routine)
const URGENCY_WEIGHT = { emergency: 3, urgent: 2, routine: 1 };

// Group calls by date, sorting within each group by urgency then time
function groupByDate(calls) {
  const groups = [];
  let currentLabel = null;
  let currentGroup = null;

  for (const call of calls) {
    const label = formatDate(call.created_at);
    if (label !== currentLabel) {
      currentLabel = label;
      currentGroup = { label, calls: [] };
      groups.push(currentGroup);
    }
    currentGroup.calls.push(call);
  }

  // Sort within each date group by most recent first
  for (const group of groups) {
    group.calls.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  return groups;
}

// ─── Call Card ─────────────────────────────────────────────────────────────────

function CallCard({ call }) {
  const [expanded, setExpanded] = useState(false);
  const [recordingSrc, setRecordingSrc] = useState(null);
  const [recordingResolved, setRecordingResolved] = useState(false);
  const urgency = call.urgency_classification;
  const outcome = call.booking_outcome;
  const us = URGENCY_STYLE[urgency] || URGENCY_STYLE.routine;
  const os = OUTCOME_STYLE[outcome];
  const rs = call.routing_mode ? ROUTING_STYLE[call.routing_mode] : null;
  const isOwnerPickup = call.routing_mode === 'owner_pickup';
  const isShort = (call.duration_seconds ?? 0) < 15;
  const hasRecording = !!(call.recording_url || call.recording_storage_path);

  // Resolve recording URL on first expand (same pattern as LeadFlyout)
  useEffect(() => {
    if (!expanded || recordingResolved || !hasRecording) return;
    setRecordingResolved(true);
    if (call.recording_storage_path) {
      supabase.storage
        .from('call-recordings')
        .createSignedUrl(call.recording_storage_path, 3600)
        .then(({ data }) => setRecordingSrc(data?.signedUrl || call.recording_url || null));
    } else {
      setRecordingSrc(call.recording_url || null);
    }
  }, [expanded, recordingResolved, hasRecording, call.recording_storage_path, call.recording_url]);

  return (
    <div
      className={`border-l-[3px] ${us.border} bg-white rounded-r-xl transition-shadow ${expanded ? 'shadow-sm' : ''}`}
    >
      {/* Main row — always visible, clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left min-h-[56px] hover:bg-stone-50/50 transition-colors rounded-r-xl"
      >
        {/* Call status icon */}
        <div className={`flex items-center justify-center h-10 w-10 rounded-full shrink-0 ${
          call.status === 'analyzed' ? 'bg-green-50' :
          call.status === 'ended' ? 'bg-stone-50' :
          'bg-amber-50'
        }`}>
          {call.status === 'analyzed' ? (
            <PhoneIncoming className={`h-4.5 w-4.5 ${isShort ? 'text-stone-400' : 'text-green-600'}`} />
          ) : call.status === 'ended' ? (
            <PhoneOff className="h-4.5 w-4.5 text-stone-400" />
          ) : (
            <Clock className="h-4.5 w-4.5 text-amber-500" />
          )}
        </div>

        {/* Caller + time */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium truncate ${isShort ? 'text-stone-400' : 'text-foreground'}`}>
              {formatPhone(call.from_number)}
            </p>
            {isShort && (
              <span
                className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded"
                title="This call was too brief to count as a lead (under 15 seconds)."
              >
                too short
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatTime(call.created_at)}
            {call.duration_seconds > 0 && <span className="mx-1.5 text-stone-300">·</span>}
            {call.duration_seconds > 0 && <span>{formatDuration(call.duration_seconds)}</span>}
          </p>
        </div>

        {/* Key badge — show the most important info at a glance */}
        <div className="flex items-center gap-2 shrink-0">
          {rs && (
            <Badge className={`${rs.badge} text-xs`}>{rs.label}</Badge>
          )}
          {os && !isShort && !isOwnerPickup && (
            <Badge className={`${os.badge} text-xs`}>{os.label}</Badge>
          )}
          {urgency && urgency !== 'routine' && !isShort && !isOwnerPickup && (
            <Badge className={`${us.badge} text-xs`}>{us.label}</Badge>
          )}
        </div>

        {/* Expand chevron */}
        <ChevronDown className={`h-4 w-4 text-stone-400 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 pt-1 border-t border-stone-100">
              {isOwnerPickup ? (
                <>
                  <p className="text-sm text-muted-foreground mt-2">You handled this call directly.</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {call.duration_seconds > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatDuration(call.duration_seconds)}
                      </span>
                    )}
                  </div>
                  {call.from_number && (
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-stone-100">
                      <a
                        href={`tel:${call.from_number}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--brand-accent)] text-white hover:bg-[var(--brand-accent)]/90 active:scale-95 transition-all"
                      >
                        <PhoneOutgoing className="h-3 w-3" />
                        Call Back
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                    {/* Duration */}
                    <DetailItem
                      icon={Clock}
                      label="Duration"
                      value={call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : 'N/A'}
                    />

                    {/* Urgency */}
                    <DetailItem
                      icon={AlertTriangle}
                      label="Urgency"
                      value={urgency ? (URGENCY_STYLE[urgency]?.label || urgency) : 'Not classified'}
                    />

                    {/* Booking outcome */}
                    <DetailItem
                      icon={CalendarCheck}
                      label="Booking"
                      value={outcome ? (OUTCOME_STYLE[outcome]?.label || outcome) : 'N/A'}
                    />

                    {/* Language */}
                    <DetailItem
                      icon={Globe}
                      label="Language"
                      value={
                        call.language_barrier ? `${(call.detected_language || '?').toUpperCase()} (barrier)` :
                        call.detected_language ? call.detected_language.toUpperCase() :
                        'N/A'
                      }
                    />
                  </div>

                  {/* Extra info row */}
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                    {call.disconnection_reason && (
                      <span>Ended: {call.disconnection_reason.replace(/_/g, ' ')}</span>
                    )}
                    {call.notification_priority === 'high' && (
                      <Badge className="bg-red-50 text-red-600 text-[10px]">High Priority</Badge>
                    )}
                    {call.recovery_sms_status === 'sent' && (
                      <Badge className="bg-blue-50 text-blue-600 text-[10px]">Recovery SMS Sent</Badge>
                    )}
                    {call.exception_reason && (
                      <span>Exception: {call.exception_reason.replace(/_/g, ' ')}</span>
                    )}
                    {hasRecording && (
                      <span className="inline-flex items-center gap-1 text-[var(--brand-accent)]">
                        <Mic className="h-3 w-3" /> Recording available
                      </span>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-stone-100">
                    {call.from_number && (
                      <a
                        href={`tel:${call.from_number}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--brand-accent)] text-white hover:bg-[var(--brand-accent)]/90 active:scale-95 transition-all"
                      >
                        <PhoneOutgoing className="h-3 w-3" />
                        Call Back
                      </a>
                    )}
                    {call.from_number && !isShort && (
                      <a
                        href={`/dashboard/leads?search=${encodeURIComponent(call.from_number)}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 text-foreground hover:bg-stone-200 transition-colors"
                      >
                        <Users className="h-3 w-3" />
                        View Lead
                      </a>
                    )}
                  </div>

                  {/* Inline audio player */}
                  {hasRecording && (
                    <div className="mt-3">
                      <AudioPlayer src={recordingSrc} />
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-stone-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-stone-400 uppercase tracking-wide">{label}</p>
        <p className="text-xs font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <Phone className="h-10 w-10 text-stone-300 mb-4" aria-hidden="true" />
      {hasFilters ? (
        <>
          <h2 className="text-base font-semibold text-foreground mb-2">No calls match your filters</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">Try adjusting your search or removing some filters to see more results.</p>
          <Button variant="outline" size="sm" onClick={onClear}>Clear all filters</Button>
        </>
      ) : (
        <>
          <h2 className="text-base font-semibold text-foreground mb-2">No calls yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">When your AI receptionist answers a call, it will show up here with all the details.</p>
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
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchTimerRef = useRef(null);
  const [tenantId, setTenantId] = useState(null);

  const hasFilters = filters.search || filters.urgency || filters.bookingOutcome || filters.dateRange;

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.urgency) params.set('urgency', filters.urgency);
      if (filters.bookingOutcome) params.set('booking_outcome', filters.bookingOutcome);
      if (filters.search) params.set('search', filters.search);

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
      if (!res.ok) throw new Error('Failed to load calls');
      const data = await res.json();
      setCalls(data.calls ?? []);
    } catch {
      setError("Couldn't load calls. Check your connection and refresh the page.");
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  // ── Get tenant ID for Realtime subscription ─────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single()
        .then(({ data }) => setTenantId(data?.id ?? null));
    }).catch(() => {});
  }, []);

  // ── Supabase Realtime subscription for new calls ────────────────────────
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('calls-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          setCalls((prev) => [payload.new, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          setCalls((prev) =>
            prev.map((c) => (c.id === payload.new.id ? payload.new : c))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  function handleSearchChange(e) {
    const value = e.target.value;
    setSearchInput(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: value }));
    }, 300);
  }

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchInput('');
  };

  // Summary stats
  const total = calls.length;
  const booked = calls.filter((c) => c.booking_outcome === 'booked').length;
  const avgDur = total > 0 ? Math.round(calls.reduce((s, c) => s + (c.duration_seconds || 0), 0) / total) : 0;
  const emergencies = calls.filter((c) => c.urgency_classification === 'emergency').length;

  // Group by date
  const groups = groupByDate(calls);

  return (
    <div data-tour="calls-page">
      {/* Summary bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Calls', value: total, accent: false, icon: Phone, iconBg: 'bg-stone-100', iconColor: 'text-stone-500' },
          { label: 'Booked', value: booked, accent: booked > 0, icon: CalendarCheck, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
          { label: 'Avg Duration', value: formatDuration(avgDur), accent: false, icon: Clock, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
          { label: 'Emergencies', value: emergencies, accent: emergencies > 0, icon: AlertTriangle, iconBg: emergencies > 0 ? 'bg-red-50' : 'bg-stone-100', iconColor: emergencies > 0 ? 'text-red-500' : 'text-stone-400' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            className={`${card.base} px-4 py-3`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center size-8 rounded-lg shrink-0 ${stat.iconBg}`}>
                <stat.icon className={`size-4 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                {loading ? (
                  <Skeleton className="h-5 w-10 mt-0.5" />
                ) : (
                  <p className={`text-lg font-bold ${stat.accent ? 'text-[var(--brand-accent)]' : 'text-foreground'}`}>
                    {stat.value}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search + filters */}
      <div className={`${card.base} px-4 pt-4 pb-3 mb-3`}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              placeholder="Search by phone number..."
              value={searchInput}
              onChange={handleSearchChange}
              className="pl-9 h-9 text-sm"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); updateFilter('search', ''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className={`h-9 gap-1.5 shrink-0 ${hasFilters ? 'border-[var(--brand-accent)] text-[var(--brand-accent)]' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {hasFilters && (
              <span className="text-xs">({[filters.urgency, filters.bookingOutcome, filters.dateRange].filter(Boolean).length})</span>
            )}
          </Button>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground shrink-0" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>

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
                    <SelectItem value="urgent">Urgent</SelectItem>
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

      {/* Call list — grouped by date */}
      {error ? (
        <div className={`${card.base} p-8`}>
          <div className="flex flex-col items-center justify-center text-center">
            <Phone className="h-10 w-10 text-stone-300 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Failed to load calls</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-xs">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchCalls}>Try again</Button>
          </div>
        </div>
      ) : loading ? (
        <div className={`${card.base} p-4 space-y-3`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : calls.length === 0 ? (
        <div className={card.base}>
          <EmptyState hasFilters={!!hasFilters} onClear={clearFilters} />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.calls.map((call) => (
                  <CallCard key={call.id} call={call} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
