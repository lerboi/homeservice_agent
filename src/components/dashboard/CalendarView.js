'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';

const HOUR_HEIGHT = 64;
const DEFAULT_START = 7;
const DEFAULT_END = 20;

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const URGENCY_STYLES = {
  emergency: {
    block: 'bg-red-50 border-l-[3px] border-red-400 hover:bg-red-100/70',
    badge: 'bg-red-100 text-red-700',
    time: 'text-red-500',
    name: 'text-red-900',
  },
  routine: {
    block: 'bg-[#F0F4FF] border-l-[3px] border-[#4F6BED] hover:bg-[#E8EFFE]',
    badge: 'bg-[#4F6BED]/10 text-[#4F6BED]',
    time: 'text-[#4F6BED]',
    name: 'text-[#0F172A]',
  },
  high_ticket: {
    block: 'bg-amber-50 border-l-[3px] border-amber-400 hover:bg-amber-100/70',
    badge: 'bg-amber-100 text-amber-700',
    time: 'text-amber-600',
    name: 'text-amber-900',
  },
};

const URGENCY_LABEL = {
  emergency: 'Emergency',
  routine: 'Routine',
  high_ticket: 'High Value',
};

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
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

function CurrentTimeIndicator({ gridStartHour, gridEndHour }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const mins = now.getHours() * 60 + now.getMinutes() - gridStartHour * 60;
  if (mins < 0 || mins > (gridEndHour - gridStartHour) * 60) return null;

  const top = (mins / 60) * HOUR_HEIGHT;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="relative w-full border-t-2 border-[#C2410C]">
        <div className="absolute -left-1.5 -top-[5px] w-2.5 h-2.5 rounded-full bg-[#C2410C]" />
      </div>
    </div>
  );
}

function AppointmentBlock({ appointment, onClick, isOffHours, isMobile, getPositionStyle }) {
  const style = getPositionStyle(appointment.start_time, appointment.end_time);
  const urgency = appointment.urgency || 'routine';
  const styles = URGENCY_STYLES[urgency] || URGENCY_STYLES.routine;
  const heightPx = parseInt(style.height, 10);
  const minHeight = isMobile ? 44 : 28;
  const finalStyle = { ...style, height: `${Math.max(heightPx, minHeight)}px` };
  const effectiveHeight = Math.max(heightPx, minHeight);
  const isCompact = effectiveHeight < 52;
  const isVeryCompact = effectiveHeight < 36;

  const addressLine = appointment.street_name && appointment.postal_code
    ? `${appointment.street_name}, ${appointment.postal_code}`
    : appointment.service_address || '';

  return (
    <button
      type="button"
      className={`absolute ${isMobile ? 'left-0.5 right-0.5' : 'left-1 right-1'} rounded-md px-2 overflow-hidden cursor-pointer transition-all shadow-sm hover:shadow-md ${styles.block}`}
      style={finalStyle}
      onClick={(e) => { e.stopPropagation(); onClick(appointment); }}
    >
      {/* Off-hours indicator */}
      {isOffHours && (
        <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-stone-200/80 flex items-center justify-center z-10" title="Outside working hours">
          <Clock className="w-2.5 h-2.5 text-stone-500" />
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
            <div className="text-[11px] text-[#475569] truncate mt-0.5 leading-tight">{addressLine}</div>
          )}
          {effectiveHeight >= 96 && (appointment.notes) && (
            <div className="text-[11px] text-[#64748B] truncate leading-tight">{appointment.notes}</div>
          )}
        </div>
      )}
    </button>
  );
}

function TravelBufferBlock({ buffer, getPositionStyle }) {
  const style = getPositionStyle(buffer.start_time, buffer.end_time);

  return (
    <div
      className="absolute left-1 right-1 bg-stone-100 border border-dashed border-stone-300 rounded pointer-events-none flex items-center justify-center"
      style={style}
    >
      <span className="text-[10px] text-stone-400 font-medium">Travel buffer</span>
    </div>
  );
}

function ExternalEventBlock({ event, getPositionStyle }) {
  const style = getPositionStyle(event.start_time, event.end_time);
  const heightPx = parseInt(style.height, 10);
  const providerLabel = event.provider === 'outlook' ? 'Outlook' : 'Google Calendar';

  return (
    <div
      className="absolute left-1 right-1 bg-violet-50 border-l-[3px] border-violet-400 rounded-md pointer-events-none px-2 py-1 overflow-hidden shadow-sm"
      style={style}
    >
      <div className="text-[11px] font-semibold text-violet-700 truncate leading-tight">{event.title}</div>
      {heightPx >= 40 && (
        <div className="text-[10px] text-violet-400 mt-0.5">{providerLabel}</div>
      )}
    </div>
  );
}

function LunchBreakOverlay({ dayDate, workingHours, gridStartHour }) {
  const config = getDayConfig(dayDate, workingHours);
  if (!config?.enabled || !config.lunchStart || !config.lunchEnd) return null;

  const ls = parseHourMin(config.lunchStart);
  const le = parseHourMin(config.lunchEnd);
  const topMins = ls.totalMins - gridStartHour * 60;
  const heightMins = le.totalMins - ls.totalMins;
  if (heightMins <= 0) return null;

  return (
    <div
      className="absolute left-0 right-0 bg-stone-100/60 border-y border-dashed border-stone-200/80 pointer-events-none z-[1] flex items-center justify-center"
      style={{
        top: `${(topMins / 60) * HOUR_HEIGHT}px`,
        height: `${(heightMins / 60) * HOUR_HEIGHT}px`,
      }}
    >
      <span className="text-[10px] text-stone-400 font-medium tracking-wide">Lunch</span>
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
        <span className="text-[10px] text-stone-400 self-center">+{remaining}</span>
      )}
    </div>
  );
}

function LoadingSkeleton({ viewMode }) {
  const cols = viewMode === 'week' ? 7 : 1;
  const hours = Array.from({ length: DEFAULT_END - DEFAULT_START }, (_, i) => DEFAULT_START + i);
  return (
    <div className={`grid grid-cols-[56px_repeat(${cols},1fr)] min-w-[640px]`}>
      <div className="border-b border-stone-200" />
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="border-b border-l border-stone-200 py-3 px-2">
          <Skeleton className="h-3 w-6 mx-auto mb-1" />
          <Skeleton className="h-6 w-6 mx-auto rounded-full" />
        </div>
      ))}
      <div className="relative col-span-1" style={{ height: `${hours.length * HOUR_HEIGHT}px` }}>
        {hours.map((h) => (
          <div key={h} className="absolute left-0 right-0 border-b border-stone-100" style={{ top: `${(h - DEFAULT_START) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }} />
        ))}
      </div>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="relative border-l border-stone-200" style={{ height: `${hours.length * HOUR_HEIGHT}px` }}>
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
      <CalendarIcon className="h-10 w-10 text-stone-300 mb-3" />
      <h3 className="text-base font-semibold text-[#0F172A] mb-1">No appointments this week</h3>
      <p className="text-sm text-[#475569]">Appointments booked by your AI will appear here.</p>
    </div>
  );
}

export default function CalendarView({
  appointments = [],
  externalEvents = [],
  travelBuffers = [],
  currentDate,
  viewMode = 'week',
  loading = false,
  onAppointmentClick,
  onDayClick,
  onEmptySlotClick,
  workingHoursData = null,
  isMobile = false,
}) {
  const today = new Date();
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const columns = viewMode === 'week' ? weekDays : [new Date(currentDate)];
  const scrollRef = useRef(null);
  const hasScrolled = useRef(false);

  const workingHours = workingHoursData?.working_hours || null;

  // Compute dynamic grid range
  const { gridStartHour, gridEndHour } = useMemo(() => {
    let earliest = DEFAULT_START;
    let latest = DEFAULT_END;

    // Expand to cover working hours
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

    // Expand to cover all items
    const allItems = [...appointments, ...externalEvents, ...travelBuffers];
    for (const item of allItems) {
      const s = new Date(item.start_time);
      const e = new Date(item.end_time);
      earliest = Math.min(earliest, s.getHours());
      latest = Math.max(latest, e.getMinutes() > 0 ? e.getHours() + 1 : e.getHours());
    }

    // Pad by 1 hour each side, clamp to 0-24
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
    const top = (Math.max(startMins, 0) / 60) * HOUR_HEIGHT;
    const height = Math.max(((Math.min(endMins, (gridEndHour - gridStartHour) * 60) - Math.max(startMins, 0)) / 60) * HOUR_HEIGHT, 28);
    return { top: `${top}px`, height: `${height}px` };
  }, [gridStartHour, gridEndHour]);

  const allDayEvents = externalEvents.filter((e) => e.is_all_day);
  const timedExternalEvents = externalEvents.filter((e) => !e.is_all_day);

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

    const scrollTop = (targetHour - gridStartHour) * HOUR_HEIGHT;
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
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay(); // 0=Sun
    const totalDays = lastDay.getDate();

    // Build 6-week grid (42 cells)
    const cells = [];
    const gridStart = new Date(firstDay);
    gridStart.setDate(gridStart.getDate() - startOffset);
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + i);
      const dayAppts = appointments.filter((a) => isSameDay(new Date(a.start_time), cellDate));
      cells.push({ date: cellDate, appointments: dayAppts });
    }

    return (
      <div className="p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-stone-400 uppercase tracking-wider py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Date grid */}
        <div className="grid grid-cols-7 border border-stone-200 rounded-lg overflow-hidden">
          {cells.map((cell, i) => {
            const isCurrentMonth = cell.date.getMonth() === month;
            const isTodayCell = isSameDay(cell.date, today);
            const count = cell.appointments.length;

            return (
              <button
                key={i}
                type="button"
                onClick={() => onDayClick?.(new Date(cell.date))}
                className={`
                  relative min-h-[72px] p-1.5 text-left border-b border-r border-stone-100 transition-colors
                  ${isCurrentMonth ? 'bg-white hover:bg-stone-50' : 'bg-stone-50/50 hover:bg-stone-100/50'}
                  ${isTodayCell ? 'ring-1 ring-inset ring-[#C2410C]/30' : ''}
                `}
              >
                <span className={`
                  inline-flex items-center justify-center text-xs font-medium rounded-full size-6
                  ${isTodayCell ? 'bg-[#C2410C] text-white' : isCurrentMonth ? 'text-[#0F172A]' : 'text-stone-400'}
                `}>
                  {cell.date.getDate()}
                </span>

                {count > 0 && (
                  <div className="mt-0.5 space-y-0.5">
                    {cell.appointments.slice(0, 2).map((appt) => (
                      <div
                        key={appt.id}
                        className="text-[9px] leading-tight truncate px-1 py-0.5 rounded bg-[#C2410C]/10 text-[#C2410C] font-medium"
                      >
                        {new Date(appt.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    ))}
                    {count > 2 && (
                      <span className="text-[9px] text-stone-400 px-1">+{count - 2} more</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const hasContent = appointments.length > 0 || timedExternalEvents.length > 0 || travelBuffers.length > 0;
  if (!hasContent && allDayEvents.length === 0) return <EmptyState />;

  function getItemsForDay(date, items) {
    return items.filter((item) => isSameDay(new Date(item.start_time), date));
  }

  const gutterWidth = isMobile ? '44px' : '56px';
  const gridCols = viewMode === 'week'
    ? `grid-cols-[${gutterWidth}_repeat(7,1fr)]`
    : `grid-cols-[${gutterWidth}_1fr]`;

  return (
    <div ref={scrollRef} className={`overflow-auto ${isMobile ? 'max-h-[55vh]' : 'max-h-[700px]'}`}>
      <div className={`grid ${gridCols} ${isMobile && viewMode === 'day' ? 'min-w-0' : 'min-w-[640px]'}`}>

        {/* Column headers */}
        <div className="border-b border-stone-200 bg-[#FAFAF9] sticky top-0 z-30" />
        {columns.map((day, i) => {
          const isToday = isSameDay(day, today);
          const config = getDayConfig(day, workingHours);
          const isClosed = config && !config.enabled;
          return (
            <div
              key={i}
              className={`border-b border-l border-stone-200 text-center py-2.5 sticky top-0 z-30 ${isToday ? 'bg-[#FFF7ED]' : 'bg-[#FAFAF9]'}`}
            >
              <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${isToday ? 'text-[#C2410C]' : isClosed ? 'text-stone-300' : 'text-[#94A3B8]'}`}>
                {DAY_ABBREVS[day.getDay()]}
                {isClosed && <span className="ml-1 text-[9px] normal-case tracking-normal font-medium text-stone-300">(Closed)</span>}
              </div>
              <div className={`text-sm font-bold inline-flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-[#C2410C] text-white' : isClosed ? 'text-stone-400' : 'text-[#0F172A]'}`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}

        {/* All-day events row */}
        {allDayEvents.length > 0 && (
          <>
            <div className="border-b border-stone-200 bg-[#FAFAF9] text-[10px] text-stone-400 text-right pr-2 pt-1.5 font-medium">all&#x2011;day</div>
            {columns.map((day, i) => (
              <div key={i} className="border-b border-l border-stone-200 bg-[#FAFAF9]">
                <AllDayEvents events={getItemsForDay(day, allDayEvents)} />
              </div>
            ))}
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
                className={`text-right pr-2.5 text-[11px] font-medium select-none ${anyWorking ? 'text-stone-400' : 'text-stone-300'}`}
                style={{ height: `${HOUR_HEIGHT}px`, lineHeight: `${HOUR_HEIGHT}px` }}
              >
                {formatHour(hour, isMobile)}
              </div>
            );
          })}
        </div>

        {/* Day columns */}
        {columns.map((day, colIndex) => {
          const isToday = isSameDay(day, today);
          const dayAppointments = getItemsForDay(day, appointments);
          const dayBuffers = getItemsForDay(day, travelBuffers);
          const dayExternal = getItemsForDay(day, timedExternalEvents);
          const config = getDayConfig(day, workingHours);
          const isDayClosed = config && !config.enabled;

          return (
            <div
              key={colIndex}
              className={`relative border-l border-stone-200 cursor-pointer ${isToday ? 'bg-[#FFFCFA]' : 'bg-white'}`}
              style={{ height: `${hours.length * HOUR_HEIGHT}px` }}
              onClick={(e) => {
                if (!onEmptySlotClick) return;
                // Calculate clicked time from position
                const rect = e.currentTarget.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                const hourDecimal = gridStartHour + (offsetY / HOUR_HEIGHT);
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
                    className={`absolute left-0 right-0 pointer-events-none ${isToday ? 'bg-orange-50/30' : 'bg-stone-50/80'}`}
                    style={{ top: `${(hour - gridStartHour) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                  />
                );
              })}

              {/* Hour grid lines */}
              {hours.map((hour) => (
                <div
                  key={hour}
                  className={`absolute left-0 right-0 border-b ${hour % 2 === 0 ? 'border-stone-150' : 'border-stone-100'}`}
                  style={{ top: `${(hour - gridStartHour) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                />
              ))}

              {/* Half-hour markers */}
              {hours.map((hour) => (
                <div
                  key={`half-${hour}`}
                  className="absolute left-0 right-0 border-b border-stone-50"
                  style={{ top: `${(hour - gridStartHour) * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                />
              ))}

              {/* Lunch break overlay */}
              {workingHours && (
                <LunchBreakOverlay
                  dayDate={day}
                  workingHours={workingHours}
                  gridStartHour={gridStartHour}
                />
              )}

              {/* External events */}
              {dayExternal.map((event) => (
                <ExternalEventBlock key={event.id} event={event} getPositionStyle={getPositionStyle} />
              ))}

              {/* Travel buffers */}
              {dayBuffers.map((buffer, i) => (
                <TravelBufferBlock key={`buf-${i}`} buffer={buffer} getPositionStyle={getPositionStyle} />
              ))}

              {/* Appointments */}
              {dayAppointments.map((appt) => (
                <AppointmentBlock
                  key={appt.id}
                  appointment={appt}
                  onClick={onAppointmentClick}
                  isOffHours={isOutsideWorkingHours(appt, workingHours)}
                  isMobile={isMobile}
                  getPositionStyle={getPositionStyle}
                />
              ))}

              {/* Current time indicator */}
              {isToday && <CurrentTimeIndicator gridStartHour={gridStartHour} gridEndHour={gridEndHour} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
