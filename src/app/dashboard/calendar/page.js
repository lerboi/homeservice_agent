'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, CalendarOff, Link2 } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { EmptyStateCalendar } from '@/components/dashboard/EmptyStateCalendar';
import { Button } from '@/components/ui/button';
import CalendarView from '@/components/dashboard/CalendarView';
import AppointmentFlyout from '@/components/dashboard/AppointmentFlyout';
import ConflictAlertBanner from '@/components/dashboard/ConflictAlertBanner';
import CalendarSyncCard from '@/components/dashboard/CalendarSyncCard';
import { card } from '@/lib/design-tokens';

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

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  const [loading, setLoading] = useState(true);
  const [fading, setFading] = useState(false);
  const [data, setData] = useState({
    appointments: [],
    externalEvents: [],
    travelBuffers: [],
    conflicts: [],
  });

  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const prefersReduced = useReducedMotion();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const effectiveViewMode = isMobile ? 'day' : viewMode;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const start = effectiveViewMode === 'week'
        ? startOfWeek(currentDate).toISOString()
        : startOfDay(currentDate).toISOString();
      const end = effectiveViewMode === 'week'
        ? endOfWeek(currentDate).toISOString()
        : endOfDay(currentDate).toISOString();

      const res = await fetch(`/api/appointments?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&view=${effectiveViewMode}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch {
      setData({ appointments: [], externalEvents: [], travelBuffers: [], conflicts: [] });
    } finally {
      setLoading(false);
    }
  }, [currentDate, effectiveViewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function navigate(direction) {
    setFading(true);
    setTimeout(() => {
      setCurrentDate((prev) => {
        const d = new Date(prev);
        if (effectiveViewMode === 'week') {
          d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
        } else {
          d.setDate(d.getDate() + (direction === 'next' ? 1 : -1));
        }
        return d;
      });
      setTimeout(() => setFading(false), 150);
    }, 100);
  }

  function goToday() {
    setFading(true);
    setTimeout(() => {
      setCurrentDate(new Date());
      setTimeout(() => setFading(false), 150);
    }, 100);
  }

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
  const dateLabel = effectiveViewMode === 'week'
    ? formatWeekRange(currentDate)
    : formatDayLabel(currentDate);

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
    high_ticket: 'border-l-amber-400',
  };

  const urgencyTimeColor = {
    emergency: 'text-red-500',
    routine: 'text-[#4F6BED]',
    high_ticket: 'text-amber-600',
  };

  return (
    <div className="space-y-4" data-tour="calendar-page">

      {/* Conflict Banner */}
      <ConflictAlertBanner
        conflicts={data.conflicts}
        onReviewConflicts={handleReviewConflicts}
      />

      {/* ── Calendar Card (full width) ───────────────────────────── */}
      <div className={`${card.base} p-0 overflow-hidden`}>
        {/* Calendar toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-stone-200/60 bg-[#FAFAF9]">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate('prev')} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate('next')} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-base font-semibold text-[#0F172A] ml-1 tabular-nums">{dateLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToday}
              disabled={isToday}
            >
              Today
            </Button>

            {!isMobile && (
              <div className="flex rounded-lg border border-stone-200 overflow-hidden">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'week' ? 'bg-[#0F172A] text-white' : 'bg-white text-[#475569] hover:bg-stone-50'}`}
                  onClick={() => setViewMode('week')}
                >
                  Week
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-stone-200 ${viewMode === 'day' ? 'bg-[#0F172A] text-white' : 'bg-white text-[#475569] hover:bg-stone-50'}`}
                  onClick={() => setViewMode('day')}
                >
                  Day
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Calendar grid */}
        <div className={`transition-opacity ${fading ? 'opacity-0 duration-100' : 'opacity-100 duration-150'}`}>
          <CalendarView
            appointments={data.appointments}
            externalEvents={data.externalEvents}
            travelBuffers={data.travelBuffers}
            currentDate={currentDate}
            viewMode={effectiveViewMode}
            loading={loading}
            onAppointmentClick={handleAppointmentClick}
          />
        </div>
      </div>

      {/* ── Bottom row: Agenda + Connections ────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Today's Agenda */}
        <div className={`${card.base} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="size-4 text-[#C2410C]" />
            <h2 className="text-sm font-semibold text-[#0F172A]">Today&apos;s Agenda</h2>
            {todayAppts.length > 0 && (
              <span className="ml-auto text-xs font-medium bg-[#0F172A]/[0.06] text-[#475569] px-2 py-0.5 rounded-full">
                {todayAppts.length} appointment{todayAppts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {todayAppts.length === 0 ? (
            data.appointments.length === 0 ? (
              <EmptyStateCalendar padding="py-6" onConnect={() => {}} />
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CalendarOff className="h-8 w-8 text-stone-300 mb-2" />
                <p className="text-sm font-medium text-[#0F172A]">No appointments today</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">Enjoy the day off.</p>
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
                    className={`w-full text-left rounded-lg border border-stone-200 border-l-[3px] ${border} p-3 hover:bg-stone-50 transition-colors group`}
                    onClick={() => handleAppointmentClick(appt)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold ${timeColor} mb-0.5`}>{startTime} – {endTime}</p>
                        <p className="text-sm font-semibold text-[#0F172A]">{appt.caller_name}</p>
                        {addressLine && (
                          <p className="text-xs text-[#64748B] truncate mt-0.5">{addressLine}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8] group-hover:text-[#475569] transition-colors shrink-0 mt-0.5">
                        View →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Calendar Connections */}
        <div className={`${card.base} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="size-4 text-[#C2410C]" />
            <h2 className="text-sm font-semibold text-[#0F172A]">Calendar Connections</h2>
          </div>
          <CalendarSyncCard />
        </div>
      </div>

      {/* Appointment Flyout */}
      <AppointmentFlyout
        appointment={selectedAppointment}
        conflict={selectedConflict}
        open={flyoutOpen}
        onOpenChange={setFlyoutOpen}
        onCancelled={handleCancelled}
      />
    </div>
  );
}
