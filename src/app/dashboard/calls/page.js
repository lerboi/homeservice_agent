'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Phone, PhoneIncoming, PhoneOff, PhoneMissed, Search, X,
  Clock, Filter, ChevronDown, CalendarCheck, AlertTriangle,
  Globe, Mic, PhoneOutgoing, Users, ExternalLink, CheckCircle2,
  ArrowLeft, ArrowRight,
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
import { card, focus } from '@/lib/design-tokens';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import AudioPlayer from '@/components/dashboard/AudioPlayer';
import TranscriptViewer from '@/components/dashboard/TranscriptViewer';
import InquiryCard from '@/components/dashboard/InquiryCard';
import InquiryStatusPills from '@/components/dashboard/InquiryStatusPills';
import InquiryFlyout from '@/components/dashboard/InquiryFlyout';
import { supabase } from '@/lib/supabase-browser';

// Phase 58 Plan 58-05 (POLISH-01 / POLISH-04):
//   - Empty state (no filters) uses the shared <EmptyState> primitive with the
//     UI-SPEC §10.1 locked copy: "No calls yet" / "When callers reach your AI
//     receptionist, they'll appear here with transcript and recording." /
//     CTA "Make a test call" → /dashboard/more/ai-voice-settings.
//   - The filtered-empty state stays as the local secondary variant.
//   - <ErrorState onRetry={fetchCalls} /> replaces the ad-hoc AlertTriangle block.
//
// Inquiries → Calls merge (2026-06-10): the Inquiries tab is gone; its work
// queue lives here as the "Callbacks" view. The CLASSIC calls layout (stat
// cards, search, filters, date-grouped expandable call cards) is the one
// default landing view — there is NO smart default and no view-resolution
// skeleton; calls render immediately without waiting on the inquiries fetch.
//   - Callbacks — open inquiries (callers waiting for a callback). Reuses
//     InquiryCard + InquiryFlyout (Convert-to-Job via QuickBookSheet, Mark as
//     Lost with 5s sonner undo) and the inquiries Realtime subscription,
//     ported from the old /dashboard/inquiries page. Open/Booked/Lost
//     sub-pills keep converted/lost history reachable. Reached via the
//     CallbacksStrip above the stat cards (shown only when open count > 0)
//     or an explicit ?view= deep link; "← All calls" goes back.
// URL matrix: ?view=callbacks → Callbacks view; ?view=needs-reply is a legacy
// alias (old deep links + the /dashboard/inquiries redirect) → Callbacks;
// no param or ?view=all (or anything else) → classic calls view.
//
// D-07a INVARIANT (carried over from the old inquiries page) — this file MUST
// NOT contain any age-based mutation of inquiry rows, staleness flags, or
// auto-lost scheduling. Open inquiries stay open until the owner acts.

// ─── Realtime animation keyframe (ported from the old inquiries page) ─────────

const SLIDE_IN_STYLE_ID = 'inquiry-slide-in-keyframe';

function ensureSlideInKeyframe() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SLIDE_IN_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SLIDE_IN_STYLE_ID;
  style.textContent = `
    @keyframes inquiry-slide-in {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .animate-inquiry-slide-in {
      animation: inquiry-slide-in 200ms ease-out;
    }
  `;
  document.head.appendChild(style);
}

// ─── Visual maps ──────────────────────────────────────────────────────────────

const URGENCY_STYLE = {
  emergency: { badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300', border: 'border-l-red-500', label: 'Emergency' },
  routine:   { badge: 'bg-muted text-muted-foreground', border: 'border-l-stone-300 dark:border-l-stone-600', label: 'Routine' },
  urgent: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', border: 'border-l-amber-500', label: 'Urgent' },
};

const OUTCOME_STYLE = {
  booked:        { badge: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300', icon: CalendarCheck, label: 'Booked' },
  attempted:     { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', icon: Phone, label: 'Reached out' },
  declined:      { badge: 'bg-muted text-muted-foreground', icon: PhoneOff, label: 'Declined' },
  not_attempted: { badge: 'bg-muted text-muted-foreground', icon: PhoneMissed, label: 'No Booking' },
};

// Plain-language mapping for calls.exception_reason (migration 008 enum).
const EXCEPTION_LABEL = {
  clarification_limit: "The AI couldn't get enough details",
  caller_requested: 'Caller asked to speak with a person',
};

const ROUTING_STYLE = {
  ai:             { badge: 'bg-muted text-muted-foreground',  border: 'border-l-stone-300 dark:border-l-stone-600',  label: 'AI' },
  owner_pickup:   { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',    border: 'border-l-blue-500',   label: 'You answered' },
  fallback_to_ai: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',  border: 'border-l-amber-500',  label: 'Missed \u2192 AI' },
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
  const prefersReduced = useReducedMotion();
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
      className={`border-l-[3px] ${us.border} bg-card rounded-r-xl transition-shadow ${expanded ? 'shadow-sm' : ''}`}
    >
      {/* Main row — always visible, clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left min-h-[56px] hover:bg-muted/50 transition-colors rounded-r-xl"
      >
        {/* Call status icon */}
        <div className={`flex items-center justify-center h-10 w-10 rounded-full shrink-0 ${
          call.status === 'analyzed' ? 'bg-green-50 dark:bg-green-950/40' :
          call.status === 'ended' ? 'bg-muted' :
          'bg-amber-50 dark:bg-amber-950/40'
        }`}>
          {call.status === 'analyzed' ? (
            <PhoneIncoming className={`h-4.5 w-4.5 ${isShort ? 'text-muted-foreground' : 'text-green-600 dark:text-green-400'}`} />
          ) : call.status === 'ended' ? (
            <PhoneOff className="h-4.5 w-4.5 text-muted-foreground" />
          ) : (
            <Clock className="h-4.5 w-4.5 text-amber-500 dark:text-amber-400" />
          )}
        </div>

        {/* Caller + time */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium truncate ${isShort ? 'text-muted-foreground' : 'text-foreground'}`}>
              {formatPhone(call.from_number)}
            </p>
            {isShort && (
              <span
                className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                title="This call was too brief to count as a lead (under 15 seconds)."
              >
                too short
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatTime(call.created_at)}
            {call.duration_seconds > 0 && <span className="mx-1.5 text-muted-foreground/50">·</span>}
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
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={prefersReduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.15, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 pt-1 border-t border-border">
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
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
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
                      <Badge className="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300 text-[10px]">High Priority</Badge>
                    )}
                    {call.recovery_sms_status === 'sent' && (
                      <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300 text-[10px]">We texted them back</Badge>
                    )}
                    {call.exception_reason && (
                      <span>{EXCEPTION_LABEL[call.exception_reason] || 'Call ended unexpectedly'}</span>
                    )}
                    {hasRecording && (
                      <span className="inline-flex items-center gap-1 text-[var(--brand-accent)]">
                        <Mic className="h-3 w-3" /> Recording available
                      </span>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
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
                        href={`/dashboard/jobs?search=${encodeURIComponent(call.from_number)}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted transition-colors"
                      >
                        <Users className="h-3 w-3" />
                        View Job
                      </a>
                    )}
                  </div>

                  {/* Inline audio player */}
                  {hasRecording && (
                    <div className="mt-3">
                      <AudioPlayer src={recordingSrc} />
                    </div>
                  )}

                  {/* Transcript — collapsible, capped height with scroll.
                      TranscriptViewer degrades gracefully when both are null. */}
                  <div className="mt-3">
                    <TranscriptViewer
                      transcriptStructured={call.transcript_structured}
                      transcriptText={call.transcript_text}
                    />
                  </div>
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
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-xs font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
// Phase 58 Plan 58-05 (POLISH-01): the no-filter branch now delegates to the
// shared <EmptyState> primitive with UI-SPEC §10.1 locked copy. The filtered
// branch is a distinct "no match" surface so we keep the local variant with
// its Clear-filters action — UI-SPEC only locks the zero-data-ever copy.
// Renamed to CallsEmptyState so the imported <EmptyState> primitive is not
// shadowed inside this module.

function CallsEmptyState({ hasFilters, onClear }) {
  if (!hasFilters) {
    // Locked copy: "No calls yet" — UI-SPEC §10.1
    return (
      <EmptyState
        icon={Phone}
        headline="No calls yet"
        description="When callers reach your AI receptionist, they'll appear here with transcript and recording."
        ctaLabel="Make a test call"
        ctaHref="/dashboard/more/ai-voice-settings"
      />
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <Phone className="h-10 w-10 text-muted-foreground/50 mb-4" aria-hidden="true" />
      <h2 className="text-base font-semibold text-foreground mb-2">No calls match your filters</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">Try adjusting your search or removing some filters to see more results.</p>
      <Button variant="outline" size="sm" onClick={onClear}>Clear all filters</Button>
    </div>
  );
}

// ─── Callbacks strip ──────────────────────────────────────────────────────────
// Compact one-line nudge above the stat cards — rendered only when callers are
// waiting for a callback (open count > 0). Brand-accent tint follows the
// AiNumberBanner pattern (`var(--brand-accent)` flips for dark mode, so the
// /10 tint is dark-paired by the token itself). Clicking switches to the
// Callbacks view.

function CallbacksStrip({ count, onView }) {
  const noun = count === 1 ? 'caller' : 'callers';
  return (
    <button
      type="button"
      onClick={onView}
      aria-label={`${count} ${noun} waiting for a callback — view callbacks`}
      className={`w-full flex items-center gap-2.5 mb-4 px-4 py-2.5 min-h-[44px] rounded-lg border
                  border-[var(--brand-accent)]/25 bg-[var(--brand-accent)]/10 text-sm
                  text-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/15
                  transition-colors text-left ${focus.ring}`}
    >
      <PhoneIncoming className="size-4 shrink-0" aria-hidden="true" />
      <span className="font-semibold truncate">
        {count} {noun} waiting for a callback
      </span>
      <span className="ml-auto inline-flex items-center gap-1 shrink-0 font-medium">
        View
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}

// ─── View resolution ──────────────────────────────────────────────────────────
// 'callbacks' | 'all'. Explicit ?view=callbacks (or the legacy needs-reply
// alias) opens the Callbacks view; everything else — no param, ?view=all, or
// an unknown value — lands on the classic calls view. No smart default.

function resolveViewParam(v) {
  return v === 'callbacks' || v === 'needs-reply' ? 'callbacks' : 'all';
}

// ─── Main page ────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS = { search: '', urgency: '', bookingOutcome: '', dateRange: '' };

export default function CallLogsPage() {
  const prefersReduced = useReducedMotion();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchTimerRef = useRef(null);
  const [tenantId, setTenantId] = useState(null);

  // ── Callbacks (inquiries) state — Inquiries tab merged into Calls ────────
  const [inquiries, setInquiries] = useState([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(true);
  const [inquiriesError, setInquiriesError] = useState(null);
  // Sub-filter inside the Callbacks view: Open by default (inbox model —
  // D-07a); Booked/Lost pills keep converted/lost history reachable.
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState('open');
  const [selectedInquiryId, setSelectedInquiryId] = useState(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  // Search + date-range filters for the Callbacks view. Applied CLIENT-SIDE so
  // the Open/Booked/Lost pill counts stay accurate (server-side filtering would
  // skew them). Empty string / 'all' = no filter.
  const [inquirySearch, setInquirySearch] = useState('');
  const [inquiryDateRange, setInquiryDateRange] = useState('all');

  // ── View resolution ───────────────────────────────────────────────────────
  // 'callbacks' | 'all' — resolved synchronously from the URL (legacy
  // ?view=needs-reply aliases to callbacks). Classic calls view is the
  // default; it never waits on the inquiries fetch.
  const [view, setView] = useState(() => resolveViewParam(searchParams.get('view')));

  const hasFilters = filters.search || filters.urgency || filters.bookingOutcome || filters.dateRange;

  // In-flight calls fetch — aborted when a newer fetch supersedes it so rapid
  // filter changes can't resolve out of order and paint a stale list.
  const abortRef = useRef(null);

  const fetchCalls = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
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
      const res = await fetch(`/api/calls${qs ? `?${qs}` : ''}`, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to load calls');
      const data = await res.json();
      setCalls(data.calls ?? []);
    } catch (err) {
      if (err?.name === 'AbortError') return; // superseded by a newer fetch
      setError("Couldn't load calls. Check your connection and refresh the page.");
    } finally {
      // Only the owning fetch may clear the flag — a superseded fetch's
      // finally must not stomp the newer fetch's in-progress state.
      if (abortRef.current === controller) setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  // Abort the in-flight fetch on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

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

  // ── Realtime reconnect tracking ──────────────────────────────────────────
  // Shared across both channels. Both ride the same socket, so after a drop
  // the first successful resubscribe refetches BOTH datasets (events for
  // either table may have been missed while disconnected). Channel callbacks
  // read the latest fetchers through a ref so the channels don't get torn
  // down whenever the fetcher identities change.
  const wasDisconnectedRef = useRef(false);
  const refetchAllRef = useRef(() => {});

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
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          wasDisconnectedRef.current = true;
        } else if (status === 'SUBSCRIBED' && wasDisconnectedRef.current) {
          wasDisconnectedRef.current = false;
          refetchAllRef.current();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  // ── Inject Realtime slide-in keyframe once ──────────────────────────────
  useEffect(() => { ensureSlideInKeyframe(); }, []);

  // ── Fetch inquiries (callbacks work queue + strip count) ────────────────
  // Same unfiltered fetch the old inquiries page used: all statuses (API
  // limit 200) so the Open/Booked/Lost sub-pills carry live counts; status
  // filtering happens client-side. This fetch never blocks the classic calls
  // view — the CallbacksStrip simply appears once the count resolves.
  const fetchInquiries = useCallback(async () => {
    setInquiriesLoading(true);
    setInquiriesError(null);
    try {
      const res = await fetch('/api/inquiries');
      if (!res.ok) throw new Error('Failed to load inquiries');
      const data = await res.json();
      const sorted = (data.inquiries || []).sort((a, b) => {
        const wa = URGENCY_WEIGHT[a.urgency] || 0;
        const wb = URGENCY_WEIGHT[b.urgency] || 0;
        if (wa !== wb) return wb - wa;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setInquiries(sorted);
    } catch {
      setInquiriesError("We couldn't load your callbacks. Check your connection and try again.");
    } finally {
      setInquiriesLoading(false);
    }
  }, []);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  // Keep the reconnect refetch pointed at the latest fetchers (fetchCalls
  // changes identity with filters) without recreating the channels.
  useEffect(() => {
    refetchAllRef.current = () => {
      fetchCalls();
      fetchInquiries();
    };
  }, [fetchCalls, fetchInquiries]);

  // ── Keep view in sync with the URL (?view= deep links, back/forward) ────
  // No param (or an unknown value) resolves to the classic calls view, so
  // back/forward between /dashboard/calls and ?view=callbacks stays correct.
  useEffect(() => {
    const next = resolveViewParam(searchParams.get('view'));
    if (next !== view) setView(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Supabase Realtime subscription for inquiries (D-15) ─────────────────
  // Ported from the old inquiries page: INSERT prepends with the slide-in
  // flag; UPDATE replaces the row. Keeps the Callbacks list AND the strip
  // count live. Cleaned up via removeChannel on unmount / tenant change.
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('inquiries-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inquiries',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          // The realtime payload lacks the joins the API rows carry, so
          // refetch instead of prepending a bare row.
          fetchInquiries();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inquiries',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          setInquiries((prev) =>
            prev.map((inq) =>
              inq.id === payload.new.id ? { ...payload.new, _isNew: false } : inq
            )
          );
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          wasDisconnectedRef.current = true;
        } else if (status === 'SUBSCRIBED' && wasDisconnectedRef.current) {
          wasDisconnectedRef.current = false;
          refetchAllRef.current();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, fetchInquiries]);

  // ── Inquiry counts + client-side status filtering ───────────────────────
  const inquiryStatusCounts = useMemo(() => {
    const counts = { open: 0, converted: 0, lost: 0 };
    for (const inq of inquiries) {
      if (counts[inq.status] !== undefined) counts[inq.status] += 1;
    }
    return counts;
  }, [inquiries]);

  const openCallbacksCount = inquiryStatusCounts.open;

  const displayedInquiries = useMemo(() => {
    // Date-range cutoff — computed exactly the way fetchCalls does for the
    // classic view (YYYY-MM-DD boundary), kept client-side so pill counts stay
    // accurate. Rows with created_at >= cutoff are kept.
    let dateFrom;
    if (inquiryDateRange && inquiryDateRange !== 'all') {
      const now = new Date();
      if (inquiryDateRange === 'today') {
        dateFrom = now.toISOString().split('T')[0];
      } else if (inquiryDateRange === '7d') {
        const d = new Date(now); d.setDate(d.getDate() - 7);
        dateFrom = d.toISOString().split('T')[0];
      } else if (inquiryDateRange === '30d') {
        const d = new Date(now); d.setDate(d.getDate() - 30);
        dateFrom = d.toISOString().split('T')[0];
      }
    }
    const cutoff = dateFrom ? new Date(dateFrom) : null;
    const search = inquirySearch.trim().toLowerCase();

    return inquiries.filter((inq) => {
      if (inquiryStatusFilter && inq.status !== inquiryStatusFilter) return false;
      if (cutoff && (!inq.created_at || new Date(inq.created_at) < cutoff)) return false;
      if (search) {
        const name = (inq.customer?.name || inq.caller_name || '').toLowerCase();
        const phone = (inq.customer?.phone_e164 || inq.from_number || '').toLowerCase();
        if (!name.includes(search) && !phone.includes(search)) return false;
      }
      return true;
    });
  }, [inquiries, inquiryStatusFilter, inquirySearch, inquiryDateRange]);

  // Active search / date filter on the Callbacks view — drives the filtered
  // empty-state variant (distinct from the "all caught up" zero-queue state).
  const hasInquiryFilters = inquirySearch.trim() !== '' || (inquiryDateRange && inquiryDateRange !== 'all');

  // ── View + inquiry handlers ─────────────────────────────────────────────

  function handleViewChange(next) {
    if (next === view) return;
    setView(next);
    // Keep deep links working — replace (not push), no scroll reset.
    router.replace(`/dashboard/calls?view=${next}`, { scroll: false });
  }

  function handleViewInquiry(inquiryId) {
    setSelectedInquiryId(inquiryId);
    setFlyoutOpen(true);
  }

  function handleInquiryStatusChange(updatedInquiry) {
    setInquiries((prev) =>
      prev.map((inq) => (inq.id === updatedInquiry.id ? { ...inq, ...updatedInquiry } : inq))
    );
  }

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

  // ── Callbacks view content ────────────────────────────────────────────────
  let callbacksContent;
  if (inquiriesError) {
    callbacksContent = <ErrorState message={inquiriesError} onRetry={fetchInquiries} />;
  } else if (inquiriesLoading) {
    callbacksContent = (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
        ))}
      </div>
    );
  } else if (displayedInquiries.length === 0) {
    callbacksContent = hasInquiryFilters ? (
      // Filtered to empty — mirror the classic CallsEmptyState filtered variant.
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <Phone className="h-10 w-10 text-muted-foreground/50 mb-4" aria-hidden="true" />
        <h2 className="text-base font-semibold text-foreground mb-2">No callbacks match your filters</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">Try adjusting your search or removing some filters to see more results.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setInquirySearch(''); setInquiryDateRange('all'); }}
        >
          Clear all filters
        </Button>
      </div>
    ) :
      !inquiryStatusFilter || inquiryStatusFilter === 'open' ? (
        // "All caught up" — stays for when the queue is empty but the user
        // navigates here explicitly. Same visual structure as the shared
        // <EmptyState>, with a subtle link back to All calls.
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 mb-4" aria-hidden="true" />
          <h2 className="text-base font-semibold text-foreground mb-2">All caught up</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            No callers waiting for a callback right now.
          </p>
          <button
            type="button"
            onClick={() => handleViewChange('all')}
            className="text-sm text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] font-medium"
          >
            View all calls
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {/* Display label only — 'converted' shows as "booked" */}
            No {inquiryStatusFilter === 'converted' ? 'booked' : inquiryStatusFilter} callbacks right now.
          </p>
        </div>
      );
  } else {
    callbacksContent = (
      <div className="space-y-3">
        {displayedInquiries.map((inquiry) => (
          <div
            key={inquiry.id}
            className={inquiry._isNew ? 'animate-inquiry-slide-in' : ''}
          >
            <InquiryCard inquiry={inquiry} onView={handleViewInquiry} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div data-tour="calls-page">
      {view === 'callbacks' ? (
        /* ── Callbacks view — open-inquiries work queue ───────────────────── */
        <>
          {/* Back control + title — back pattern matches admin/merges */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => handleViewChange('all')}
              aria-label="Back to all calls"
              className={`inline-flex items-center gap-1 min-h-[44px] -ml-1 px-1 rounded-md text-sm
                          text-muted-foreground hover:text-foreground transition-colors ${focus.ring}`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              All calls
            </button>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Callbacks</h1>
          </div>

          <div className={`${card.base} p-0`} data-view="callbacks">
            {/* Search + date-range — applied client-side so pill counts stay accurate */}
            <div className="flex items-center gap-2 px-4 pt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={inquirySearch}
                  onChange={(e) => setInquirySearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
                {inquirySearch && (
                  <button
                    onClick={() => setInquirySearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Select value={inquiryDateRange} onValueChange={setInquiryDateRange}>
                <SelectTrigger className="w-[130px] h-9 text-xs shrink-0">
                  <SelectValue placeholder="Time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="pt-3">
              <InquiryStatusPills
                counts={inquiryStatusCounts}
                activeStatus={inquiryStatusFilter}
                onStatusChange={setInquiryStatusFilter}
              />
            </div>
            <div className="px-6 py-4">
              {callbacksContent}
            </div>
          </div>
        </>
      ) : (
        /* ── Classic calls view — the default landing experience ──────────── */
        <>
      {/* Callbacks strip — only when callers are waiting (hidden at 0) */}
      {openCallbacksCount > 0 && (
        <CallbacksStrip
          count={openCallbacksCount}
          onView={() => handleViewChange('callbacks')}
        />
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Calls', value: total, accent: false, icon: Phone, iconBg: 'bg-muted', iconColor: 'text-muted-foreground' },
          { label: 'Booked', value: booked, accent: booked > 0, icon: CalendarCheck, iconBg: 'bg-emerald-50 dark:bg-emerald-950/40', iconColor: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Avg Duration', value: formatDuration(avgDur), accent: false, icon: Clock, iconBg: 'bg-blue-50 dark:bg-blue-950/40', iconColor: 'text-blue-600 dark:text-blue-400' },
          { label: 'Emergencies', value: emergencies, accent: emergencies > 0, icon: AlertTriangle, iconBg: emergencies > 0 ? 'bg-red-50 dark:bg-red-950/40' : 'bg-muted', iconColor: emergencies > 0 ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            className={`${card.base} px-4 py-3`}
            initial={prefersReduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.2 }}
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={searchInput}
              onChange={handleSearchChange}
              className="pl-9 h-9 text-sm"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); updateFilter('search', ''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-muted-foreground"
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
              initial={prefersReduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: prefersReduced ? 0 : 0.15 }}
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
                    <SelectItem value="attempted">Reached out</SelectItem>
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
        <div className={`${card.base} p-4`}>
          <ErrorState message={error} onRetry={fetchCalls} />
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
          <CallsEmptyState hasFilters={!!hasFilters} onClear={clearFilters} />
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
        </>
      )}

      {/* InquiryFlyout — Convert to Job (QuickBookSheet) + Mark as Lost (5s sonner undo),
          ported unchanged from the old inquiries page */}
      <InquiryFlyout
        inquiryId={selectedInquiryId}
        open={flyoutOpen}
        onOpenChange={setFlyoutOpen}
        onStatusChange={handleInquiryStatusChange}
      />
    </div>
  );
}
