'use client';

import { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarIcon } from 'lucide-react';

const HOUR_HEIGHT = 48;
const START_HOUR = 7;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const URGENCY_COLORS = {
  emergency: 'bg-red-50 border-l-2 border-red-400',
  routine: 'bg-blue-50 border-l-2 border-blue-400',
  high_ticket: 'bg-amber-50 border-l-2 border-amber-400',
};

const URGENCY_BADGE = {
  emergency: 'bg-red-100 text-red-700',
  routine: 'bg-blue-100 text-blue-700',
  high_ticket: 'bg-amber-100 text-amber-700',
};

function getPositionStyle(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const startMins = start.getHours() * 60 + start.getMinutes() - START_HOUR * 60;
  const endMins = end.getHours() * 60 + end.getMinutes() - START_HOUR * 60;
  const top = (startMins / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMins - startMins) / 60) * HOUR_HEIGHT, 24);
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

function CurrentTimeIndicator({ dayIndex, totalColumns }) {
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
      <div className="relative w-full border-t-2 border-red-500">
        <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
      </div>
    </div>
  );
}

function AppointmentBlock({ appointment, onClick }) {
  const style = getPositionStyle(appointment.start_time, appointment.end_time);
  const urgency = appointment.urgency || 'routine';
  const colorClass = URGENCY_COLORS[urgency] || URGENCY_COLORS.routine;
  const badgeClass = URGENCY_BADGE[urgency] || URGENCY_BADGE.routine;

  return (
    <button
      type="button"
      className={`absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${colorClass}`}
      style={style}
      onClick={() => onClick(appointment)}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{appointment.caller_name}</div>
          <div className="text-xs text-slate-600 truncate">{appointment.notes || ''}</div>
          <div className="text-xs text-slate-500 truncate">{appointment.service_address || ''}</div>
        </div>
        <span className={`text-[11px] px-1.5 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
          {urgency === 'emergency' ? 'Emerg' : urgency === 'high_ticket' ? 'High' : 'Routine'}
        </span>
      </div>
    </button>
  );
}

function TravelBufferBlock({ buffer }) {
  const style = getPositionStyle(buffer.start_time, buffer.end_time);

  return (
    <div
      className="absolute left-1 right-1 bg-slate-100 border border-dashed border-slate-300 rounded-md pointer-events-none flex items-center justify-center"
      style={style}
    >
      <span className="text-[11px] text-slate-400">Travel buffer</span>
    </div>
  );
}

function ExternalEventBlock({ event }) {
  const style = getPositionStyle(event.start_time, event.end_time);

  return (
    <div
      className="absolute left-1 right-1 bg-purple-50 border border-dashed border-purple-300 rounded-md pointer-events-none px-2 py-1 overflow-hidden"
      style={style}
    >
      <div className="text-[13px] text-purple-600 truncate">{event.title}</div>
      <div className="text-[11px] text-purple-400">Google Calendar</div>
    </div>
  );
}

function AllDayEvents({ events }) {
  if (!events || events.length === 0) return null;
  const visible = events.slice(0, 2);
  const remaining = events.length - 2;

  return (
    <div className="flex gap-1 px-1 py-1 min-h-[24px]">
      {visible.map((e) => (
        <div key={e.id} className="bg-purple-50 border border-dashed border-purple-300 rounded px-2 py-0.5 text-[11px] text-purple-600 truncate">
          {e.title}
        </div>
      ))}
      {remaining > 0 && (
        <span className="text-[11px] text-slate-400 self-center">+{remaining} more</span>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
      {[
        { top: 48, height: 72 },
        { top: 192, height: 48 },
        { top: 336, height: 96 },
      ].map((s, i) => (
        <Skeleton
          key={i}
          className="absolute left-12 right-4 rounded-md"
          style={{ top: `${s.top}px`, height: `${s.height}px` }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <CalendarIcon className="h-10 w-10 text-slate-300 mb-3" />
      <h3 className="text-lg font-semibold text-slate-900 mb-1">No appointments this week</h3>
      <p className="text-sm text-slate-500">Appointments booked by your AI will appear here.</p>
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

  // Separate all-day events
  const allDayEvents = externalEvents.filter((e) => e.is_all_day);
  const timedExternalEvents = externalEvents.filter((e) => !e.is_all_day);

  if (loading) return <LoadingSkeleton />;

  const hasContent = appointments.length > 0 || timedExternalEvents.length > 0 || travelBuffers.length > 0;
  if (!hasContent && allDayEvents.length === 0) return <EmptyState />;

  function getItemsForDay(date, items) {
    return items.filter((item) => {
      const itemDate = new Date(item.start_time);
      return isSameDay(itemDate, date);
    });
  }

  return (
    <div className="overflow-x-auto">
      <div className={`grid ${viewMode === 'week' ? 'grid-cols-[48px_repeat(7,1fr)]' : 'grid-cols-[48px_1fr]'} min-w-[640px]`}>
        {/* Header row */}
        <div className="border-b border-slate-200" />
        {columns.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={i}
              className="border-b border-l border-slate-200 text-center py-2"
            >
              <div className="text-xs text-slate-500 font-medium">{DAY_ABBREVS[day.getDay()]}</div>
              <div className={`text-sm font-semibold mt-0.5 inline-flex items-center justify-center ${isToday ? 'bg-blue-600 text-white rounded-full w-8 h-8' : 'text-slate-900'}`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}

        {/* All-day events row */}
        {allDayEvents.length > 0 && (
          <>
            <div className="border-b border-slate-200 text-[10px] text-slate-400 text-right pr-1 pt-1">all-day</div>
            {columns.map((day, i) => (
              <div key={i} className="border-b border-l border-slate-200">
                <AllDayEvents events={getItemsForDay(day, allDayEvents)} />
              </div>
            ))}
          </>
        )}

        {/* Time grid */}
        <div className="relative">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="text-right pr-2 text-[11px] text-slate-400"
              style={{ height: `${HOUR_HEIGHT}px`, lineHeight: `${HOUR_HEIGHT}px` }}
            >
              {formatHour(hour)}
            </div>
          ))}
        </div>

        {columns.map((day, colIndex) => {
          const isToday = isSameDay(day, today);
          const dayAppointments = getItemsForDay(day, appointments);
          const dayBuffers = getItemsForDay(day, travelBuffers);
          const dayExternal = getItemsForDay(day, timedExternalEvents);

          return (
            <div
              key={colIndex}
              className="relative border-l border-slate-200"
              style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}
            >
              {/* Hour grid lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-b border-slate-100"
                  style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                />
              ))}

              {/* External events (behind) */}
              {dayExternal.map((event) => (
                <ExternalEventBlock key={event.id} event={event} />
              ))}

              {/* Travel buffers */}
              {dayBuffers.map((buffer, i) => (
                <TravelBufferBlock key={`buf-${i}`} buffer={buffer} />
              ))}

              {/* Appointments (on top) */}
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
