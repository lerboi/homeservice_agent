'use client';

import { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarIcon } from 'lucide-react';

const HOUR_HEIGHT = 64;
const START_HOUR = 7;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

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

function getPositionStyle(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const startMins = start.getHours() * 60 + start.getMinutes() - START_HOUR * 60;
  const endMins = end.getHours() * 60 + end.getMinutes() - START_HOUR * 60;
  const top = (startMins / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMins - startMins) / 60) * HOUR_HEIGHT, 28);
  return { top: `${top}px`, height: `${height}px` };
}

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

function formatHour(h) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function formatTimeRange(startTime, endTime) {
  const fmt = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${fmt(new Date(startTime))} – ${fmt(new Date(endTime))}`;
}

function CurrentTimeIndicator() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const mins = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60;
  if (mins < 0 || mins > (END_HOUR - START_HOUR) * 60) return null;

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

function AppointmentBlock({ appointment, onClick }) {
  const style = getPositionStyle(appointment.start_time, appointment.end_time);
  const urgency = appointment.urgency || 'routine';
  const styles = URGENCY_STYLES[urgency] || URGENCY_STYLES.routine;
  const heightPx = parseInt(style.height, 10);
  const isCompact = heightPx < 52;
  const isVeryCompact = heightPx < 36;

  const addressLine = appointment.street_name && appointment.postal_code
    ? `${appointment.street_name}, ${appointment.postal_code}`
    : appointment.service_address || '';

  return (
    <button
      type="button"
      className={`absolute left-1 right-1 rounded-md px-2 overflow-hidden cursor-pointer transition-all shadow-sm hover:shadow-md ${styles.block}`}
      style={style}
      onClick={() => onClick(appointment)}
    >
      {isVeryCompact ? (
        // Very short block: just one line
        <div className="flex items-center gap-1.5 h-full">
          <span className={`text-[11px] font-semibold truncate ${styles.name}`}>{appointment.caller_name}</span>
          <span className={`text-[10px] shrink-0 ${styles.time}`}>
            {new Date(appointment.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
      ) : isCompact ? (
        // Compact: time + name on one line
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
        // Full block: time range, name, address, badge
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
          {heightPx >= 80 && addressLine && (
            <div className="text-[11px] text-[#475569] truncate mt-0.5 leading-tight">{addressLine}</div>
          )}
          {heightPx >= 96 && (appointment.notes) && (
            <div className="text-[11px] text-[#64748B] truncate leading-tight">{appointment.notes}</div>
          )}
        </div>
      )}
    </button>
  );
}

function TravelBufferBlock({ buffer }) {
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

function ExternalEventBlock({ event }) {
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
  return (
    <div className={`grid grid-cols-[56px_repeat(${cols},1fr)] min-w-[640px]`}>
      <div className="border-b border-stone-200" />
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="border-b border-l border-stone-200 py-3 px-2">
          <Skeleton className="h-3 w-6 mx-auto mb-1" />
          <Skeleton className="h-6 w-6 mx-auto rounded-full" />
        </div>
      ))}
      <div className="relative col-span-1" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
        {HOURS.map((h) => (
          <div key={h} className="absolute left-0 right-0 border-b border-stone-100" style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }} />
        ))}
      </div>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="relative border-l border-stone-200" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
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
}) {
  const today = new Date();
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const columns = viewMode === 'week' ? weekDays : [new Date(currentDate)];

  const allDayEvents = externalEvents.filter((e) => e.is_all_day);
  const timedExternalEvents = externalEvents.filter((e) => !e.is_all_day);

  if (loading) return <LoadingSkeleton viewMode={viewMode} />;

  const hasContent = appointments.length > 0 || timedExternalEvents.length > 0 || travelBuffers.length > 0;
  if (!hasContent && allDayEvents.length === 0) return <EmptyState />;

  function getItemsForDay(date, items) {
    return items.filter((item) => isSameDay(new Date(item.start_time), date));
  }

  const gridCols = viewMode === 'week' ? 'grid-cols-[56px_repeat(7,1fr)]' : 'grid-cols-[56px_1fr]';

  return (
    <div className="overflow-x-auto">
      <div className={`grid ${gridCols} min-w-[640px]`}>

        {/* Column headers */}
        <div className="border-b border-stone-200 bg-[#FAFAF9]" />
        {columns.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={i}
              className={`border-b border-l border-stone-200 text-center py-2.5 bg-[#FAFAF9] ${isToday ? 'bg-[#FFF7ED]' : ''}`}
            >
              <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${isToday ? 'text-[#C2410C]' : 'text-[#94A3B8]'}`}>
                {DAY_ABBREVS[day.getDay()]}
              </div>
              <div className={`text-sm font-bold inline-flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-[#C2410C] text-white' : 'text-[#0F172A]'}`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}

        {/* All-day events row */}
        {allDayEvents.length > 0 && (
          <>
            <div className="border-b border-stone-200 bg-[#FAFAF9] text-[10px] text-stone-400 text-right pr-2 pt-1.5 font-medium">all‑day</div>
            {columns.map((day, i) => (
              <div key={i} className="border-b border-l border-stone-200 bg-[#FAFAF9]">
                <AllDayEvents events={getItemsForDay(day, allDayEvents)} />
              </div>
            ))}
          </>
        )}

        {/* Hour labels */}
        <div className="relative">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="text-right pr-2.5 text-[11px] text-stone-400 font-medium select-none"
              style={{ height: `${HOUR_HEIGHT}px`, lineHeight: `${HOUR_HEIGHT}px` }}
            >
              {formatHour(hour)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {columns.map((day, colIndex) => {
          const isToday = isSameDay(day, today);
          const dayAppointments = getItemsForDay(day, appointments);
          const dayBuffers = getItemsForDay(day, travelBuffers);
          const dayExternal = getItemsForDay(day, timedExternalEvents);

          return (
            <div
              key={colIndex}
              className={`relative border-l border-stone-200 ${isToday ? 'bg-[#FFFCFA]' : 'bg-white'}`}
              style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}
            >
              {/* Hour grid lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className={`absolute left-0 right-0 border-b ${hour % 2 === 0 ? 'border-stone-150' : 'border-stone-100'}`}
                  style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                />
              ))}

              {/* Half-hour markers */}
              {HOURS.map((hour) => (
                <div
                  key={`half-${hour}`}
                  className="absolute left-0 right-0 border-b border-stone-50"
                  style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                />
              ))}

              {/* External events */}
              {dayExternal.map((event) => (
                <ExternalEventBlock key={event.id} event={event} />
              ))}

              {/* Travel buffers */}
              {dayBuffers.map((buffer, i) => (
                <TravelBufferBlock key={`buf-${i}`} buffer={buffer} />
              ))}

              {/* Appointments */}
              {dayAppointments.map((appt) => (
                <AppointmentBlock
                  key={appt.id}
                  appointment={appt}
                  onClick={onAppointmentClick}
                />
              ))}

              {/* Current time indicator */}
              {isToday && <CurrentTimeIndicator />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
