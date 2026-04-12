'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { card } from '@/lib/design-tokens';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Phone, PhoneForwarded, Copy, Pencil, Trash2, AlertTriangle, Star } from 'lucide-react';

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
  const [workingHours, setWorkingHours] = useState(null);

  // Saved snapshots for dirty-state tracking
  const [savedSchedule, setSavedSchedule] = useState(DEFAULT_SCHEDULE);
  const [savedPickupNumbers, setSavedPickupNumbers] = useState([]);
  const [savedDialTimeout, setSavedDialTimeout] = useState(15);

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

  // VIP number state
  const [vipNumbers, setVipNumbers] = useState([]);
  const [savedVipNumbers, setSavedVipNumbers] = useState([]);
  const [newVipNumber, setNewVipNumber] = useState('');
  const [newVipLabel, setNewVipLabel] = useState('');
  const [vipPhoneError, setVipPhoneError] = useState('');
  const [editingVipIdx, setEditingVipIdx] = useState(null);
  const [editVipNumber, setEditVipNumber] = useState('');
  const [editVipLabel, setEditVipLabel] = useState('');
  const [editVipPhoneError, setEditVipPhoneError] = useState('');

  // Lead-sourced priority callers (read-only — mutations go through PATCH /api/leads/[id])
  const [vipLeads, setVipLeads] = useState([]);
  const router = useRouter();

  // Dirty state
  const isDirty =
    JSON.stringify(schedule) !== JSON.stringify(savedSchedule) ||
    JSON.stringify(pickupNumbers) !== JSON.stringify(savedPickupNumbers) ||
    dialTimeout !== savedDialTimeout ||
    JSON.stringify(vipNumbers) !== JSON.stringify(savedVipNumbers);

  // ── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/call-routing');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();

        const loadedSchedule = data.call_forwarding_schedule || DEFAULT_SCHEDULE;
        const loadedNumbers = data.pickup_numbers || [];
        const loadedTimeout = typeof data.dial_timeout_seconds === 'number' ? data.dial_timeout_seconds : 15;

        const loadedVipNumbers = data.vip_numbers || [];
        const loadedVipLeads = data.vip_leads || [];
        setVipLeads(loadedVipLeads);

        setSchedule(loadedSchedule);
        setPickupNumbers(loadedNumbers);
        setDialTimeout(loadedTimeout);
        setVipNumbers(loadedVipNumbers);
        if (data.working_hours) setWorkingHours(data.working_hours);

        // Set saved snapshots
        setSavedSchedule(loadedSchedule);
        setSavedPickupNumbers(loadedNumbers);
        setSavedDialTimeout(loadedTimeout);
        setSavedVipNumbers(loadedVipNumbers);
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
  }

  function handleDeletePickupNumber(idx) {
    setPickupNumbers((prev) => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) {
      setEditingIdx(null);
    } else if (editingIdx !== null && idx < editingIdx) {
      setEditingIdx(editingIdx - 1);
    }
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
  }

  // ── VIP number handlers ───────────────────────────────────────────────────

  function handleAddVipNumber() {
    const cleaned = cleanPhone(newVipNumber);
    if (!E164_RE.test(cleaned)) {
      setVipPhoneError('Enter a valid phone number including country code (e.g. +1 555 000 0000).');
      return;
    }
    const isDuplicate = vipNumbers.some((v) => v.number === cleaned);
    if (isDuplicate) {
      setVipPhoneError('This number is already in your priority list.');
      return;
    }
    setVipPhoneError('');
    setVipNumbers((prev) => [
      ...prev,
      { number: cleaned, label: newVipLabel.trim() || '' },
    ]);
    setNewVipNumber('');
    setNewVipLabel('');
  }

  function handleDeleteVipNumber(idx) {
    setVipNumbers((prev) => prev.filter((_, i) => i !== idx));
    toast.success('Priority number removed');
    if (editingVipIdx === idx) {
      setEditingVipIdx(null);
    } else if (editingVipIdx !== null && idx < editingVipIdx) {
      setEditingVipIdx(editingVipIdx - 1);
    }
  }

  function handleStartVipEdit(idx) {
    const vn = vipNumbers[idx];
    setEditingVipIdx(idx);
    setEditVipNumber(vn.number);
    setEditVipLabel(vn.label || '');
    setEditVipPhoneError('');
  }

  function handleCancelVipEdit() {
    setEditingVipIdx(null);
    setEditVipPhoneError('');
  }

  function handleSaveVipEdit() {
    const cleaned = cleanPhone(editVipNumber);
    if (!E164_RE.test(cleaned)) {
      setEditVipPhoneError('Enter a valid phone number including country code (e.g. +1 555 000 0000).');
      return;
    }
    const isDuplicate = vipNumbers.some((v, i) => i !== editingVipIdx && v.number === cleaned);
    if (isDuplicate) {
      setEditVipPhoneError('This number is already in your priority list.');
      return;
    }
    setEditVipPhoneError('');
    setVipNumbers((prev) =>
      prev.map((vn, i) =>
        i === editingVipIdx
          ? { number: cleaned, label: editVipLabel.trim() || '' }
          : vn
      )
    );
    setEditingVipIdx(null);
  }

  async function handleRemoveVipLead(leadId) {
    // Optimistic remove
    const prevLeads = vipLeads;
    setVipLeads((prev) => prev.filter((l) => l.id !== leadId));
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_vip: false }),
      });
      if (!res.ok) {
        setVipLeads(prevLeads); // revert
        toast.error('Could not update priority status — try again');
        return;
      }
      toast.success('Priority status removed');
    } catch {
      setVipLeads(prevLeads); // revert
      toast.error('Could not update priority status — try again');
    }
  }

  function handleOpenLead(leadId) {
    router.push(`/dashboard/leads?open=${leadId}`);
  }

  // ── Save / Discard handlers ───────────────────────────────────────────────

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
          vip_numbers: vipNumbers,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to save — please try again');
        return;
      }
      // Update saved snapshots
      setSavedSchedule(schedule);
      setSavedPickupNumbers(pickupNumbers);
      setSavedDialTimeout(dialTimeout);
      setSavedVipNumbers(vipNumbers);
      toast.success('Call routing settings saved');
    } catch {
      toast.error('Failed to save — please try again');
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setSchedule(savedSchedule);
    setPickupNumbers(savedPickupNumbers);
    setDialTimeout(savedDialTimeout);
    setVipNumbers(savedVipNumbers);
    setShowZeroNumbersWarning(false);
  }

  // ── Unified Priority Callers list ─────────────────────────────────────────
  // Merge both sources with source metadata
  // Sort: alphabetical by displayName (case-insensitive), ties broken by phone number
  const unifiedPriority = [
    ...vipNumbers.map((vn, idx) => ({
      source: 'standalone',
      key: `standalone-${idx}`,
      idx,                           // needed for edit/delete handlers
      id: null,
      number: vn.number,
      displayName: vn.label || '',
    })),
    ...vipLeads.map((l) => ({
      source: 'lead',
      key: `lead-${l.id}`,
      idx: null,
      id: l.id,
      number: l.from_number,
      displayName: l.caller_name || '',
    })),
  ].sort((a, b) => {
    const an = (a.displayName || a.number).toLowerCase();
    const bn = (b.displayName || b.number).toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    return a.number.localeCompare(b.number);
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-6 w-56 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-[88px] w-full rounded-2xl" />
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
      className="space-y-6 pb-20"
    >
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-[#0F172A] mb-1">Call Routing</h1>
        <p className="text-sm text-[#475569]">
          Control how incoming calls are handled &mdash; forward to your phone on a schedule, and mark priority callers who always ring through.
        </p>
      </div>

      {/* ── Hero toggle ───────────────────────────────────────────────── */}
      <div className={`${card.base} p-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center h-10 w-10 rounded-lg transition-colors ${
              schedule.enabled ? 'bg-[#C2410C]/10' : 'bg-stone-100'
            }`}>
              <PhoneForwarded className={`h-5 w-5 transition-colors ${
                schedule.enabled ? 'text-[#C2410C]' : 'text-stone-400'
              }`} />
            </div>
            <div>
              <span className="text-sm font-semibold text-[#0F172A] block">
                Answer calls yourself
              </span>
              <span className="text-xs text-[#475569] block mt-0.5">
                {schedule.enabled
                  ? 'Calls ring your phone during scheduled hours'
                  : 'Your AI receptionist answers all calls'}
              </span>
            </div>
          </div>
          <Switch
            checked={schedule.enabled}
            onCheckedChange={handleMasterToggle}
            aria-label="Answer calls yourself"
          />
        </div>
      </div>

      {/* -- Priority Callers (always visible, outside AnimatePresence per D-03) --- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className={`${card.base} p-6`}>
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-5 w-5 text-violet-500" />
            <h2 className="text-lg font-semibold text-[#0F172A]">Priority Callers</h2>
          </div>
          <p className="text-sm text-[#475569] mb-4">
            These callers always ring your phone — day or night, regardless of schedule.
          </p>

          {/* Unified Priority Callers list */}
          <div className="space-y-2 mb-4">
            {unifiedPriority.length === 0 && (
              <p className="text-sm text-stone-400 py-2">
                No priority callers yet. Add a phone number below to give someone priority access.
              </p>
            )}
            {unifiedPriority.map((entry) => (
              <div key={entry.key}>
                {entry.source === 'standalone' && editingVipIdx === entry.idx ? (
                  /* Editing row — standalone only */
                  <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 space-y-3">
                    <div className="space-y-1">
                      <Input
                        placeholder="+1 555 000 0000"
                        value={editVipNumber}
                        onChange={(e) => { setEditVipNumber(e.target.value); setEditVipPhoneError(''); }}
                        aria-label="Edit priority phone number"
                      />
                      {editVipPhoneError && (
                        <p className="text-xs text-destructive mt-1">{editVipPhoneError}</p>
                      )}
                    </div>
                    <Input
                      placeholder="e.g. Best customer, Landlord"
                      value={editVipLabel}
                      onChange={(e) => setEditVipLabel(e.target.value)}
                      aria-label="Edit priority label"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveVipEdit}>Save</Button>
                      <Button size="sm" variant="outline" onClick={handleCancelVipEdit}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  /* Display row */
                  <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Star className="h-4 w-4 text-violet-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-[#0F172A] block truncate">
                          {entry.number}
                        </span>
                        {entry.displayName && (
                          <span className="text-xs text-[#475569]">{entry.displayName}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {entry.source === 'lead' && (
                        <button
                          type="button"
                          onClick={() => handleOpenLead(entry.id)}
                          className="min-h-[44px] px-2 flex items-center justify-center rounded-lg text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                          title="View lead"
                          aria-label="View lead"
                        >
                          Lead ↗
                        </button>
                      )}
                      {entry.source === 'standalone' && (
                        <button
                          type="button"
                          onClick={() => handleStartVipEdit(entry.idx)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-stone-400 hover:text-[#0F172A] hover:bg-stone-100 transition-colors"
                          aria-label="Edit priority number"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          entry.source === 'lead'
                            ? handleRemoveVipLead(entry.id)
                            : handleDeleteVipNumber(entry.idx)
                        }
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-stone-400 hover:text-destructive hover:bg-red-50 transition-colors"
                        aria-label={entry.source === 'lead' ? 'Remove priority status from lead' : 'Remove priority number'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add priority number form */}
          <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/30 p-4 space-y-3">
            <div className="space-y-1">
              <Input
                placeholder="+1 555 000 0000"
                value={newVipNumber}
                onChange={(e) => { setNewVipNumber(e.target.value); setVipPhoneError(''); }}
                aria-label="New priority phone number"
              />
              {vipPhoneError && (
                <p className="text-xs text-destructive mt-1">{vipPhoneError}</p>
              )}
            </div>
            <Input
              placeholder="e.g. Best customer, Landlord"
              value={newVipLabel}
              onChange={(e) => setNewVipLabel(e.target.value)}
              aria-label="Priority label"
            />
            <Button variant="outline" onClick={handleAddVipNumber}>
              Add priority number
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── Conditional sections (visible when enabled) ───────────── */}
      <AnimatePresence>
        {schedule.enabled && (
          <>
            {/* ── Your Schedule ─────────────────────────────────────── */}
            <motion.div
              key="schedule"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`${card.base} p-6`}>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-semibold text-[#0F172A]">Your Schedule</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyFromWorkingHours}
                    disabled={!workingHours}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy from working hours
                  </Button>
                </div>
                <p className="text-sm text-[#475569] mb-4">
                  When should calls ring your phone? Outside these hours, AI answers automatically.
                </p>

                {/* Day list */}
                <div className="space-y-2">
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
              </div>
            </motion.div>

            {/* ── Your Phone Numbers ────────────────────────────────── */}
            <motion.div
              key="phone-numbers"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, delay: 0.05 }}
            >
              <div className={`${card.base} p-6`}>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-semibold text-[#0F172A]">Your Phone Numbers</h2>
                  <span className="text-sm text-[#475569]">{pickupNumbers.length} of 5</span>
                </div>
                <p className="text-sm text-[#475569] mb-4">
                  Add the phones you want to ring. All numbers ring at the same time &mdash; first to pick up gets the call.
                </p>

                {/* Empty state */}
                {pickupNumbers.length === 0 && editingIdx === null && (
                  <p className="text-sm text-stone-400 py-4">
                    No phone numbers yet. Add a number below to start receiving calls.
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
                      Add phone number
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
                      Add at least one phone number so calls can ring your phone.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </motion.div>

            {/* ── Ring Duration ──────────────────────────────────────── */}
            <motion.div
              key="ring-duration"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, delay: 0.1 }}
            >
              <div className={`${card.base} p-6`}>
                <h2 className="text-lg font-semibold text-[#0F172A] mb-1">Ring Duration</h2>
                <p className="text-sm text-[#475569] mb-4">
                  How long should your phone ring before AI picks up?
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[dialTimeout]}
                      onValueChange={([v]) => setDialTimeout(v)}
                      min={10}
                      max={30}
                      step={1}
                      className="flex-1 max-w-xs"
                    />
                    <span className="text-sm font-medium text-[#0F172A] tabular-nums w-8">
                      {dialTimeout}s
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-stone-400 max-w-xs">
                    <span>10 seconds</span>
                    <span>30 seconds</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Sticky save bar ───────────────────────────────────────── */}
      <div
        className={`fixed bottom-0 left-0 right-0 lg:left-60 z-30 transition-all duration-300 ease-out ${
          isDirty
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-[0_-4px_12px_0_rgba(0,0,0,0.05)] px-6 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm text-amber-700 font-medium">Unsaved changes</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleDiscard}>
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="min-w-[100px]"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
