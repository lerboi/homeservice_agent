'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { card } from '@/lib/design-tokens';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Phone, Copy, Pencil, Trash2, AlertTriangle } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUTING_DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

const WH_TO_ROUTE_KEY = {
  monday: 'mon',
  tuesday: 'tue',
  wednesday: 'wed',
  thursday: 'thu',
  friday: 'fri',
  saturday: 'sat',
  sunday: 'sun',
};

const E164_RE = /^\+[1-9]\d{1,14}$/;

const DEFAULT_SCHEDULE = {
  enabled: false,
  days: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usageColor(used, cap) {
  const pct = cap > 0 ? (used / cap) * 100 : 0;
  if (pct > 90) return 'bg-red-500';
  if (pct > 70) return 'bg-amber-500';
  return 'bg-green-500';
}

function validatePhone(number, existingNumbers, excludeIdx = -1) {
  const cleaned = number.replace(/[\s\-()]/g, '');
  if (!E164_RE.test(cleaned)) return 'Enter a valid phone number including country code (e.g. +1 555 000 0000).';
  const isDuplicate = existingNumbers.some((p, i) => i !== excludeIdx && p.number === cleaned);
  if (isDuplicate) return 'This number is already in your list.';
  return '';
}

function cleanPhone(number) {
  return number.replace(/[\s\-()]/g, '');
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CallRoutingPage() {
  // Data state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [pickupNumbers, setPickupNumbers] = useState([]);
  const [dialTimeout, setDialTimeout] = useState(15);
  const [usage, setUsage] = useState({ used_minutes: 0, cap_minutes: 5000, country: 'US' });
  const [workingHours, setWorkingHours] = useState(null);

  // Add pickup number form state
  const [newNumber, setNewNumber] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newSmsForward, setNewSmsForward] = useState(true);

  // Editing state
  const [editingIdx, setEditingIdx] = useState(null);
  const [editNumber, setEditNumber] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editSmsForward, setEditSmsForward] = useState(true);

  // Validation errors
  const [phoneError, setPhoneError] = useState('');
  const [editPhoneError, setEditPhoneError] = useState('');
  const [showZeroNumbersWarning, setShowZeroNumbersWarning] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/call-routing');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();

        if (data.call_forwarding_schedule) {
          setSchedule(data.call_forwarding_schedule);
        }
        if (data.pickup_numbers) {
          setPickupNumbers(data.pickup_numbers);
        }
        if (typeof data.dial_timeout_seconds === 'number') {
          setDialTimeout(data.dial_timeout_seconds);
        }
        if (data.usage) {
          setUsage(data.usage);
        }
        if (data.working_hours) {
          setWorkingHours(data.working_hours);
        }
      } catch {
        toast.error('Failed to load call routing settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // ── Schedule handlers ─────────────────────────────────────────────────────

  function handleMasterToggle(checked) {
    setSchedule((prev) => ({ ...prev, enabled: checked }));
    if (!checked) setShowZeroNumbersWarning(false);
  }

  function handleDayToggle(dayKey, checked) {
    setSchedule((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [dayKey]: checked ? [{ start: '09:00', end: '17:00' }] : [],
      },
    }));
  }

  function handleTimeChange(dayKey, field, value) {
    setSchedule((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [dayKey]: prev.days[dayKey].map((range, i) =>
          i === 0 ? { ...range, [field]: value } : range
        ),
      },
    }));
  }

  function handleCopyFromWorkingHours() {
    if (!workingHours) return;
    const days = {};
    for (const [whDay, routeKey] of Object.entries(WH_TO_ROUTE_KEY)) {
      const d = workingHours[whDay];
      days[routeKey] = d?.enabled && d?.open && d?.close
        ? [{ start: d.open, end: d.close }]
        : [];
    }
    setSchedule((prev) => ({ ...prev, days }));
    toast.success('Schedule copied from working hours');
  }

  // ── Pickup number handlers ────────────────────────────────────────────────

  function handleAddPickupNumber() {
    const cleaned = cleanPhone(newNumber);
    const error = validatePhone(cleaned, pickupNumbers);
    if (error) {
      setPhoneError(error);
      return;
    }
    setPhoneError('');
    setPickupNumbers((prev) => [
      ...prev,
      { number: cleaned, label: newLabel.trim() || 'Phone', sms_forward: newSmsForward },
    ]);
    setNewNumber('');
    setNewLabel('');
    setNewSmsForward(true);
    setShowZeroNumbersWarning(false);
    toast.success('Pickup number added');
  }

  function handleDeletePickupNumber(idx) {
    setPickupNumbers((prev) => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
    toast.success('Pickup number removed');
  }

  function handleStartEdit(idx) {
    const pn = pickupNumbers[idx];
    setEditingIdx(idx);
    setEditNumber(pn.number);
    setEditLabel(pn.label);
    setEditSmsForward(pn.sms_forward);
    setEditPhoneError('');
  }

  function handleCancelEdit() {
    setEditingIdx(null);
    setEditPhoneError('');
  }

  function handleSaveEdit() {
    const cleaned = cleanPhone(editNumber);
    const error = validatePhone(cleaned, pickupNumbers, editingIdx);
    if (error) {
      setEditPhoneError(error);
      return;
    }
    setEditPhoneError('');
    setPickupNumbers((prev) =>
      prev.map((pn, i) =>
        i === editingIdx
          ? { number: cleaned, label: editLabel.trim() || 'Phone', sms_forward: editSmsForward }
          : pn
      )
    );
    setEditingIdx(null);
    toast.success('Pickup number updated');
  }

  // ── Save handler ──────────────────────────────────────────────────────────

  async function handleSave() {
    if (schedule.enabled && pickupNumbers.length === 0) {
      setShowZeroNumbersWarning(true);
      return;
    }
    setShowZeroNumbersWarning(false);
    setSaving(true);
    try {
      const res = await fetch('/api/call-routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_forwarding_schedule: schedule,
          pickup_numbers: pickupNumbers,
          dial_timeout_seconds: dialTimeout,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to save — please try again');
        return;
      }
      toast.success('Call routing settings saved');
    } catch {
      toast.error('Failed to save — please try again');
    } finally {
      setSaving(false);
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-[400px] w-full rounded-2xl" />
        <Skeleton className="h-[200px] w-full rounded-2xl" />
        <Skeleton className="h-[100px] w-full rounded-2xl" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {/* ── Card 1: Schedule & Timeout ─────────────────────────────────── */}
      <div className={`${card.base} p-6 mb-8`}>
        <h2 className="text-xl font-semibold text-[#0F172A] mb-1">Call Routing</h2>
        <p className="text-sm text-[#475569] mb-6">
          Route calls to yourself during business hours. AI answers when you&apos;re unavailable.
        </p>

        {/* Master toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-[#475569]" />
            <span className="text-sm font-medium text-[#0F172A]">
              {schedule.enabled ? 'Routing active' : 'AI answers all calls'}
            </span>
          </div>
          <Switch
            checked={schedule.enabled}
            onCheckedChange={handleMasterToggle}
            aria-label="Toggle call routing"
          />
        </div>

        {/* Copy from working hours button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyFromWorkingHours}
          disabled={!workingHours}
          className="mb-4"
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy from working hours
        </Button>

        {/* Schedule description */}
        <p className="text-sm text-[#475569] mb-4">
          Set the hours when calls ring your phone. Outside these hours, AI answers automatically.
        </p>

        {/* Day list */}
        <div className={`space-y-2 ${!schedule.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
          {ROUTING_DAYS.map(({ key, label }) => {
            const ranges = schedule.days[key] || [];
            const isDayEnabled = ranges.length > 0;
            const range = ranges[0] || { start: '09:00', end: '17:00' };

            return (
              <div
                key={key}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  isDayEnabled
                    ? 'bg-white border-stone-200 border-l-[3px] border-l-[#C2410C]'
                    : 'bg-stone-50/80 border-stone-100'
                }`}
              >
                <Switch
                  checked={isDayEnabled}
                  onCheckedChange={(checked) => handleDayToggle(key, checked)}
                  aria-label={`Toggle ${label}`}
                />
                <span className={`text-sm font-medium min-w-[84px] ${isDayEnabled ? 'text-[#0F172A]' : 'text-stone-400'}`}>
                  {label}
                </span>

                {isDayEnabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    {/* Uses native <input type="time"> for start/end pickers */}
                    <input type="time"
                      value={range.start}
                      onChange={(e) => handleTimeChange(key, 'start', e.target.value)}
                      className="h-8 text-sm rounded-lg border border-stone-200 px-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C]/30 focus:border-[#C2410C] transition-shadow"
                      aria-label={`${label} start time`}
                    />
                    <span className="text-stone-300 text-sm">&mdash;</span>
                    <input type="time"
                      value={range.end}
                      onChange={(e) => handleTimeChange(key, 'end', e.target.value)}
                      className="h-8 text-sm rounded-lg border border-stone-200 px-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#C2410C]/30 focus:border-[#C2410C] transition-shadow"
                      aria-label={`${label} end time`}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-stone-400 italic flex-1">AI all day</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Separator */}
        <hr className="my-6 border-stone-200" />

        {/* Dial timeout */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-[#0F172A]">
            Ring for {dialTimeout} seconds before AI picks up
          </label>
          <Slider
            value={[dialTimeout]}
            onValueChange={([v]) => setDialTimeout(v)}
            min={10}
            max={30}
            step={1}
            className="w-full max-w-xs"
          />
          <div className="flex justify-between text-xs text-stone-400 max-w-xs">
            <span>10s</span>
            <span>30s</span>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>

      {/* ── Card 2: Pickup Numbers ─────────────────────────────────────── */}
      <div className={`${card.base} p-6 mb-8`}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-semibold text-[#0F172A]">Pickup Numbers</h2>
          <span className="text-sm text-[#475569]">({pickupNumbers.length} of 5)</span>
        </div>
        <p className="text-sm text-[#475569] mb-4">
          Calls ring all numbers simultaneously. First to answer wins.
        </p>

        {/* Empty state */}
        {pickupNumbers.length === 0 && editingIdx === null && (
          <p className="text-sm text-stone-400 py-4">
            No pickup numbers yet. Add a number below to receive forwarded calls.
          </p>
        )}

        {/* Existing numbers list */}
        <div className="space-y-2 mb-4">
          {pickupNumbers.map((pn, idx) => (
            <div key={idx}>
              {editingIdx === idx ? (
                /* Editing row */
                <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 space-y-3">
                  <div className="space-y-1">
                    <Input
                      placeholder="+1 555 000 0000"
                      value={editNumber}
                      onChange={(e) => { setEditNumber(e.target.value); setEditPhoneError(''); }}
                      aria-label="Edit phone number"
                    />
                    {editPhoneError && (
                      <p className="text-xs text-destructive mt-1">{editPhoneError}</p>
                    )}
                  </div>
                  <Input
                    placeholder="e.g. Cell, Office"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    aria-label="Edit label"
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editSmsForward}
                      onCheckedChange={setEditSmsForward}
                      aria-label="Forward SMS"
                    />
                    <span className="text-sm text-[#475569]">Forward SMS</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                  </div>
                </div>
              ) : (
                /* Display row */
                <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Phone className="h-4 w-4 text-[#475569] shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-[#0F172A] block truncate">
                        {pn.number}
                      </span>
                      <span className="text-xs text-[#475569]">{pn.label}</span>
                    </div>
                    {pn.sms_forward && (
                      <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                        SMS
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(idx)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-stone-400 hover:text-[#0F172A] hover:bg-stone-100 transition-colors"
                      aria-label="Edit pickup number"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePickupNumber(idx)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-stone-400 hover:text-destructive hover:bg-red-50 transition-colors"
                      aria-label="Remove pickup number"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add pickup number form */}
        {pickupNumbers.length < 5 ? (
          <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/30 p-4 space-y-3">
            <div className="space-y-1">
              <Input
                placeholder="+1 555 000 0000"
                value={newNumber}
                onChange={(e) => { setNewNumber(e.target.value); setPhoneError(''); }}
                aria-label="New phone number"
              />
              {phoneError && (
                <p className="text-xs text-destructive mt-1">{phoneError}</p>
              )}
            </div>
            <Input
              placeholder="e.g. Cell, Office"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              aria-label="New phone label"
            />
            <div className="flex items-center gap-2">
              <Switch
                checked={newSmsForward}
                onCheckedChange={setNewSmsForward}
                aria-label="Forward SMS for new number"
              />
              <span className="text-sm text-[#475569]">Forward SMS</span>
            </div>
            <Button variant="outline" onClick={handleAddPickupNumber}>
              Add pickup number
            </Button>
          </div>
        ) : (
          <p className="text-sm text-stone-400 py-2">Maximum 5 numbers reached</p>
        )}

        {/* Zero-numbers warning */}
        {showZeroNumbersWarning && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Add at least one pickup number to route calls to you.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* ── Card 3: Usage This Month ───────────────────────────────────── */}
      <div className={`${card.base} p-6`}>
        <p className="text-sm font-semibold text-[#0F172A] mb-3">
          Outbound minutes used this month
        </p>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className={`h-full rounded-full transition-all ${usageColor(usage.used_minutes, usage.cap_minutes)}`}
            style={{ width: `${Math.min(100, (usage.used_minutes / usage.cap_minutes) * 100)}%` }}
          />
        </div>
        <p className="text-sm text-[#475569] mt-2">
          {usage.used_minutes} of {usage.cap_minutes.toLocaleString()} minutes used
        </p>
        <p className="text-xs text-stone-400 mt-1">
          Resets on the 1st of each month
        </p>
      </div>
    </motion.div>
  );
}
