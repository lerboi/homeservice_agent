'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarIcon, Clock, Check, CalendarOff } from 'lucide-react';

const HOUR_HEIGHT_WEEK = 64;
const HOUR_HEIGHT_DAY = 48;
const DEFAULT_START = 7;
const DEFAULT_END = 20;

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const URGENCY_STYLES = {
  emergency: {
    block: 'bg-red-50 dark:bg-red-950/30 border-l-[3px] border-red-400 dark:border-red-500 hover:bg-red-100/70 dark:hover:bg-red-900/40',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    time: 'text-red-500 dark:text-red-300',
    name: 'text-red-900 dark:text-red-200',
  },
  routine: {
    block: 'bg-[#F0F4FF] dark:bg-[#1E2A4A] border-l-[3px] border-[#4F6BED] hover:bg-[#E8EFFE] dark:hover:bg-[#243663]',
    badge: 'bg-[#4F6BED]/10 dark:bg-[#4F6BED]/20 text-[#4F6BED] dark:text-[#8FA5F2]',
    time: 'text-[#4F6BED] dark:text-[#8FA5F2]',
    name: 'text-foreground',
  },
  urgent: {
    block: 'bg-amber-50 dark:bg-amber-950/30 border-l-[3px] border-amber-400 dark:border-amber-500 hover:bg-amber-100/70 dark:hover:bg-amber-900/40',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    time: 'text-amber-600 dark:text-amber-300',
    name: 'text-amber-900 dark:text-amber-200',
  },
};

const URGENCY_LABEL = {
  emergency: 'Emergency',
  routine: 'Routine',
  urgent: 'Urgent',
};

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

// Local-day boundary helpers for multi-day event classification + rendering.
function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// A Jobber/Google/Outlook event is "multi-day" when it's an explicit all-day
// event OR it crosses a local-day boundary (e.g. a long service window, an
// overnight emergency visit, a multi-day installation). Such events render
// in the all-day strip on every day they span — same convention as Google
// Calendar / Outlook — instead of being crushed into the timed grid.
function isMultiDayEvent(event) {
  if (event.is_all_day) return true;
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  return !isSameDay(start, end);
}

// Where does `day` fall within `event`'s multi-day span?
//   - 'single'  event spans only this one day
//   - 'first'   day is first day of the span (but not the last)
//   - 'middle'  day is interior to the span
//   - 'last'    day is last day of the span (but not the first)
//   - null      event does not include this day
function daySpanPosition(event, day) {
  const dayStart = startOfLocalDay(day);
  const eventStart = startOfLocalDay(new Date(event.start_time));
  const eventEnd = startOfLocalDay(new Date(event.end_time));
  if (dayStart < eventStart || dayStart > eventEnd) return null;
  const isFirst = isSameDay(dayStart, eventStart);
  const isLast = isSameDay(dayStart, eventEnd);
  if (isFirst && isLast) return 'single';
  if (isFirst) return 'first';
  if (isLast) return 'last';
  return 'middle';
}

/**
 * Lane-assignment (interval graph coloring) for overlapping calendar events.
 *
 * Day / Week views render overlapping events side-by-side by splitting the column
 * width (same behavior as Google Calendar / Outlook). This function takes a flat
 * array of typed wrappers `{ item, type }` and returns each one annotated with
 * `{ laneIndex, laneCount }`:
 *   - laneIndex: 0-based horizontal slot (0 = leftmost)
 *   - laneCount: total lanes used by the event's overlap cluster, so
 *     width = 100% / laneCount for every event in that cluster.
 *
 * Appointments and timed external events MUST be laid out in the same call so
 * that an appointment at 9am and a Google Calendar event at 9am get distinct
 * lanes (never collapse onto each other). Travel buffers are NOT laid out here —
 * they remain full-column-width background decorations behind the foreground
 * event blocks.
 *
 * Pure function — never mutates the caller's `item` objects.
 */
function layoutEventsInLanes(wrappers) {
  if (!wrappers || wrappers.length === 0) return [];

  // 1. Normalize — compute numeric start/end ms, guard against bad data
  const normalized = wrappers.map((w) => {
    const startMs = Date.parse(w.item.start_time);
    let endMs = Date.parse(w.item.end_time);
    if (!(endMs > startMs)) endMs = startMs + 1;
    return { ...w, _startMs: startMs, _endMs: endMs };
  });

  // 2. Sort ascending by start, tie-break by end descending (longer events first)
  normalized.sort((a, b) => {
    if (a._startMs !== b._startMs) return a._startMs - b._startMs;
    return b._endMs - a._endMs;
  });

  // 3. Pack lanes: lanes[i] = current end time of event occupying lane i
  const lanes = [];
  for (const w of normalized) {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] <= w._startMs) {
        lanes[i] = w._endMs;
        w.laneIndex = i;
        placed = true;
        break;
      }
    }
    if (!placed) {
      w.laneIndex = lanes.length;
      lanes.push(w._endMs);
    }
  }

  // 4. Detect clusters of transitively overlapping events
  const clusters = [];
  let currentCluster = [];
  let clusterEndMax = -Infinity;
  for (const w of normalized) {
    if (w._startMs >= clusterEndMax) {
      if (currentCluster.length > 0) clusters.push(currentCluster);
      currentCluster = [w];
      clusterEndMax = w._endMs;
    } else {
      currentCluster.push(w);
      if (w._endMs > clusterEndMax) clusterEndMax = w._endMs;
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  // 5. Assign laneCount per cluster (shared across the cluster for consistent widths)
  for (const cluster of clusters) {
    let maxLane = 0;
    for (const w of cluster) {
      if (w.laneIndex > maxLane) maxLane = w.laneIndex;
    }
    const laneCount = maxLane + 1;
    for (const w of cluster) {
      w.laneCount = laneCount;
    }
  }

  // Strip internal ms fields before returning
  return normalized.map(({ _startMs, _endMs, ...rest }) => rest);
}

/**
 * Return { left, width } CSS calc() strings for a lane in a multi-lane column.
 * For laneCount=1, this reproduces the existing `left-1 right-1` (4px desktop)
 * / `left-0.5 right-0.5` (2px mobile) Tailwind classes pixel-for-pixel, so
 * single-event layouts are unchanged from today.
 */
function getLaneLayout(laneIndex, laneCount, isMobile) {
  const outerMargin = isMobile ? 2 : 4;
  const laneGap = laneCount > 1 ? 2 : 0;
  const slotFormula = `(100% - ${2 * outerMargin}px - ${(laneCount - 1) * laneGap}px) / ${laneCount}`;
  return {
    left: `calc(${outerMargin}px + ${laneIndex} * (${slotFormula}) + ${laneIndex * laneGap}px)`,
    width: `calc(${slotFormula})`,
  };
}

function getWeekDays(date) {
  const d = new Date(date);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + i);
    return dayDate;
  });
}

const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(h, mobile) {
  if (mobile) {
    if (h === 0 || h === 12) return h === 0 ? '12a' : '12p';
    return h < 12 ? `${h}a` : `${h - 12}p`;
  }
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function formatTimeRange(startTime, endTime) {
  const fmt = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${fmt(new Date(startTime))} – ${fmt(new Date(endTime))}`;
}

function parseHourMin(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return { h, m, totalMins: h * 60 + m };
}

function getDayConfig(dayDate, workingHours) {
  if (!workingHours) return null;
  const key = DAY_KEYS[dayDate.getDay()];
  return workingHours[key] || null;
}

function isWorkingHour(dayDate, hour, workingHours) {
  const config = getDayConfig(dayDate, workingHours);
  if (!config || !config.enabled) return false;
  const open = parseHourMin(config.open);
  const close = parseHourMin(config.close);
  const hourStart = hour * 60;
  const hourEnd = (hour + 1) * 60;
  return hourStart < close.totalMins && hourEnd > open.totalMins;
}

function isOutsideWorkingHours(appointment, workingHours) {
  if (!workingHours) return false;
  const start = new Date(appointment.start_time);
  const end = new Date(appointment.end_time);
  const config = getDayConfig(start, workingHours);
  if (!config || !config.enabled) return true;
  const open = parseHourMin(config.open);
  const close = parseHourMin(config.close);
  const apptStartMins = start.getHours() * 60 + start.getMinutes();
  const apptEndMins = end.getHours() * 60 + end.getMinutes();
  return apptStartMins < open.totalMins || apptEndMins > close.totalMins;
}

function CurrentTimeIndicator({ gridStartHour, gridEndHour, hourHeight = HOUR_HEIGHT_WEEK }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const mins = now.getHours() * 60 + now.getMinutes() - gridStartHour * 60;
  if (mins < 0 || mins > (gridEndHour - gridStartHour) * 60) return null;

  const top = (mins / 60) * hourHeight;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="relative w-full border-t-2 border-[var(--brand-accent)]">
        <div className="absolute -left-1.5 -top-[5px] w-2.5 h-2.5 rounded-full bg-[var(--brand-accent)]" />
      </div>
    </div>
  );
}

function AppointmentBlock({ appointment, onClick, isOffHours, isMobile, getPositionStyle, laneIndex = 0, laneCount = 1, jobberConnected = false }) {
  const style = getPositionStyle(appointment.start_time, appointment.end_time);
  const isCompleted = appointment.status === 'completed';
  const urgency = appointment.urgency || 'routine';
  const styles = URGENCY_STYLES[urgency] || URGENCY_STYLES.routine;
  const heightPx = parseInt(style.height, 10);
  const minHeight = isMobile ? 44 : 28;
  const laneStyle = getLaneLayout(laneIndex, laneCount, isMobile);
  const finalStyle = { ...style, ...laneStyle, height: `${Math.max(heightPx, minHeight)}px` };
  const effectiveHeight = Math.max(heightPx, minHeight);
  const isNarrow = laneCount >= 3;
  const isCompact = effectiveHeight < 52 || isNarrow;
  const isVeryCompact = effectiveHeight < 36 || (isNarrow && effectiveHeight < 64);

  // Wrap existing block class with opacity-40 when completed
  const blockClass = isCompleted
    ? `${styles.block} opacity-40`
    : styles.block;

  const addressLine = appointment.street_name && appointment.postal_code
    ? `${appointment.street_name}, ${appointment.postal_code}`
    : appointment.service_address || '';

  return (
    <button
      type="button"
      className={`absolute rounded-md px-2 overflow-hidden cursor-pointer transition-all shadow-sm hover:shadow-md ${blockClass}`}
      style={finalStyle}
      onClick={(e) => { e.stopPropagation(); onClick(appointment); }}
    >
      {/* Off-hours indicator */}
      {isOffHours && (
        <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-muted/80 flex items-center justify-center z-10" title="Outside working hours">
          <Clock className="w-2.5 h-2.5 text-muted-foreground" />
        </div>
      )}

      {/* Phase 57 (JOBSCHED-06): "Not in Jobber" pill on Voco-booked appointments
          when Jobber is connected and the appointment hasn't been pushed yet.
          Pill switches off automatically once Phase 999.3 populates jobber_visit_id (D-13). */}
      {jobberConnected && !appointment.jobber_visit_id && !isOffHours && effectiveHeight >= 44 && (
        <span
          role="status"
          className="absolute top-1 right-1 inline-flex items-center rounded-full px-1 py-1 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700"
        >
          Not in Jobber
        </span>
      )}

      {/* Completed checkmark badge */}
      {isCompleted && (
        <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="w-[10px] h-[10px] text-green-700" />
        </div>
      )}

      {isVeryCompact ? (
        <div className="flex items-center gap-1.5 h-full">
          <span className={`text-[11px] font-semibold truncate ${styles.name}`}>{appointment.caller_name}</span>
          <span className={`text-[10px] shrink-0 ${styles.time}`}>
            {new Date(appointment.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
      ) : isCompact ? (
        <div className="flex items-start gap-1 pt-1">
          <div className="min-w-0 flex-1">
            <div className={`text-[10px] font-medium leading-none mb-0.5 ${styles.time}`}>
              {new Date(appointment.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
            <div className={`text-xs font-semibold leading-tight truncate ${styles.name}`}>{appointment.caller_name}</div>
          </div>
          <span className={`text-[9px] px-1 py-0.5 rounded-full shrink-0 font-medium ${styles.badge}`}>
            {URGENCY_LABEL[urgency]?.[0]}
          </span>
        </div>
      ) : (
        <div className="flex flex-col h-full py-1.5 gap-0.5">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              <div className={`text-[10px] font-semibold leading-none mb-1 ${styles.time}`}>
                {formatTimeRange(appointment.start_time, appointment.end_time)}
              </div>
              <div className={`text-sm font-bold leading-tight truncate ${styles.name}`}>
                {appointment.caller_name}
              </div>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-semibold leading-tight ${styles.badge}`}>
              {URGENCY_LABEL[urgency]}
            </span>
          </div>
          {effectiveHeight >= 80 && addressLine && (
            <div className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">{addressLine}</div>
          )}
          {effectiveHeight >= 96 && (appointment.notes) && (
            <div className="text-[11px] text-muted-foreground truncate leading-tight">{appointment.notes}</div>
          )}
        </div>
      )}
    </button>
  );
}

function TimeBlockEvent({ block, onBlockClick, isMobile, getPositionStyle }) {
  const style = getPositionStyle(block.start_time, block.end_time);
  const heightPx = parseInt(style.height, 10);
  const margin = isMobile ? 2 : 4;
  const timeLabel = formatTimeRange(block.start_time, block.end_time);

  return (
    <button
      type="button"
      className="absolute rounded-md overflow-hidden cursor-pointer bg-amber-50/70 border border-amber-200/80 border-l-[3px] border-l-amber-400 hover:bg-amber-100/80 transition-colors"
      style={{
        top: style.top,
        height: style.height,
        left: `${margin}px`,
        right: `${margin}px`,
        zIndex: 1,
      }}
      onClick={(e) => { e.stopPropagation(); onBlockClick(block); }}
    >
      <div className="h-full px-2 py-1 flex flex-col justify-center">
        <div className="flex items-center gap-1">
          <CalendarOff className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="text-xs font-medium text-amber-800 truncate">{block.title}</span>
        </div>
        {heightPx >= 44 && (
          <span className="text-[10px] text-amber-500 mt-0.5 ml-4">{timeLabel}</span>
        )}
      </div>
    </button>
  );
}

function TravelBufferBlock({ buffer, getPositionStyle }) {
  const style = getPositionStyle(buffer.start_time, buffer.end_time);

  return (
    <div
      className="absolute left-1 right-1 bg-muted border border-dashed border-border rounded pointer-events-none flex items-center justify-center"
      style={style}
    >
      <span className="text-[10px] text-muted-foreground font-medium">Travel buffer</span>
    </div>
  );
}

// Phase 57: unified muted-slate surface for all external providers + provider pill.
// Jobber blocks deep-link to the Jobber calendar in a new tab and DO NOT open the
// Voco AppointmentFlyout (UI-SPEC §1).
const PROVIDER_LABELS = {
  jobber: 'From Jobber',
  google: 'From Google',
  outlook: 'From Outlook',
};
const PROVIDER_PILL_CLASSES = {
  jobber: 'bg-[#1B9F4F]/10 text-[#1B9F4F] dark:bg-[#1B9F4F]/20 dark:text-emerald-300',
  google: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-300',
  outlook: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300',
};

// Muted slate body + provider-accented left rail — matches the timed
// ExternalEventBlock surface so the all-day strip feels like the same
// family of events, just horizontally laid out.
const PROVIDER_ALL_DAY_CLASSES = {
  jobber:  'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 border-l-[3px] border-l-[#1B9F4F]',
  google:  'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 border-l-[3px] border-l-violet-500',
  outlook: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 border-l-[3px] border-l-blue-500',
};

// Multi-day event chip for the all-day strip. Uses position-aware rounding
// and chevrons so a span across day columns reads as one continuous bar —
// the same pattern Google Calendar and Outlook use. The provider pill only
// renders on the first/single-day chip to keep middle/end chips uncluttered.
function AllDayExternalEventChip({ event, position, onExternalEventClick }) {
  const provider = event.provider ?? 'other';
  const providerLabel = PROVIDER_LABELS[provider] ?? `From ${provider}`;
  const providerPillClass = PROVIDER_PILL_CLASSES[provider] ?? 'bg-slate-100 text-slate-600';
  const surfaceClass = PROVIDER_ALL_DAY_CLASSES[provider]
    ?? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 border-l-[3px] border-l-slate-400';

  const rounding =
    position === 'single' ? 'rounded-md'
    : position === 'first' ? 'rounded-l-md rounded-r-none border-r-0'
    : position === 'last' ? 'rounded-r-md rounded-l-none border-l-0 border-l-transparent'
    : 'rounded-none border-l-0 border-r-0 border-l-transparent'; // middle

  const showTitle = position === 'single' || position === 'first';
  const showContinuesChevronLeft = position === 'middle' || position === 'last';
  const showContinuesChevronRight = position === 'first' || position === 'middle';
  const showProviderPill = position === 'single' || position === 'first';

  const handleClick = (e) => {
    e.stopPropagation();
    if (provider === 'jobber') {
      const date = String(event.start_time || '').slice(0, 10);
      const url = date
        ? `https://secure.getjobber.com/calendar?date=${date}`
        : 'https://secure.getjobber.com/calendar';
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    onExternalEventClick?.(event);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${event.title} — ${providerLabel}${position !== 'single' ? ' (multi-day)' : ''}`}
      className={`w-full min-h-[32px] flex items-center gap-1.5 px-2 py-1 text-xs text-foreground border hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer text-left overflow-hidden ${surfaceClass} ${rounding}`}
    >
      {showContinuesChevronLeft && (
        <span aria-hidden="true" className="text-muted-foreground/70 shrink-0 text-[10px]">◄</span>
      )}
      {showTitle ? (
        <span className="font-medium truncate flex-1">{event.title}</span>
      ) : (
        <span className="flex-1" />
      )}
      {showProviderPill && (
        <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${providerPillClass}`}>
          {providerLabel}
        </span>
      )}
      {showContinuesChevronRight && (
        <span aria-hidden="true" className="text-muted-foreground/70 shrink-0 text-[10px]">►</span>
      )}
    </button>
  );
}

function ExternalEventBlock({ event, getPositionStyle, laneIndex = 0, laneCount = 1, isMobile = false, onClick }) {
  const style = getPositionStyle(event.start_time, event.end_time);
  const heightPx = parseInt(style.height, 10);
  const laneStyle = getLaneLayout(laneIndex, laneCount, isMobile);

  const providerLabel = PROVIDER_LABELS[event.provider] ?? `From ${event.provider}`;
  const providerPillClass = PROVIDER_PILL_CLASSES[event.provider] ?? 'bg-slate-100 text-slate-600';

  const handleClick = (e) => {
    e.stopPropagation();
    if (event.provider === 'jobber') {
      const date = String(event.start_time || '').slice(0, 10);
      const url = date
        ? `https://secure.getjobber.com/calendar?date=${date}`
        : 'https://secure.getjobber.com/calendar';
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      type="button"
      aria-label={`${event.title} — ${providerLabel} event`}
      className="absolute bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 border-l-[3px] border-l-slate-300 dark:border-l-slate-600 rounded-md px-2 py-1 overflow-hidden shadow-sm cursor-pointer opacity-75 hover:opacity-90 hover:shadow-sm transition-all text-left z-[5]"
      style={{ ...style, ...laneStyle }}
      onClick={handleClick}
    >
      <div className="text-xs font-medium text-foreground truncate leading-tight">{event.title}</div>
      {heightPx >= 36 && (
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium mt-0.5 ${providerPillClass}`}>
          {providerLabel}
        </span>
      )}
    </button>
  );
}

function LunchBreakOverlay({ dayDate, workingHours, gridStartHour, hourHeight = HOUR_HEIGHT_WEEK }) {
  const config = getDayConfig(dayDate, workingHours);
  if (!config?.enabled || !config.lunchStart || !config.lunchEnd) return null;

  const ls = parseHourMin(config.lunchStart);
  const le = parseHourMin(config.lunchEnd);
  const topMins = ls.totalMins - gridStartHour * 60;
  const heightMins = le.totalMins - ls.totalMins;
  if (heightMins <= 0) return null;

  return (
    <div
      className="absolute left-0 right-0 bg-muted/60 border-y border-dashed border-border/80 pointer-events-none z-[1] flex items-center justify-center"
      style={{
        top: `${(topMins / 60) * hourHeight}px`,
        height: `${(heightMins / 60) * hourHeight}px`,
      }}
    >
      <span className="text-[10px] text-muted-foreground font-medium tracking-wide">Lunch</span>
    </div>
  );
}

function AllDayEvents({ events }) {
  if (!events || events.length === 0) return null;
  const visible = events.slice(0, 2);
  const remaining = events.length - 2;

  return (
    <div className="flex flex-wrap gap-1 px-1.5 py-1 min-h-[26px]">
      {visible.map((e) => (
        <div key={e.id} className="bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 text-[10px] text-violet-600 font-medium truncate max-w-full">
          {e.title}
        </div>
      ))}
      {remaining > 0 && (
        <span className="text-[10px] text-muted-foreground self-center">+{remaining}</span>
      )}
    </div>
  );
}

function LoadingSkeleton({ viewMode }) {
  const cols = viewMode === 'week' ? 7 : 1;
  const hours = Array.from({ length: DEFAULT_END - DEFAULT_START }, (_, i) => DEFAULT_START + i);
  return (
    <div className={`grid grid-cols-[56px_repeat(${cols},1fr)] min-w-[640px]`}>
      <div className="border-b border-border" />
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="border-b border-l border-border py-3 px-2">
          <Skeleton className="h-3 w-6 mx-auto mb-1" />
          <Skeleton className="h-6 w-6 mx-auto rounded-full" />
        </div>
      ))}
      <div className="relative col-span-1" style={{ height: `${hours.length * HOUR_HEIGHT_WEEK}px` }}>
        {hours.map((h) => (
          <div key={h} className="absolute left-0 right-0 border-b border-border" style={{ top: `${(h - DEFAULT_START) * HOUR_HEIGHT_WEEK}px`, height: `${HOUR_HEIGHT_WEEK}px` }} />
        ))}
      </div>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="relative border-l border-border" style={{ height: `${hours.length * HOUR_HEIGHT_WEEK}px` }}>
          {i === 0 && <Skeleton className="absolute left-2 right-2 rounded-md" style={{ top: 64, height: 96 }} />}
          {i === 2 && <Skeleton className="absolute left-2 right-2 rounded-md" style={{ top: 192, height: 64 }} />}
          {i === 4 && <Skeleton className="absolute left-2 right-2 rounded-md" style={{ top: 320, height: 128 }} />}
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <CalendarIcon className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <h3 className="text-base font-semibold text-foreground mb-1">No appointments this week</h3>
      <p className="text-sm text-muted-foreground">Appointments booked by your AI will appear here.</p>
    </div>
  );
}

export default function CalendarView({
  appointments = [],
  externalEvents = [],
  travelBuffers = [],
  timeBlocks = [],
  currentDate,
  viewMode = 'week',
  loading = false,
  onAppointmentClick,
  onDayClick,
  onEmptySlotClick,
  onTimeBlockClick,
  onExternalEventClick,
  workingHoursData = null,
  isMobile = false,
  jobberConnected = false,
}) {
  const today = new Date();
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const columns = viewMode === 'week' ? weekDays : [new Date(currentDate)];
  const scrollRef = useRef(null);
  const hasScrolled = useRef(false);

  const workingHours = workingHoursData?.working_hours || null;

  // Day view uses shorter hour rows for better density
  const hourHeight = viewMode === 'day' ? HOUR_HEIGHT_DAY : HOUR_HEIGHT_WEEK;

  // Compute dynamic grid range — adapt to working hours with ±1 hour padding.
  // Only appointments (user's own bookings) expand the range. External events
  // (Google/Outlook) render wherever they fall but don't stretch the grid —
  // a late-night flight shouldn't add 6 empty hours to the calendar.
  const { gridStartHour, gridEndHour } = useMemo(() => {
    let earliest = DEFAULT_START;
    let latest = DEFAULT_END;

    if (workingHours) {
      for (const config of Object.values(workingHours)) {
        if (config?.enabled) {
          const open = parseHourMin(config.open);
          const close = parseHourMin(config.close);
          earliest = Math.min(earliest, open.h);
          latest = Math.max(latest, close.m > 0 ? close.h + 1 : close.h);
        }
      }
    }

    // Only appointments and travel buffers expand the grid (not external events)
    for (const item of [...appointments, ...travelBuffers]) {
      const s = new Date(item.start_time);
      const e = new Date(item.end_time);
      earliest = Math.min(earliest, s.getHours());
      latest = Math.max(latest, e.getMinutes() > 0 ? e.getHours() + 1 : e.getHours());
    }

    return {
      gridStartHour: Math.max(0, earliest - 1),
      gridEndHour: Math.min(24, latest + 1),
    };
  }, [workingHours, appointments, externalEvents, travelBuffers]);

  const hours = useMemo(
    () => Array.from({ length: gridEndHour - gridStartHour }, (_, i) => gridStartHour + i),
    [gridStartHour, gridEndHour],
  );

  const getPositionStyle = useCallback((startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const startMins = start.getHours() * 60 + start.getMinutes() - gridStartHour * 60;
    const endMins = end.getHours() * 60 + end.getMinutes() - gridStartHour * 60;
    const top = (Math.max(startMins, 0) / 60) * hourHeight;
    const height = Math.max(((Math.min(endMins, (gridEndHour - gridStartHour) * 60) - Math.max(startMins, 0)) / 60) * hourHeight, 28);
    return { top: `${top}px`, height: `${height}px` };
  }, [gridStartHour, gridEndHour, hourHeight]);

  // An event is rendered in the all-day strip when it's flagged all-day OR
  // when it crosses a day boundary (overnight / multi-day jobs). Otherwise
  // the timed grid compresses a cross-midnight event into whatever fits in
  // day-1's column — unreadable and hides the visit entirely on day 2+.
  const { allDayEvents, timedExternalEvents } = useMemo(() => ({
    allDayEvents:        externalEvents.filter(isMultiDayEvent),
    timedExternalEvents: externalEvents.filter((e) => !isMultiDayEvent(e)),
  }), [externalEvents]);

  // Separate all-day time blocks from timed time blocks
  const { allDayBlocks, timedBlocks } = useMemo(() => ({
    allDayBlocks: timeBlocks.filter((b) => b.is_all_day),
    timedBlocks:  timeBlocks.filter((b) => !b.is_all_day),
  }), [timeBlocks]);

  // Pre-compute lane assignments per day so overlapping appointments and timed
  // external events render side-by-side instead of stacking on top of each other.
  // See layoutEventsInLanes() for the algorithm.
  const layoutByDay = useMemo(() => {
    const map = new Map();
    for (const day of columns) {
      const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
      const dayAppts = appointments.filter((a) => isSameDay(new Date(a.start_time), day));
      const dayExt   = timedExternalEvents.filter((e) => isSameDay(new Date(e.start_time), day));
      map.set(key, layoutEventsInLanes([
        ...dayAppts.map((item) => ({ item, type: 'appt' })),
        ...dayExt.map((item)   => ({ item, type: 'ext'  })),
      ]));
    }
    return map;
  }, [columns, appointments, timedExternalEvents]);

  // Auto-scroll to relevant time after load
  useEffect(() => {
    if (loading || !scrollRef.current || hasScrolled.current) return;
    hasScrolled.current = true;

    const now = new Date();
    let targetHour;

    const todayVisible = columns.some((col) => isSameDay(col, now));
    if (todayVisible) {
      targetHour = Math.max(now.getHours() - 1, gridStartHour);
    } else if (appointments.length > 0) {
      const sorted = [...appointments].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      targetHour = Math.max(new Date(sorted[0].start_time).getHours() - 1, gridStartHour);
    } else if (workingHours) {
      // Scroll to earliest working hour
      let earliestWork = gridEndHour;
      for (const config of Object.values(workingHours)) {
        if (config?.enabled) {
          earliestWork = Math.min(earliestWork, parseHourMin(config.open).h);
        }
      }
      targetHour = Math.max(earliestWork - 1, gridStartHour);
    } else {
      targetHour = gridStartHour;
    }

    const scrollTop = (targetHour - gridStartHour) * hourHeight;
    scrollRef.current.scrollTop = scrollTop;
  }, [loading, columns, appointments, gridStartHour, gridEndHour, workingHours]);

  // Reset scroll flag when date/view changes
  useEffect(() => {
    hasScrolled.current = false;
  }, [currentDate, viewMode]);

  if (loading) return <LoadingSkeleton viewMode={viewMode} />;

  // ── Month view ──────────────────────────────────────────────────────────
  if (viewMode === 'month') {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0=Sun

    // Build 6-week grid (42 cells), partitioned into week rows for the
    // continuous multi-day bar layout (Google Calendar pattern).
    const gridStart = new Date(firstDay);
    gridStart.setDate(gridStart.getDate() - startOffset);
    const weekRows = [];
    for (let w = 0; w < 6; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(gridStart);
        cellDate.setDate(gridStart.getDate() + w * 7 + d);
        const dayAppts = appointments.filter((a) => isSameDay(new Date(a.start_time), cellDate));
        // Only SINGLE-day external events render inside day cells. Multi-day
        // events are drawn as continuous bars spanning the week row below.
        const dayExternal = externalEvents.filter(
          (e) => !isMultiDayEvent(e) && isSameDay(new Date(e.start_time), cellDate),
        );
        const dayBlocks = timeBlocks.filter((b) => isSameDay(new Date(b.start_time), cellDate));
        week.push({ date: cellDate, appointments: dayAppts, externalEvents: dayExternal, timeBlocks: dayBlocks });
      }
      weekRows.push(week);
    }

    const multiDayExternals = externalEvents.filter(isMultiDayEvent);

    // Compute absolutely-positioned bars for each week row. A single event
    // spanning week boundaries produces one bar per week row (with
    // `continuesLeft` / `continuesRight` flags for chevron rendering).
    // Lanes are packed greedily so overlapping bars stack vertically.
    const BAR_HEIGHT = 18;
    const BAR_GAP = 2;
    const BAR_TOP_OFFSET = 28; // below day-number circle
    const weekRowBars = weekRows.map((week) => {
      const weekStart = startOfLocalDay(week[0].date);
      const weekEnd = startOfLocalDay(week[6].date);
      const bars = [];
      for (const event of multiDayExternals) {
        const eStart = startOfLocalDay(new Date(event.start_time));
        const eEnd = startOfLocalDay(new Date(event.end_time));
        if (eEnd < weekStart || eStart > weekEnd) continue;
        const clampedStart = eStart < weekStart ? weekStart : eStart;
        const clampedEnd = eEnd > weekEnd ? weekEnd : eEnd;
        const startCol = week.findIndex((c) => isSameDay(c.date, clampedStart));
        const endCol = week.findIndex((c) => isSameDay(c.date, clampedEnd));
        if (startCol < 0 || endCol < 0) continue;
        bars.push({
          event,
          startCol,
          endCol,
          continuesLeft: eStart < weekStart,
          continuesRight: eEnd > weekEnd,
        });
      }
      // Sort: start earliest first, ties broken by longer span (for stable
      // packing — long bars claim low lanes so short ones can tuck beside).
      bars.sort(
        (a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol),
      );
      const laneEnd = []; // laneEnd[i] = last occupied column in lane i
      for (const bar of bars) {
        let lane = 0;
        while (laneEnd[lane] !== undefined && laneEnd[lane] >= bar.startCol) lane++;
        bar.lane = lane;
        laneEnd[lane] = bar.endCol;
      }
      const maxLane = bars.reduce((m, b) => Math.max(m, b.lane), -1);
      return { bars, maxLane };
    });

    return (
      <div className="p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Date grid — one relative week row per 7 cells so multi-day
            bars can be absolutely positioned above the cell content. */}
        <div className="border border-border rounded-lg overflow-hidden">
          {weekRows.map((week, wi) => {
            const { bars, maxLane } = weekRowBars[wi];
            const barsBlockPx = (maxLane + 1) * (BAR_HEIGHT + BAR_GAP);
            const cellPaddingTop = barsBlockPx > 0 ? BAR_TOP_OFFSET + barsBlockPx : 4;
            return (
              <div
                key={wi}
                className="relative grid grid-cols-7 border-b border-border last:border-b-0"
              >
                {week.map((cell, ci) => {
                  const isCurrentMonth = cell.date.getMonth() === month;
                  const isTodayCell = isSameDay(cell.date, today);
                  const totalCount = cell.appointments.length + cell.externalEvents.length;
                  const hasBlocks = cell.timeBlocks.length > 0;
                  const allItems = [
                    ...cell.appointments.map((a) => ({ ...a, _type: 'appt' })),
                    ...cell.externalEvents.map((e) => ({ ...e, _type: 'ext' })),
                  ].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
                  return (
                    <button
                      key={ci}
                      type="button"
                      onClick={() => onDayClick?.(new Date(cell.date))}
                      style={{ paddingTop: `${cellPaddingTop}px` }}
                      className={`
                        relative min-h-[96px] px-1.5 pb-1.5 text-left border-r border-border last:border-r-0 transition-colors
                        ${hasBlocks && isCurrentMonth ? 'bg-muted' : isCurrentMonth ? 'bg-card hover:bg-muted' : 'bg-muted/50 hover:bg-muted/50'}
                        ${isTodayCell ? 'ring-1 ring-inset ring-[var(--brand-accent)]/30' : ''}
                      `}
                    >
                      <span
                        className={`
                          absolute top-1.5 left-1.5 inline-flex items-center justify-center text-xs font-medium rounded-full size-6
                          ${isTodayCell ? 'bg-[var(--brand-accent)] text-white' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}
                        `}
                      >
                        {cell.date.getDate()}
                      </span>
                      {hasBlocks && (
                        <div className="space-y-0.5">
                          {cell.timeBlocks.slice(0, 1).map((block) => (
                            <div
                              key={`tb-${block.id}`}
                              className="text-[9px] leading-tight truncate px-1 py-0.5 rounded font-medium bg-muted text-muted-foreground"
                            >
                              {block.title}
                            </div>
                          ))}
                        </div>
                      )}
                      {totalCount > 0 && (
                        <div className={`${hasBlocks ? 'mt-0.5' : ''} space-y-0.5`}>
                          {allItems.slice(0, hasBlocks ? 1 : 2).map((item) => {
                            const label = item._type === 'ext'
                              ? (item.title || 'Event')
                              : (item.caller_name || item.job_type || 'Appt');
                            const time = item.is_all_day
                              ? null
                              : new Date(item.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                            const isCompleted = item._type === 'appt' && item.status === 'completed';
                            return (
                              <div
                                key={item.id || item.external_id}
                                className={`text-[9px] leading-tight truncate px-1 py-0.5 rounded font-medium flex items-center gap-0.5 ${
                                  item._type === 'ext'
                                    ? 'bg-violet-100 text-violet-700'
                                    : isCompleted
                                      ? 'bg-emerald-100 text-emerald-700 line-through decoration-emerald-400/60'
                                      : 'bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]'
                                }`}
                              >
                                {isCompleted && <Check className="w-2.5 h-2.5 shrink-0" />}
                                {time ? `${time} ${label}` : label}
                              </div>
                            );
                          })}
                          {totalCount > (hasBlocks ? 1 : 2) && (
                            <span className="text-[9px] text-muted-foreground px-1">+{totalCount - (hasBlocks ? 1 : 2)} more</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Multi-day bars overlaid on the week row */}
                {bars.map((bar, bi) => {
                  const provider = bar.event.provider ?? 'other';
                  const providerLabel = PROVIDER_LABELS[provider] ?? `From ${provider}`;
                  const providerPillClass = PROVIDER_PILL_CLASSES[provider] ?? 'bg-slate-100 text-slate-600';
                  const surfaceClass = PROVIDER_ALL_DAY_CLASSES[provider]
                    ?? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 border-l-[3px] border-l-slate-400';
                  const leftPct = (bar.startCol / 7) * 100;
                  const widthPct = ((bar.endCol - bar.startCol + 1) / 7) * 100;
                  const top = BAR_TOP_OFFSET + bar.lane * (BAR_HEIGHT + BAR_GAP);
                  const rounding = [
                    bar.continuesLeft ? 'rounded-l-none border-l-0 border-l-transparent' : 'rounded-l-md',
                    bar.continuesRight ? 'rounded-r-none border-r-0' : 'rounded-r-md',
                  ].join(' ');
                  const handleBarClick = (e) => {
                    e.stopPropagation();
                    if (provider === 'jobber') {
                      const date = String(bar.event.start_time || '').slice(0, 10);
                      const url = date
                        ? `https://secure.getjobber.com/calendar?date=${date}`
                        : 'https://secure.getjobber.com/calendar';
                      if (typeof window !== 'undefined') {
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }
                      return;
                    }
                    onExternalEventClick?.(bar.event);
                  };
                  return (
                    <button
                      key={`${bar.event.id}-${bi}`}
                      type="button"
                      onClick={handleBarClick}
                      aria-label={`${bar.event.title} — ${providerLabel} (multi-day)`}
                      style={{
                        position: 'absolute',
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        top: `${top}px`,
                        height: `${BAR_HEIGHT}px`,
                      }}
                      className={`z-[2] flex items-center gap-1 px-1.5 text-[10px] font-medium text-foreground border overflow-hidden hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer ${surfaceClass} ${rounding}`}
                    >
                      {bar.continuesLeft && (
                        <span aria-hidden="true" className="text-muted-foreground/70 shrink-0 text-[9px]">◄</span>
                      )}
                      <span className="truncate flex-1">{bar.event.title}</span>
                      {!bar.continuesLeft && (
                        <span className={`shrink-0 inline-flex items-center rounded-full px-1 py-0 text-[9px] font-medium ${providerPillClass}`}>
                          {providerLabel}
                        </span>
                      )}
                      {bar.continuesRight && (
                        <span aria-hidden="true" className="text-muted-foreground/70 shrink-0 text-[9px]">►</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Always show the grid — even empty days display the hour grid so users
  // can click to book and see their working hours at a glance.

  function getItemsForDay(date, items) {
    return items.filter((item) => isSameDay(new Date(item.start_time), date));
  }

  // Use static Tailwind classes so JIT scanner picks them up
  const gridClass = viewMode === 'week'
    ? (isMobile
        ? 'grid grid-cols-[44px_repeat(7,1fr)] min-w-[640px]'
        : 'grid grid-cols-[56px_repeat(7,1fr)] min-w-[640px]')
    : (isMobile
        ? 'grid grid-cols-[44px_1fr] min-w-0'
        : 'grid grid-cols-[56px_1fr]');

  return (
    <div ref={scrollRef} className={`overflow-auto ${isMobile ? 'max-h-[55vh]' : 'max-h-[850px]'}`}>
      <div className={gridClass}>

        {/* Column headers */}
        <div className="border-b border-border bg-muted sticky top-0 z-30" />
        {columns.map((day, i) => {
          const isToday = isSameDay(day, today);
          const config = getDayConfig(day, workingHours);
          const isClosed = config && !config.enabled;
          const isSingleDay = viewMode === 'day';
          const dayApptCount = appointments.filter((a) => isSameDay(new Date(a.start_time), day)).length;

          return (
            <div
              key={i}
              className={`border-b border-l border-border py-2 sticky top-0 z-30 ${isSingleDay ? 'px-3 flex items-center justify-between' : 'text-center py-2.5'} ${isToday ? 'bg-[var(--selected-fill)]' : 'bg-muted'}`}
            >
              <div className={isSingleDay ? 'flex items-center gap-2.5' : ''}>
                {isSingleDay ? (
                  <div className={`text-sm font-bold inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${isToday ? 'bg-[var(--brand-accent)] text-white' : isClosed ? 'text-muted-foreground bg-muted' : 'text-foreground bg-muted'}`}>
                    {day.getDate()}
                  </div>
                ) : (
                  <>
                    <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${isToday ? 'text-[var(--brand-accent)]' : isClosed ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                      {DAY_ABBREVS[day.getDay()]}
                      {isClosed && <span className="ml-1 text-[9px] normal-case tracking-normal font-medium text-muted-foreground/50">(Closed)</span>}
                    </div>
                    <div className={`text-sm font-bold inline-flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-[var(--brand-accent)] text-white' : isClosed ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {day.getDate()}
                    </div>
                  </>
                )}
                {isSingleDay && (
                  <div className={`text-sm font-semibold ${isToday ? 'text-[var(--brand-accent)]' : 'text-foreground'}`}>
                    {day.toLocaleDateString('en-US', { weekday: 'long' })}
                    {isClosed
                      ? <span className="ml-1.5 text-xs font-medium text-muted-foreground">(Closed)</span>
                      : config?.enabled && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{formatHour(parseHourMin(config.open).h, false)} – {formatHour(parseHourMin(config.close).h, false)}</span>
                    }
                  </div>
                )}
              </div>
              {isSingleDay && dayApptCount > 0 && (
                <div className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {dayApptCount} job{dayApptCount !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          );
        })}

        {/* All-day events + all-day time blocks row */}
        {(allDayEvents.length > 0 || allDayBlocks.length > 0) && (
          <>
            <div className="border-b border-border bg-muted text-xs text-muted-foreground text-right pr-2 pt-2.5 font-medium">all&#x2011;day</div>
            {columns.map((day, i) => {
              // Multi-day events render a chip on every day their span
              // intersects. daySpanPosition drives rounding + chevrons so
              // adjacent chips visually connect into one continuous bar.
              const dayAllDayEvents = allDayEvents
                .map((e) => ({ event: e, position: daySpanPosition(e, day) }))
                .filter((x) => x.position !== null);
              const dayAllDayBlocks = allDayBlocks.filter((b) => isSameDay(new Date(b.start_time), day));
              return (
                <div key={i} className="border-b border-l border-border bg-muted">
                  <div className="flex flex-col gap-1 px-1 py-2 min-h-[40px] justify-center">
                    {dayAllDayBlocks.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-1">
                        {dayAllDayBlocks.map((block) => (
                          <button
                            key={`tb-${block.id}`}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onTimeBlockClick?.(block); }}
                            className="bg-amber-100 border border-amber-300 rounded-md px-2 py-1 text-xs text-amber-800 font-medium truncate max-w-full hover:bg-amber-200 hover:border-amber-400 active:scale-95 transition-all cursor-pointer"
                          >
                            {block.title}
                          </button>
                        ))}
                      </div>
                    )}
                    {dayAllDayEvents.map(({ event, position }) => (
                      <AllDayExternalEventChip
                        key={`${event.id}-${position}`}
                        event={event}
                        position={position}
                        onExternalEventClick={onExternalEventClick}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Hour labels */}
        <div className="relative">
          {hours.map((hour) => {
            // Determine if any visible column has this as a working hour
            const anyWorking = workingHours ? columns.some((d) => isWorkingHour(d, hour, workingHours)) : true;
            return (
              <div
                key={hour}
                className={`text-right pr-2 text-[11px] font-medium select-none ${anyWorking ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}
                style={{ height: `${hourHeight}px`, lineHeight: `${hourHeight}px` }}
              >
                {formatHour(hour, isMobile)}
              </div>
            );
          })}
        </div>

        {/* Day columns */}
        {columns.map((day, colIndex) => {
          const isToday = isSameDay(day, today);
          const dayKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const laidOut = layoutByDay.get(dayKey) || [];
          const dayBuffers = getItemsForDay(day, travelBuffers);
          const config = getDayConfig(day, workingHours);
          const isDayClosed = config && !config.enabled;

          return (
            <div
              key={colIndex}
              className={`relative border-l border-border cursor-pointer ${isToday ? 'bg-[var(--selected-fill)]' : 'bg-card'}`}
              style={{ height: `${hours.length * hourHeight}px` }}
              onClick={(e) => {
                if (!onEmptySlotClick) return;
                // Calculate clicked time from position
                const rect = e.currentTarget.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                const hourDecimal = gridStartHour + (offsetY / hourHeight);
                const hour = Math.floor(hourDecimal);
                const minutes = Math.round((hourDecimal - hour) * 60 / 15) * 15; // Snap to 15-min
                const slotDate = new Date(day);
                slotDate.setHours(hour, minutes >= 60 ? 0 : minutes, 0, 0);
                if (minutes >= 60) slotDate.setHours(hour + 1);
                onEmptySlotClick(slotDate);
              }}
            >
              {/* Off-hours shading */}
              {workingHours && hours.map((hour) => {
                const working = isWorkingHour(day, hour, workingHours);
                if (working && !isDayClosed) return null;
                return (
                  <div
                    key={`off-${hour}`}
                    className={`absolute left-0 right-0 pointer-events-none ${isToday ? 'bg-orange-50/50 dark:bg-orange-950/20' : 'bg-muted/60'}`}
                    style={{ top: `${(hour - gridStartHour) * hourHeight}px`, height: `${hourHeight}px` }}
                  />
                );
              })}

              {/* Hour grid lines */}
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-b border-border"
                  style={{ top: `${(hour - gridStartHour) * hourHeight}px`, height: `${hourHeight}px` }}
                />
              ))}

              {/* Half-hour markers */}
              {hours.map((hour) => (
                <div
                  key={`half-${hour}`}
                  className="absolute left-0 right-0 border-b border-dashed border-border"
                  style={{ top: `${(hour - gridStartHour) * hourHeight + hourHeight / 2}px` }}
                />
              ))}

              {/* Lunch break overlay */}
              {workingHours && (
                <LunchBreakOverlay
                  dayDate={day}
                  workingHours={workingHours}
                  gridStartHour={gridStartHour}
                  hourHeight={hourHeight}
                />
              )}

              {/* Timed time blocks — z-index: 1, full-width behind appointment lanes */}
              {timedBlocks.filter((block) => isSameDay(new Date(block.start_time), day)).map((block) => (
                <TimeBlockEvent
                  key={`tb-${block.id}`}
                  block={block}
                  onBlockClick={onTimeBlockClick || (() => {})}
                  isMobile={isMobile}
                  getPositionStyle={getPositionStyle}
                />
              ))}

              {/* External events (lane-aware) */}
              {laidOut.filter((w) => w.type === 'ext').map((w) => (
                <ExternalEventBlock
                  key={`ext-${w.item.id}`}
                  event={w.item}
                  laneIndex={w.laneIndex}
                  laneCount={w.laneCount}
                  isMobile={isMobile}
                  getPositionStyle={getPositionStyle}
                  onClick={onExternalEventClick}
                />
              ))}

              {/* Travel buffers (full-column background decoration, unchanged) */}
              {dayBuffers.map((buffer, i) => (
                <TravelBufferBlock key={`buf-${i}`} buffer={buffer} getPositionStyle={getPositionStyle} />
              ))}

              {/* Appointments (lane-aware) */}
              {laidOut.filter((w) => w.type === 'appt').map((w) => (
                <AppointmentBlock
                  key={`appt-${w.item.id}`}
                  appointment={w.item}
                  onClick={onAppointmentClick}
                  isOffHours={isOutsideWorkingHours(w.item, workingHours)}
                  isMobile={isMobile}
                  laneIndex={w.laneIndex}
                  laneCount={w.laneCount}
                  getPositionStyle={getPositionStyle}
                  jobberConnected={jobberConnected}
                />
              ))}

              {/* Current time indicator */}
              {isToday && <CurrentTimeIndicator gridStartHour={gridStartHour} gridEndHour={gridEndHour} hourHeight={hourHeight} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
