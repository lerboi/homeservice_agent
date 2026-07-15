'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, CalendarOff, CalendarPlus, UserPlus, Plus, RefreshCw, Clock, Pencil } from 'lucide-react';
import { useReducedMotion, motion, useAnimation } from 'framer-motion';
import { EmptyStateCalendar } from '@/components/dashboard/EmptyStateCalendar';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';

// Phase 58 Plan 58-05 (POLISH-01 / POLISH-04):
//   - EmptyStateCalendar wraps <EmptyState icon={Calendar} /> and renders
//     headline "No appointments yet" (UI-SPEC §10.1 locked copy) via the
//     58-04 primitive. onConnect is now wired to open TimeBlockSheet — the
//     UI-SPEC intent ("Add a time block" CTA) surfaced via the wrapper's
//     shipped callback shape so we don't mutate the primitive.
//   - <ErrorState onRetry={fetchData} /> renders when the appointments/blocks
//     fetch throws — previously the catch silently swallowed the error.
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import CalendarView from '@/components/dashboard/CalendarView';
import AppointmentFlyout from '@/components/dashboard/AppointmentFlyout';
import QuickBookSheet from '@/components/dashboard/QuickBookSheet';
import TimeBlockSheet from '@/components/dashboard/TimeBlockSheet';
import ExternalEventSheet from '@/components/dashboard/ExternalEventSheet';
import ConflictAlertBanner from '@/components/dashboard/ConflictAlertBanner';
import CalendarConnectionsCard from '@/components/dashboard/CalendarConnectionsCard';
import { INTEGRATIONS_ENABLED } from '@/lib/integrations-enabled';
import WorkingHoursEditor from '@/components/dashboard/WorkingHoursEditor';
import { useSWRFetch } from '@/hooks/useSWRFetch';
import { card } from '@/lib/design-tokens';
import { supabase } from '@/lib/supabase-browser';

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatWeekRange(date) {
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  const opts = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', opts);
  const endStr = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

const WH_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WH_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

function formatTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return m === 0 ? `${hr} ${ampm}` : `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function summarizeWorkingHours(wh) {
  if (!wh) return [];
  // Group consecutive days with same hours
  const groups = [];
  for (const day of WH_DAYS) {
    const config = wh[day];
    const key = config?.enabled ? `${config.open}-${config.close}` : 'closed';
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.days.push(day);
    } else {
      groups.push({ key, days: [day], config });
    }
  }
  return groups.map((g) => {
    const first = WH_LABELS[g.days[0]];
    const last = WH_LABELS[g.days[g.days.length - 1]];
    const label = g.days.length === 1 ? first : `${first}–${last}`;
    if (g.key === 'closed' || !g.config?.enabled) {
      return { label, hours: 'Closed', closed: true };
    }
    return { label, hours: `${formatTime12(g.config.open)} – ${formatTime12(g.config.close)}`, closed: false };
  });
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  // initialLoading drives the one-time skeleton; fetching covers background
  // refetches (navigation, Realtime) where the previous grid stays visible
  // and just dims — no skeleton flash on every month/day change.
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Phase 58 Plan 58-05 (POLISH-04): surface fetchData failures so the calendar
  // can render <ErrorState onRetry={fetchData} /> instead of the silent empty
  // fallback the prior catch swallowed into.
  const [fetchError, setFetchError] = useState(null);
  const [data, setData] = useState({
    appointments: [],
    externalEvents: [],
    travelBuffers: [],
    conflicts: [],
    timeBlocks: [],
  });

  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const prefersReduced = useReducedMotion();
  const [workingHoursData, setWorkingHoursData] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  // Phase 57 — Jobber connection flag drives "Not in Jobber" pills and the
  // AppointmentFlyout Copy-to-Jobber section. Shares the SWR key with
  // CalendarConnectionsCard, so this adds no extra network request.
  // v1: Jobber/Xero flagged off — skip the fetch (null key) so jobberConnected
  // is always false and every Jobber affordance stays hidden. See
  // My Prompts/Jobber-Xero-Disable.md.
  const { data: integrationStatus } = useSWRFetch(
    INTEGRATIONS_ENABLED ? '/api/integrations/status' : null,
  );
  const jobberConnected = INTEGRATIONS_ENABLED && !!integrationStatus?.jobber;
  // Holds the most recent fetch range so the Realtime callback can range-filter
  // INSERT events against whatever view the user is currently looking at.
  const currentRangeRef = useRef({ start: null, end: null });
  // In-flight calendar fetch — aborted when a newer fetch supersedes it so a
  // fast prev/next burst can't resolve out of order and paint a stale range.
  const abortRef = useRef(null);
  // Realtime reconnect tracking — shared across both channels. The
  // appointments channel persists across date navigations (deps exclude
  // fetchData), so it reads the latest fetchData through a ref.
  const wasDisconnectedRef = useRef(false);
  const fetchDataRef = useRef(null);

  // Swipe gesture controls for mobile day navigation
  const dragControls = useAnimation();

  // Create popover state
  const [createPopoverOpen, setCreatePopoverOpen] = useState(false);

  // Quick-book state
  const [quickBookOpen, setQuickBookOpen] = useState(false);
  const [quickBookSlot, setQuickBookSlot] = useState(null);

  // Time block sheet state
  const [timeBlockSheetOpen, setTimeBlockSheetOpen] = useState(false);
  const [selectedTimeBlock, setSelectedTimeBlock] = useState(null); // null = create, object = edit

  // External event sheet state
  const [externalEventSheetOpen, setExternalEventSheetOpen] = useState(false);
  const [selectedExternalEvent, setSelectedExternalEvent] = useState(null);

  // Working hours editor sheet
  const [whSheetOpen, setWhSheetOpen] = useState(false);

  // Show completed toggle — persists in localStorage (hydration-safe: read in useEffect)
  const [showCompleted, setShowCompleted] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('voco_calendar_show_completed');
    if (stored !== null) setShowCompleted(stored === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('voco_calendar_show_completed', String(showCompleted));
  }, [showCompleted]);

  // Fetch working hours once on mount (stable config, rarely changes)
  function fetchWorkingHours() {
    fetch('/api/working-hours')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setWorkingHoursData(data); })
      .catch(() => {});
  }

  useEffect(() => {
    fetchWorkingHours();
  }, []);

  // Fetch tenant ID once for the Realtime subscription (user.id !== tenant.id).
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setTenantId(null); return; }
      supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single()
        .then(({ data }) => setTenantId(data?.id ?? null));
    }).catch(() => {
      setTenantId(null);
    });
  }, []);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const effectiveViewMode = viewMode;

  const fetchData = useCallback(async () => {
    // Supersede any in-flight fetch — without this, rapid prev/next clicks
    // can resolve out of order and paint a stale range over the current one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFetching(true);
    setFetchError(null);
    try {
      let start, end;
      if (effectiveViewMode === 'month') {
        // Fetch entire month (plus overflow days for the grid)
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        // Extend to cover week grid (start from Sunday of first week)
        const gridStart = new Date(firstDay);
        gridStart.setDate(gridStart.getDate() - gridStart.getDay());
        const gridEnd = new Date(lastDay);
        gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
        gridEnd.setHours(23, 59, 59);
        start = gridStart.toISOString();
        end = gridEnd.toISOString();
      } else {
        start = startOfDay(currentDate).toISOString();
        end = endOfDay(currentDate).toISOString();
      }

      // Store the active fetch range so the Realtime callback can filter
      // incoming events to only those that match the currently-displayed view.
      currentRangeRef.current = { start, end };

      const [json, blocksResult] = await Promise.all([
        fetch(`/api/appointments?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&view=${effectiveViewMode}`, { signal: controller.signal })
          .then((r) => { if (!r.ok) throw new Error('Failed to fetch'); return r.json(); }),
        fetch(`/api/calendar-blocks?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { signal: controller.signal })
          .then((r) => r.json())
          .then((d) => d.blocks || [])
          .catch((err) => {
            // Blocks are non-critical (empty fallback), but an abort must
            // win — swallowing it would paint stale data with no blocks.
            if (err?.name === 'AbortError') throw err;
            return [];
          }),
      ]);

      setData({ ...json, timeBlocks: blocksResult });
    } catch (err) {
      if (err?.name === 'AbortError') return; // superseded by a newer fetch
      // Phase 58 Plan 58-05 (POLISH-04): capture the failure so <ErrorState
      // onRetry={fetchData} /> can render a retry affordance. Keep the safe
      // empty-data fallback so inner components stay crash-free.
      setFetchError("Couldn't load your calendar. Check your connection and try again.");
      setData({ appointments: [], externalEvents: [], travelBuffers: [], conflicts: [], timeBlocks: [] });
    } finally {
      // Only the owning fetch may clear the flags — a superseded fetch's
      // finally must not stomp the newer fetch's in-progress state.
      if (abortRef.current === controller) {
        setFetching(false);
        setInitialLoading(false);
      }
    }
  }, [currentDate, effectiveViewMode]);

  // Keep the reconnect refetch pointed at the latest fetchData (its identity
  // changes with date/view) without recreating the appointments channel.
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Abort the in-flight fetch on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  // ── Supabase Realtime subscription for appointments ────────────────────
  // Keeps the calendar view in sync with AI-booked appointments from the
  // voice agent and changes made in other browser tabs. The subscription
  // persists across view-mode / date navigations (we read the latest fetch
  // range from currentRangeRef so it stays in sync with whatever the user
  // is looking at without recreating the channel).
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('calendar-appointments-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const appt = payload.new;
          if (!appt || appt.status === 'cancelled') return;
          // Range filter: only add if the appointment falls inside the
          // currently-fetched date range. Otherwise it would appear in
          // the "wrong" view until the user navigates.
          const range = currentRangeRef.current;
          if (!range.start || !range.end) return;
          const apptStart = new Date(appt.start_time).toISOString();
          if (apptStart < range.start || apptStart > range.end) return;
          setData((prev) => {
            // Dedup: the optimistic update in handleQuickBook may have
            // already added this row.
            if (prev.appointments.some((a) => a.id === appt.id)) return prev;
            return {
              ...prev,
              appointments: [...prev.appointments, appt].sort(
                (a, b) => new Date(a.start_time) - new Date(b.start_time)
              ),
            };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const appt = payload.new;
          if (!appt) return;
          setData((prev) => {
            // If the update cancelled the appointment, remove it (the GET
            // endpoint filters out cancelled rows, so keeping it would
            // drift the view out of sync).
            if (appt.status === 'cancelled') {
              return {
                ...prev,
                appointments: prev.appointments.filter((a) => a.id !== appt.id),
              };
            }
            // Replace if already in state; otherwise ignore (the update
            // landed on a row outside the current fetch range).
            const exists = prev.appointments.some((a) => a.id === appt.id);
            if (!exists) return prev;
            return {
              ...prev,
              appointments: prev.appointments
                .map((a) => (a.id === appt.id ? appt : a))
                .sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
            };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'appointments',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const id = payload.old?.id;
          if (!id) return;
          setData((prev) => ({
            ...prev,
            appointments: prev.appointments.filter((a) => a.id !== id),
          }));
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          wasDisconnectedRef.current = true;
        } else if (status === 'SUBSCRIBED' && wasDisconnectedRef.current) {
          wasDisconnectedRef.current = false;
          fetchDataRef.current?.();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  // ── Supabase Realtime subscription for calendar_events ────────────────
  // Fires on webhook-driven mirror changes (Jobber VISIT_*, Google/Outlook
  // push notifications) so the calendar reflects external edits without a
  // manual refresh. Re-fetch is simpler than surgical state patching here
  // — low write volume and each event might affect appointment/conflict
  // derivations that the GET endpoint already computes.
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`calendar-events-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          wasDisconnectedRef.current = true;
        } else if (status === 'SUBSCRIBED' && wasDisconnectedRef.current) {
          wasDisconnectedRef.current = false;
          fetchDataRef.current?.();
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, fetchData]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch('/api/calendar-sync/trigger', { method: 'POST' });
    } catch {
      // Sync failure is non-fatal — still refresh local data
    }
    await fetchData();
    setRefreshing(false);
  }

  // Navigation updates state immediately — the previous range stays on
  // screen (dimmed via the `fetching` opacity transition) until fresh data
  // lands, instead of the old fade-out → 100ms delay → skeleton choreography.
  function handleDayClick(date) {
    setCurrentDate(date);
    setViewMode('day');
  }

  function navigate(direction) {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (effectiveViewMode === 'month') {
        d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
      } else {
        d.setDate(d.getDate() + (direction === 'next' ? 1 : -1));
      }
      return d;
    });
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  const handleSwipeEnd = useCallback((event, info) => {
    const threshold = 50;
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    if (Math.abs(offset) > threshold || Math.abs(velocity) > 300) {
      const direction = (offset > 0 || velocity > 300) ? -1 : 1;
      setCurrentDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + direction);
        return d;
      });
    }
    dragControls.start({ x: 0, transition: { duration: 0.15 } });
  }, [dragControls]);

  function handleAppointmentClick(appointment) {
    setSelectedAppointment(appointment);
    setFlyoutOpen(true);
  }

  function handleCancelled(id) {
    setData((prev) => ({
      ...prev,
      appointments: prev.appointments.filter((a) => a.id !== id),
    }));
  }

  function handleStatusChange(id, newStatus) {
    // Refetch to get fresh appointment states (completed_at, etc.)
    fetchData();
  }

  function handleEmptySlotClick(slotDate) {
    setQuickBookSlot(slotDate);
    setQuickBookOpen(true);
  }

  function handleTimeBlockClick(block) {
    setSelectedTimeBlock(block);
    setTimeBlockSheetOpen(true);
  }

  async function handleTimeBlockSave({ title, date, start_time, end_time, is_all_day, note, sync_to_calendar, group_id }) {
    // Resolve times for all-day blocks using DEFAULT_START=7 / DEFAULT_END=20
    let resolvedStart, resolvedEnd;
    if (is_all_day) {
      resolvedStart = `${date}T07:00:00`;
      resolvedEnd = `${date}T20:00:00`;
    } else {
      resolvedStart = `${date}T${start_time}:00`;
      resolvedEnd = `${date}T${end_time}:00`;
    }

    try {
      if (selectedTimeBlock) {
        // Edit mode — PATCH
        const res = await fetch(`/api/calendar-blocks/${selectedTimeBlock.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, start_time: resolvedStart, end_time: resolvedEnd, is_all_day, note }),
        });
        if (!res.ok) throw new Error('Failed to update');
        const result = await res.json();
        setData((prev) => ({
          ...prev,
          timeBlocks: prev.timeBlocks.map((b) => (b.id === selectedTimeBlock.id ? result.block : b)),
        }));
      } else {
        // Create mode — POST
        const res = await fetch('/api/calendar-blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, start_time: resolvedStart, end_time: resolvedEnd, is_all_day, note, sync_to_calendar, group_id }),
        });
        if (!res.ok) throw new Error('Failed to create');
        const result = await res.json();
        setData((prev) => ({
          ...prev,
          timeBlocks: [...prev.timeBlocks, result.block],
        }));
      }
    } catch {
      throw new Error('save failed');
    }
  }

  async function handleTimeBlockDelete(id) {
    // Capture the block for undo
    const deletedBlock = data.timeBlocks.find((b) => b.id === id);

    // Optimistic remove
    setData((prev) => ({
      ...prev,
      timeBlocks: prev.timeBlocks.filter((b) => b.id !== id),
    }));
    setTimeBlockSheetOpen(false);
    setSelectedTimeBlock(null);

    try {
      const res = await fetch(`/api/calendar-blocks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Time block deleted', {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: async () => {
            if (!deletedBlock) return;
            try {
              const reRes = await fetch('/api/calendar-blocks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: deletedBlock.title,
                  start_time: deletedBlock.start_time,
                  end_time: deletedBlock.end_time,
                  is_all_day: deletedBlock.is_all_day,
                  note: deletedBlock.note,
                }),
              });
              if (!reRes.ok) throw new Error('Undo failed');
              const result = await reRes.json();
              setData((prev) => ({
                ...prev,
                timeBlocks: [...prev.timeBlocks, result.block],
              }));
            } catch {
              toast.error("Couldn't undo. Please add the block manually.");
            }
          },
        },
      });
    } catch {
      // Rollback optimistic remove
      if (deletedBlock) {
        setData((prev) => ({
          ...prev,
          timeBlocks: [...prev.timeBlocks, deletedBlock],
        }));
      }
      toast.error("Couldn't delete time block. Try again.");
    }
  }

  async function handleTimeBlockDeleteGroup(id, groupId) {
    // Find visible blocks in this group for optimistic removal
    const groupBlocks = data.timeBlocks.filter((b) => b.group_id === groupId);
    // Use group_count from API (covers blocks outside current view)
    const totalCount = groupBlocks[0]?.group_count || groupBlocks.length;

    // Optimistic remove all visible group blocks
    setData((prev) => ({
      ...prev,
      timeBlocks: prev.timeBlocks.filter((b) => b.group_id !== groupId),
    }));
    setTimeBlockSheetOpen(false);
    setSelectedTimeBlock(null);

    try {
      const res = await fetch(`/api/calendar-blocks/${id}?group=true`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success(`${totalCount} time block${totalCount !== 1 ? 's' : ''} deleted`);
      fetchData();
    } catch {
      // Rollback visible blocks
      setData((prev) => ({
        ...prev,
        timeBlocks: [...prev.timeBlocks, ...groupBlocks],
      }));
      toast.error("Couldn't delete time blocks. Try again.");
    }
  }

  async function handleQuickBook({
    caller_name, caller_phone, job_type, notes,
    service_address, postal_code, street_name, email,
    start_time, end_time, sync_to_calendar,
  }) {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caller_name,
        caller_phone,
        job_type,
        notes,
        service_address,
        postal_code,
        street_name,
        email,
        start_time,
        end_time,
        status: 'confirmed',
        sync_to_calendar,
      }),
    });
    if (!res.ok) throw new Error('Failed to book');
    const result = await res.json();
    setData((prev) => ({
      ...prev,
      appointments: prev.appointments.some((a) => a.id === result.appointment.id)
        ? prev.appointments
        : [...prev.appointments, result.appointment].sort(
            (a, b) => new Date(a.start_time) - new Date(b.start_time)
          ),
    }));
    setQuickBookOpen(false);
    toast.success('Appointment booked');
  }

  function handleReviewConflicts() {
    if (data.conflicts.length > 0) {
      const conflict = data.conflicts[0];
      const appt = data.appointments.find((a) => a.id === conflict.appointment.id);
      if (appt) {
        setSelectedAppointment(appt);
        setFlyoutOpen(true);
      }
    }
  }

  const isToday = isSameDay(currentDate, new Date());
  const dateLabel = effectiveViewMode === 'month'
    ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : formatDayLabel(currentDate);

  // Filter completed appointments client-side for the calendar view
  const filteredAppointments = showCompleted
    ? data.appointments
    : data.appointments.filter((a) => a.status !== 'completed');

  // Today's agenda — all appointments for today, sorted by time
  const todayAppts = data.appointments
    .filter((a) => isSameDay(new Date(a.start_time), new Date()))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const selectedConflict = selectedAppointment
    ? data.conflicts.find((c) => c.appointment.id === selectedAppointment.id)
    : null;

  const urgencyBorderColor = {
    emergency: 'border-l-red-400',
    routine: 'border-l-[#4F6BED]',
    urgent: 'border-l-amber-400',
  };

  const urgencyTimeColor = {
    emergency: 'text-red-500',
    routine: 'text-[#4F6BED] dark:text-[#8FA5F2]',
    urgent: 'text-amber-600',
  };

  // Phase 58 Plan 58-05 (POLISH-04): if the primary calendar fetch failed,
  // render a top-level ErrorState with Retry instead of the (now-empty)
  // calendar chrome. The fetchError is cleared on every fetchData() call, so
  // pressing retry re-enters the loading state naturally.
  if (fetchError && !fetching) {
    return (
      <div className="space-y-4" data-tour="calendar-page">
        <div className={`${card.base} p-4`}>
          <ErrorState message={fetchError} onRetry={fetchData} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-tour="calendar-page">

      {/* Conflict Banner */}
      <ConflictAlertBanner
        conflicts={data.conflicts}
        onReviewConflicts={handleReviewConflicts}
      />

      {/* Integration health (Jobber/Xero reconnect) now lives inside the
          Connections card below — see CalendarConnectionsCard. */}

      {/* Mobile Agenda Strip — "Up Next" above calendar */}
      {isMobile && todayAppts.length > 0 && effectiveViewMode === 'day' && (
        <div className={`${card.base} p-3`}>
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="size-3.5 text-[var(--brand-accent)]" />
            <h2 className="text-xs font-semibold text-foreground">Up Next</h2>
            <span className="ml-auto text-[10px] font-medium text-muted-foreground/70">
              {todayAppts.length} today
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {todayAppts.slice(0, 4).map((appt) => {
              const border = urgencyBorderColor[appt.urgency] || urgencyBorderColor.routine;
              const timeColor = urgencyTimeColor[appt.urgency] || urgencyTimeColor.routine;
              const startTime = new Date(appt.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              return (
                <button
                  key={appt.id}
                  type="button"
                  className={`shrink-0 w-[140px] text-left rounded-lg border border-border border-l-[3px] ${border} p-2 hover:bg-muted transition-colors`}
                  onClick={() => handleAppointmentClick(appt)}
                >
                  <p className={`text-[10px] font-semibold ${timeColor} leading-none mb-1`}>{startTime}</p>
                  <p className="text-xs font-semibold text-foreground truncate">{appt.caller_name}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Calendar Card (full width) ───────────────────────────── */}
      <div className={`${card.base} p-0 overflow-hidden`}>
        {/* Calendar toolbar — single row on desktop, wraps to two on mobile */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 md:px-4 py-2.5 border-b border-border/60 bg-muted">
          <div className="flex items-center gap-1.5 min-w-0">
            <Button variant="outline" size="icon" onClick={() => navigate('prev')} aria-label="Previous" className="h-8 w-8 shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate('next')} aria-label="Next" className="h-8 w-8 shrink-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToday}
              disabled={isToday}
              className="h-8 text-xs md:text-sm shrink-0"
            >
              Today
            </Button>
            <span className="text-sm md:text-base font-semibold text-foreground ml-1 tabular-nums truncate">{dateLabel}</span>
          </div>

          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-1.5">
              <Switch
                id="show-completed"
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
                aria-label="Show completed jobs on calendar"
              />
              <Label htmlFor="show-completed" className="text-xs md:text-sm text-muted-foreground whitespace-nowrap cursor-pointer hidden lg:inline">
                Show completed
              </Label>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh calendar"
              className="h-8 w-8 shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>

            <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs md:text-sm font-medium transition-colors ${effectiveViewMode === 'month' ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                onClick={() => setViewMode('month')}
              >
                Month
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs md:text-sm font-medium transition-colors border-l border-border ${effectiveViewMode === 'day' ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                onClick={() => setViewMode('day')}
              >
                Day
              </button>
            </div>

            <Popover open={createPopoverOpen} onOpenChange={setCreatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  aria-label="Create new event"
                  className="h-8 px-2.5 md:px-3 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white rounded-lg"
                >
                  <Plus className="h-4 w-4 md:mr-1.5" />
                  <span className="hidden md:inline text-sm font-medium">New</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-60 p-1.5">
                <button
                  type="button"
                  className="w-full flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-muted active:bg-muted text-left transition-colors"
                  onClick={() => {
                    setCreatePopoverOpen(false);
                    setQuickBookSlot(null);
                    setQuickBookOpen(true);
                  }}
                >
                  <div className="size-9 rounded-lg bg-[var(--brand-accent)]/[0.08] flex items-center justify-center shrink-0">
                    <UserPlus className="size-4 text-[var(--brand-accent)]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Book appointment</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Add a customer job</div>
                  </div>
                </button>
                <button
                  type="button"
                  className="w-full flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-muted active:bg-muted text-left transition-colors"
                  onClick={() => {
                    setCreatePopoverOpen(false);
                    setSelectedTimeBlock(null);
                    setTimeBlockSheetOpen(true);
                  }}
                >
                  <div className="size-9 rounded-lg bg-[var(--brand-accent)]/[0.08] flex items-center justify-center shrink-0">
                    <CalendarPlus className="size-4 text-[var(--brand-accent)]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Block time</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Lunch, personal, vacation</div>
                  </div>
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Calendar grid — swipeable on mobile day view. Background refetches
            dim the existing grid instead of swapping in a skeleton. */}
        <div className={`transition-opacity duration-150 overflow-hidden ${fetching && !initialLoading ? 'opacity-60' : 'opacity-100'}`}>
          {isMobile && effectiveViewMode === 'day' && !prefersReduced ? (
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={handleSwipeEnd}
              animate={dragControls}
              style={{ touchAction: 'pan-y' }}
            >
              <CalendarView
                appointments={filteredAppointments}
                externalEvents={data.externalEvents}
                travelBuffers={data.travelBuffers}
                timeBlocks={data.timeBlocks}
                currentDate={currentDate}
                viewMode={effectiveViewMode}
                loading={initialLoading}
                onAppointmentClick={handleAppointmentClick}
                onDayClick={handleDayClick}
                onEmptySlotClick={handleEmptySlotClick}
                onTimeBlockClick={handleTimeBlockClick}
                onExternalEventClick={(evt) => { setSelectedExternalEvent(evt); setExternalEventSheetOpen(true); }}
                workingHoursData={workingHoursData}
                isMobile={isMobile}
                jobberConnected={jobberConnected}
              />
            </motion.div>
          ) : (
            <CalendarView
              appointments={filteredAppointments}
              externalEvents={data.externalEvents}
              travelBuffers={data.travelBuffers}
              timeBlocks={data.timeBlocks}
              currentDate={currentDate}
              viewMode={effectiveViewMode}
              loading={initialLoading}
              onAppointmentClick={handleAppointmentClick}
              onDayClick={handleDayClick}
              onEmptySlotClick={handleEmptySlotClick}
              onTimeBlockClick={handleTimeBlockClick}
              onExternalEventClick={(evt) => { setSelectedExternalEvent(evt); setExternalEventSheetOpen(true); }}
              workingHoursData={workingHoursData}
              isMobile={isMobile}
              jobberConnected={jobberConnected}
            />
          )}
        </div>
      </div>

      {/* ── Bottom row: Agenda + Connections + Working Hours ──────
          One responsive grid for both breakpoints (was duplicated desktop +
          mobile markup). The agenda card is desktop-only — mobile gets the
          "Up Next" strip above the calendar instead. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Today's Agenda */}
        <div className={`${card.base} p-5 hidden md:block`}>
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="size-4 text-[var(--brand-accent)]" />
            <h2 className="text-sm font-semibold text-foreground">Today&apos;s Agenda</h2>
            {todayAppts.length > 0 && (
              <span className="ml-auto text-xs font-medium bg-foreground/[0.06] text-muted-foreground px-2 py-0.5 rounded-full">
                {todayAppts.length} appointment{todayAppts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {todayAppts.length === 0 ? (
            data.appointments.length === 0 ? (
              <EmptyStateCalendar padding="py-6" onConnect={() => setTimeBlockSheetOpen(true)} />
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CalendarOff className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-foreground">No appointments today</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Enjoy the day off.</p>
              </div>
            )
          ) : (
            <div className="space-y-2">
              {todayAppts.map((appt) => {
                const border = urgencyBorderColor[appt.urgency] || urgencyBorderColor.routine;
                const timeColor = urgencyTimeColor[appt.urgency] || urgencyTimeColor.routine;
                const startTime = new Date(appt.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                const endTime = new Date(appt.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                const addressLine = appt.street_name && appt.postal_code
                  ? `${appt.street_name}, ${appt.postal_code}`
                  : appt.service_address || '';

                return (
                  <button
                    key={appt.id}
                    type="button"
                    className={`w-full text-left rounded-lg border border-border border-l-[3px] ${border} p-3 hover:bg-muted transition-colors group`}
                    onClick={() => handleAppointmentClick(appt)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold ${timeColor} mb-0.5`}>{startTime} – {endTime}</p>
                        <p className="text-sm font-semibold text-foreground">{appt.caller_name}</p>
                        {addressLine && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{addressLine}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 group-hover:text-muted-foreground transition-colors shrink-0 mt-0.5">
                        View →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Connections — calendars + business apps, including reconnect state
            (replaces the old page-top IntegrationReconnectBanner) */}
        <CalendarConnectionsCard />

        {/* Working Hours */}
        <div className={`${card.base} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="size-4 text-[var(--brand-accent)]" />
            <h2 className="text-sm font-semibold text-foreground">Working Hours</h2>
            <button
              onClick={() => setWhSheetOpen(true)}
              className="ml-auto text-[11px] text-[var(--brand-accent)] hover:underline flex items-center gap-1"
            >
              <Pencil className="size-3" />
              Edit
            </button>
          </div>
          {workingHoursData?.working_hours ? (
            <div className="space-y-1.5">
              {summarizeWorkingHours(workingHoursData.working_hours).map((row) => (
                <div key={row.label} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{row.label}</span>
                  <span className={row.closed ? 'text-muted-foreground' : 'text-muted-foreground'}>{row.hours}</span>
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setWhSheetOpen(true)}
              className="w-full py-6 text-center"
            >
              <Clock className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Not configured</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Tap to set your availability</p>
            </button>
          )}
        </div>
      </div>

      {/* Appointment Flyout */}
      <AppointmentFlyout
        appointment={selectedAppointment}
        conflict={selectedConflict}
        open={flyoutOpen}
        onOpenChange={setFlyoutOpen}
        onCancelled={handleCancelled}
        onStatusChange={handleStatusChange}
        jobberConnected={jobberConnected}
      />

      {/* Time Block Sheet */}
      <TimeBlockSheet
        open={timeBlockSheetOpen}
        onOpenChange={setTimeBlockSheetOpen}
        selectedBlock={selectedTimeBlock}
        onSave={handleTimeBlockSave}
        onDelete={handleTimeBlockDelete}
        onDeleteGroup={handleTimeBlockDeleteGroup}
        isMobile={isMobile}
      />

      {/* External Event Sheet */}
      <ExternalEventSheet
        event={selectedExternalEvent}
        open={externalEventSheetOpen}
        onOpenChange={setExternalEventSheetOpen}
        isMobile={isMobile}
      />

      {/* Quick-book Sheet */}
      <QuickBookSheet
        open={quickBookOpen}
        onOpenChange={setQuickBookOpen}
        slotDate={quickBookSlot}
        onSave={handleQuickBook}
        isMobile={isMobile}
      />

      {/* Working Hours Editor Sheet */}
      <Sheet open={whSheetOpen} onOpenChange={(open) => {
        setWhSheetOpen(open);
        if (!open) fetchWorkingHours(); // re-fetch after closing to update summary + calendar grid
      }}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[85vh] rounded-t-2xl overflow-y-auto" : "sm:max-w-lg overflow-y-auto"}>
          <SheetHeader>
            <SheetTitle>Working Hours</SheetTitle>
            <p className="text-sm text-muted-foreground">Set when you&apos;re available so your AI only books open slots.</p>
          </SheetHeader>
          <div className="px-6 py-4">
            <WorkingHoursEditor />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
