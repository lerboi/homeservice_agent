'use client';

import { useState, useEffect } from 'react';
import { Plus, Loader2, CalendarSync, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/**
 * QuickBookSheet — create an appointment from a slot click or toolbar.
 *
 * Props:
 *   open          — boolean
 *   onOpenChange  — function(boolean)
 *   slotDate      — Date object (from empty slot click) or null (from toolbar)
 *   onSave        — async function({ caller_name, caller_phone, job_type, notes, start_time, end_time })
 *   isMobile      — boolean
 */
export default function QuickBookSheet({ open, onOpenChange, slotDate, onSave, isMobile }) {
  const [form, setForm] = useState({
    caller_name: '', caller_phone: '', job_type: '', notes: '',
    service_address: '', postal_code: '', email: '',
  });
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Reset form when sheet opens
  useEffect(() => {
    if (open) {
      setForm({
        caller_name: '', caller_phone: '', job_type: '', notes: '',
        service_address: '', postal_code: '', email: '',
      });
      setSyncToCalendar(true);
      setSaving(false);
      setShowMore(false);

      if (!slotDate) {
        // Toolbar mode — default to today, next whole hour
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        setDate(`${yyyy}-${mm}-${dd}`);
        const nextHour = Math.min(now.getHours() + 1, 23);
        setTime(`${String(nextHour).padStart(2, '0')}:00`);
      }
    }
  }, [open, slotDate]);

  const canSubmit = form.caller_name.trim() && form.caller_phone.trim();

  async function handleSubmit() {
    if (!canSubmit) return;

    let startTime, endTime;
    if (slotDate) {
      startTime = slotDate.toISOString();
      endTime = new Date(slotDate.getTime() + 60 * 60 * 1000).toISOString();
    } else {
      const start = new Date(`${date}T${time}:00`);
      startTime = start.toISOString();
      endTime = new Date(start.getTime() + 60 * 60 * 1000).toISOString();
    }

    setSaving(true);
    try {
      await onSave({
        caller_name: form.caller_name.trim(),
        caller_phone: form.caller_phone.trim(),
        job_type: form.job_type.trim() || null,
        notes: form.notes.trim() || null,
        service_address: form.service_address.trim() || null,
        postal_code: form.postal_code.trim() || null,
        street_name: null,
        email: form.email.trim() || null,
        start_time: startTime,
        end_time: endTime,
        sync_to_calendar: syncToCalendar,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={isMobile ? 'max-h-[85vh] rounded-t-2xl overflow-y-auto' : 'sm:max-w-md overflow-y-auto'}
      >
        <SheetHeader>
          <SheetTitle>Book Appointment</SheetTitle>
          {slotDate && (
            <p className="text-sm text-[#475569]">
              {slotDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at{' '}
              {slotDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </SheetHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Date + Time fields — only shown when opened from toolbar (no slot context) */}
          {!slotDate && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="qb-date">Date</Label>
                <Input
                  id="qb-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qb-time">Time</Label>
                <Input
                  id="qb-time"
                  type="time"
                  step="3600"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="qb-name">Customer Name *</Label>
            <Input
              id="qb-name"
              value={form.caller_name}
              onChange={(e) => setForm((f) => ({ ...f, caller_name: e.target.value }))}
              placeholder="e.g. John Smith"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qb-phone">Phone *</Label>
            <Input
              id="qb-phone"
              type="tel"
              value={form.caller_phone}
              onChange={(e) => setForm((f) => ({ ...f, caller_phone: e.target.value }))}
              placeholder="e.g. +1 555 123 4567"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qb-job">Job Type</Label>
            <Input
              id="qb-job"
              value={form.job_type}
              onChange={(e) => setForm((f) => ({ ...f, job_type: e.target.value }))}
              placeholder="e.g. Plumbing repair"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qb-notes">Notes</Label>
            <Input
              id="qb-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes"
              className="h-11"
            />
          </div>

          {/* More details — optional fields for invoice-ready lead */}
          <div className="border-t border-stone-200/60 pt-3">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="flex items-center justify-between w-full text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              <span>More details (optional)</span>
              {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showMore && (
              <div className="space-y-3 pt-3">
                <div className="space-y-2">
                  <Label htmlFor="qb-address">Street address</Label>
                  <Input
                    id="qb-address"
                    value={form.service_address}
                    onChange={(e) => setForm((f) => ({ ...f, service_address: e.target.value }))}
                    placeholder="e.g. 123 Main St, Apt 4B"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qb-postal">Postal / ZIP code</Label>
                  <Input
                    id="qb-postal"
                    value={form.postal_code}
                    onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                    placeholder="e.g. 12345"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qb-email">Email</Label>
                  <Input
                    id="qb-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="e.g. customer@example.com"
                    className="h-11"
                  />
                </div>
                <p className="text-xs text-stone-500">
                  These fields aren&apos;t required to book, but they make the lead invoice-ready.
                </p>
              </div>
            )}
          </div>

          {/* Sync to calendar toggle */}
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#F5F5F4] border border-stone-200/60">
            <div className="flex items-center gap-2">
              <CalendarSync className="w-4 h-4 text-stone-500" />
              <span className="text-sm text-stone-700">Sync to calendar</span>
            </div>
            <Switch
              id="qb-sync"
              checked={syncToCalendar}
              onCheckedChange={setSyncToCalendar}
              aria-label="Sync appointment to connected calendar"
            />
          </div>
        </div>

        <SheetFooter className="px-6 pb-6">
          <Button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
            className="w-full h-11 bg-[#C2410C] hover:bg-[#9A3412] text-white"
          >
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus className="size-4 mr-2" />}
            {saving ? 'Booking...' : 'Book Appointment'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
