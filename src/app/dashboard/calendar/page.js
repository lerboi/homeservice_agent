'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, CalendarOff, Link2, Plus, Loader2 } from 'lucide-react';
import { useReducedMotion, motion, useAnimation } from 'framer-motion';
import { EmptyStateCalendar } from '@/components/dashboard/EmptyStateCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { toast } from 'sonner';
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
  const [workingHoursData, setWorkingHoursData] = useState(null);

  // Swipe gesture controls for mobile day navigation
  const dragControls = useAnimation();

  // Quick-book state
  const [quickBookOpen, setQuickBookOpen] = useState(false);
  const [quickBookSlot, setQuickBookSlot] = useState(null);
  const [quickBookForm, setQuickBookForm] = useState({ caller_name: '', caller_phone: '', job_type: '', notes: '' });
  const [quickBookSaving, setQuickBookSaving] = useState(false);

  // Fetch working hours once on mount (stable config, rarely changes)
  useEffect(() => {
    fetch('/api/working-hours')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setWorkingHoursData(data); })
      .catch(() => {});
  }, []);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const effectiveViewMode = isMobile
    ? (viewMode === 'week' ? 'day' : viewMode)
    : viewMode;

  const fetchData = useCallback(async () => {
    setLoading(true);
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
      } else if (effectiveViewMode === 'week') {
        start = startOfWeek(currentDate).toISOString();
        end = endOfWeek(currentDate).toISOString();
      } else {
        start = startOfDay(currentDate).toISOString();
        end = endOfDay(currentDate).toISOString();
      }

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

  function handleDayClick(date) {
    setFading(true);
    setTimeout(() => {
      setCurrentDate(date);
      setViewMode('day');
      setTimeout(() => setFading(false), 150);
    }, 100);
  }

  function navigate(direction) {
    setFading(true);
    setTimeout(() => {
      setCurrentDate((prev) => {
        const d = new Date(prev);
        if (effectiveViewMode === 'month') {
          d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
        } else if (effectiveViewMode === 'week') {
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

  const handleSwipeEnd = useCallback((event, info) => {
    const threshold = 50;
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    if (Math.abs(offset) > threshold || Math.abs(velocity) > 300) {
      const direction = (offset > 0 || velocity > 300) ? -1 : 1;
      setFading(true);
      setTimeout(() => {
        setCurrentDate((prev) => {
          const d = new Date(prev);
          d.setDate(d.getDate() + direction);
          return d;
        });
        setTimeout(() => setFading(false), 150);
      }, 100);
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

  function handleEmptySlotClick(slotDate) {
    setQuickBookSlot(slotDate);
    setQuickBookForm({ caller_name: '', caller_phone: '', job_type: '', notes: '' });
    setQuickBookOpen(true);
  }

  async function handleQuickBook() {
    if (!quickBookSlot || !quickBookForm.caller_name.trim()) return;
    setQuickBookSaving(true);
    try {
      const startTime = quickBookSlot.toISOString();
      const endTime = new Date(quickBookSlot.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour default
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_name: quickBookForm.caller_name.trim(),
          caller_phone: quickBookForm.caller_phone.trim() || null,
          job_type: quickBookForm.job_type.trim() || null,
          notes: quickBookForm.notes.trim() || null,
          start_time: startTime,
          end_time: endTime,
          status: 'confirmed',
        }),
      });
      if (!res.ok) throw new Error('Failed to book');
      const result = await res.json();
      setData((prev) => ({
        ...prev,
        appointments: [...prev.appointments, result.appointment].sort(
          (a, b) => new Date(a.start_time) - new Date(b.start_time)
        ),
      }));
      setQuickBookOpen(false);
      toast.success('Appointment booked');
    } catch {
      toast.error('Failed to book appointment');
    } finally {
      setQuickBookSaving(false);
    }
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
    : effectiveViewMode === 'week'
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

      {/* Mobile Agenda Strip — "Up Next" above calendar */}
      {isMobile && todayAppts.length > 0 && effectiveViewMode === 'day' && (
        <div className={`${card.base} p-3`}>
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="size-3.5 text-[#C2410C]" />
            <h2 className="text-xs font-semibold text-[#0F172A]">Up Next</h2>
            <span className="ml-auto text-[10px] font-medium text-[#94A3B8]">
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
                  className={`shrink-0 w-[140px] text-left rounded-lg border border-stone-200 border-l-[3px] ${border} p-2 hover:bg-stone-50 transition-colors`}
                  onClick={() => handleAppointmentClick(appt)}
                >
                  <p className={`text-[10px] font-semibold ${timeColor} leading-none mb-1`}>{startTime}</p>
                  <p className="text-xs font-semibold text-[#0F172A] truncate">{appt.caller_name}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

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

            {isMobile ? (
              <div className="flex rounded-lg border border-stone-200 overflow-hidden">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${effectiveViewMode === 'day' ? 'bg-[#0F172A] text-white' : 'bg-white text-[#475569] hover:bg-stone-50'}`}
                  onClick={() => setViewMode('day')}
                >
                  Day
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-stone-200 ${effectiveViewMode === 'month' ? 'bg-[#0F172A] text-white' : 'bg-white text-[#475569] hover:bg-stone-50'}`}
                  onClick={() => setViewMode('month')}
                >
                  Month
                </button>
              </div>
            ) : (
              <div className="flex rounded-lg border border-stone-200 overflow-hidden">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'month' ? 'bg-[#0F172A] text-white' : 'bg-white text-[#475569] hover:bg-stone-50'}`}
                  onClick={() => setViewMode('month')}
                >
                  Month
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-stone-200 ${viewMode === 'week' ? 'bg-[#0F172A] text-white' : 'bg-white text-[#475569] hover:bg-stone-50'}`}
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

        {/* Calendar grid — swipeable on mobile day view */}
        <div className={`transition-opacity overflow-hidden ${fading ? 'opacity-0 duration-100' : 'opacity-100 duration-150'}`}>
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
                appointments={data.appointments}
                externalEvents={data.externalEvents}
                travelBuffers={data.travelBuffers}
                currentDate={currentDate}
                viewMode={effectiveViewMode}
                loading={loading}
                onAppointmentClick={handleAppointmentClick}
                onDayClick={handleDayClick}
                onEmptySlotClick={handleEmptySlotClick}
                workingHoursData={workingHoursData}
                isMobile={isMobile}
              />
            </motion.div>
          ) : (
            <CalendarView
              appointments={data.appointments}
              externalEvents={data.externalEvents}
              travelBuffers={data.travelBuffers}
              currentDate={currentDate}
              viewMode={effectiveViewMode}
              loading={loading}
              onAppointmentClick={handleAppointmentClick}
              onDayClick={handleDayClick}
              onEmptySlotClick={handleEmptySlotClick}
              workingHoursData={workingHoursData}
              isMobile={isMobile}
            />
          )}
        </div>
      </div>

      {/* ── Bottom row: Agenda + Connections ────────────────────── */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isMobile ? 'hidden' : ''}`}>

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

      {/* Calendar Connections — mobile only (desktop shows in grid above) */}
      {isMobile && (
        <div className={`${card.base} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="size-4 text-[#C2410C]" />
            <h2 className="text-sm font-semibold text-[#0F172A]">Calendar Connections</h2>
          </div>
          <CalendarSyncCard />
        </div>
      )}

      {/* Appointment Flyout */}
      <AppointmentFlyout
        appointment={selectedAppointment}
        conflict={selectedConflict}
        open={flyoutOpen}
        onOpenChange={setFlyoutOpen}
        onCancelled={handleCancelled}
      />

      {/* Quick-book Sheet */}
      <Sheet open={quickBookOpen} onOpenChange={setQuickBookOpen}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[85vh] rounded-t-2xl" : "sm:max-w-md"}>
          <SheetHeader>
            <SheetTitle>Quick Book</SheetTitle>
            {quickBookSlot && (
              <p className="text-sm text-[#475569]">
                {quickBookSlot.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at{' '}
                {quickBookSlot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </SheetHeader>

          <div className="px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qb-name">Customer Name *</Label>
              <Input
                id="qb-name"
                value={quickBookForm.caller_name}
                onChange={(e) => setQuickBookForm((f) => ({ ...f, caller_name: e.target.value }))}
                placeholder="e.g. John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qb-phone">Phone</Label>
              <Input
                id="qb-phone"
                type="tel"
                value={quickBookForm.caller_phone}
                onChange={(e) => setQuickBookForm((f) => ({ ...f, caller_phone: e.target.value }))}
                placeholder="e.g. +1 555 123 4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qb-job">Job Type</Label>
              <Input
                id="qb-job"
                value={quickBookForm.job_type}
                onChange={(e) => setQuickBookForm((f) => ({ ...f, job_type: e.target.value }))}
                placeholder="e.g. Plumbing repair"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qb-notes">Notes</Label>
              <Input
                id="qb-notes"
                value={quickBookForm.notes}
                onChange={(e) => setQuickBookForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
          </div>

          <SheetFooter className="px-6 pb-6">
            <Button
              onClick={handleQuickBook}
              disabled={quickBookSaving || !quickBookForm.caller_name.trim()}
              className="w-full bg-[#C2410C] hover:bg-[#9A3412] text-white"
            >
              {quickBookSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus className="size-4 mr-2" />}
              {quickBookSaving ? 'Booking...' : 'Book Appointment'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
