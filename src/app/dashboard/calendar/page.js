'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarOff } from 'lucide-react';
import { EmptyStateCalendar } from '@/components/dashboard/EmptyStateCalendar';
import { Button } from '@/components/ui/button';
import CalendarView from '@/components/dashboard/CalendarView';
import AppointmentFlyout from '@/components/dashboard/AppointmentFlyout';
import ConflictAlertBanner from '@/components/dashboard/ConflictAlertBanner';

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

  // Flyout state
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  // Mobile detection
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

  // Today's agenda
  const todayAppts = data.appointments
    .filter((a) => isSameDay(new Date(a.start_time), new Date()))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  // Find conflict for selected appointment
  const selectedConflict = selectedAppointment
    ? data.conflicts.find((c) => c.appointment.id === selectedAppointment.id)
    : null;

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Conflict Banner */}
      <ConflictAlertBanner
        conflicts={data.conflicts}
        onReviewConflicts={handleReviewConflicts}
      />

      {/* Calendar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate('prev')} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate('next')} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold text-[#0F172A] ml-2">{dateLabel}</span>
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
            <div className="flex rounded-md border border-stone-200 overflow-hidden">
              <button
                type="button"
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'week' ? 'bg-[#0F172A] text-white' : 'bg-white text-[#475569] hover:bg-stone-50'}`}
                onClick={() => setViewMode('week')}
              >
                Week
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'day' ? 'bg-[#0F172A] text-white' : 'bg-white text-[#475569] hover:bg-stone-50'}`}
                onClick={() => setViewMode('day')}
              >
                Day
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content: Calendar + Agenda sidebar */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendar */}
        <div
          className={`flex-1 min-w-0 border border-stone-200 rounded-lg overflow-hidden transition-opacity ${fading ? 'opacity-0 duration-100' : 'opacity-100 duration-150'}`}
        >
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

        {/* Today's Agenda Sidebar */}
        <div className="lg:w-[280px] shrink-0">
          <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-3">
            Today&apos;s Agenda
          </h2>

          {todayAppts.length === 0 ? (
            data.appointments.length === 0 ? (
              <EmptyStateCalendar padding="py-8" />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarOff className="h-8 w-8 text-stone-300 mb-2" />
                <p className="text-sm text-[#475569]">No appointments today</p>
              </div>
            )
          ) : (
            <div className="space-y-2">
              {todayAppts.map((appt) => {
                const urgencyBorder = {
                  emergency: 'border-l-red-400',
                  routine: 'border-l-[#0F172A]/30',
                  high_ticket: 'border-l-amber-400',
                };
                const time = new Date(appt.start_time).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                });

                return (
                  <button
                    key={appt.id}
                    type="button"
                    className={`w-full text-left rounded-md border border-stone-200 border-l-2 ${urgencyBorder[appt.urgency] || urgencyBorder.routine} p-3 hover:bg-stone-50 transition-colors cursor-pointer`}
                    onClick={() => handleAppointmentClick(appt)}
                  >
                    <div className="text-xs text-[#475569] font-medium">{time}</div>
                    <div className="text-sm font-semibold text-[#0F172A] mt-0.5">{appt.caller_name}</div>
                    <div className="text-xs text-[#475569] truncate">{appt.notes || appt.service_address || ''}</div>
                  </button>
                );
              })}
            </div>
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
      />
    </div>
  );
}
