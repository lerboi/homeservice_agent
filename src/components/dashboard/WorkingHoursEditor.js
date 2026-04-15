'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Copy, X, Plus, Clock, Globe, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};
const DAY_LABELS_FULL = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const DEFAULT_DAY = { open: '08:00', close: '17:00', enabled: false, lunchStart: null, lunchEnd: null };

const DEFAULT_HOURS = DAYS.reduce((acc, day) => {
  acc[day] = { ...DEFAULT_DAY };
  return acc;
}, {});

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

const QUICK_SET_PRESETS = [
  {
    value: 'mf_8_5',
    label: 'Mon–Fri 8 AM – 5 PM',
    apply: () => DAYS.reduce((acc, day) => {
      acc[day] = { open: '08:00', close: '17:00', enabled: WEEKDAYS.includes(day), lunchStart: null, lunchEnd: null };
      return acc;
    }, {}),
  },
  {
    value: 'mf_7_6',
    label: 'Mon–Fri 7 AM – 6 PM',
    apply: () => DAYS.reduce((acc, day) => {
      acc[day] = { open: '07:00', close: '18:00', enabled: WEEKDAYS.includes(day), lunchStart: null, lunchEnd: null };
      return acc;
    }, {}),
  },
  {
    value: 'ms_8_5',
    label: 'Mon–Sat 8 AM – 5 PM',
    apply: () => DAYS.reduce((acc, day) => {
      acc[day] = { open: '08:00', close: '17:00', enabled: day !== 'sunday', lunchStart: null, lunchEnd: null };
      return acc;
    }, {}),
  },
  {
    value: 'ms_7_6',
    label: 'Mon–Sat 7 AM – 6 PM',
    apply: () => DAYS.reduce((acc, day) => {
      acc[day] = { open: '07:00', close: '18:00', enabled: day !== 'sunday', lunchStart: null, lunchEnd: null };
      return acc;
    }, {}),
  },
];

const SLOT_DURATION_OPTIONS = [
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
];

const TIMEZONE_GROUPS = [
  {
    label: 'United States',
    zones: [
      { value: 'America/New_York', label: 'Eastern (ET)' },
      { value: 'America/Chicago', label: 'Central (CT)' },
      { value: 'America/Denver', label: 'Mountain (MT)' },
      { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
      { value: 'America/Phoenix', label: 'Arizona (no DST)' },
      { value: 'America/Anchorage', label: 'Alaska (AKT)' },
      { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
    ],
  },
  {
    label: 'Canada',
    zones: [
      { value: 'America/Toronto', label: 'Eastern (ET)' },
      { value: 'America/Winnipeg', label: 'Central (CT)' },
      { value: 'America/Edmonton', label: 'Mountain (MT)' },
      { value: 'America/Vancouver', label: 'Pacific (PT)' },
      { value: 'America/Halifax', label: 'Atlantic (AT)' },
      { value: 'America/St_Johns', label: 'Newfoundland (NT)' },
    ],
  },
  {
    label: 'Asia-Pacific',
    zones: [
      { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
      { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
      { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
      { value: 'Australia/Perth', label: 'Perth (AWST)' },
      { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
    ],
  },
  {
    label: 'Europe',
    zones: [
      { value: 'Europe/London', label: 'London (GMT/BST)' },
      { value: 'Europe/Berlin', label: 'Berlin (CET)' },
      { value: 'Europe/Paris', label: 'Paris (CET)' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTimeToDecimal(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h + m / 60;
}

function formatTimeLabel(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function detectPreset(hours) {
  for (const preset of QUICK_SET_PRESETS) {
    const presetHours = preset.apply();
    if (JSON.stringify(presetHours) === JSON.stringify(hours)) return preset.value;
  }
  return 'custom';
}

// ─── Schedule Preview Bar ─────────────────────────────────────────────────────

const BAR_RANGE_START = 6;
const BAR_RANGE_END = 22;
const BAR_RANGE_HOURS = BAR_RANGE_END - BAR_RANGE_START;

function ScheduleBar({ dayData }) {
  if (!dayData?.enabled) {
    return <div className="h-1.5 rounded-full bg-muted" />;
  }

  const openDec = parseTimeToDecimal(dayData.open);
  const closeDec = parseTimeToDecimal(dayData.close);

  if (dayData.lunchStart && dayData.lunchEnd) {
    const lunchStartDec = parseTimeToDecimal(dayData.lunchStart);
    const lunchEndDec = parseTimeToDecimal(dayData.lunchEnd);

    const bar1Left = ((openDec - BAR_RANGE_START) / BAR_RANGE_HOURS) * 100;
    const bar1Width = ((lunchStartDec - openDec) / BAR_RANGE_HOURS) * 100;
    const bar2Left = ((lunchEndDec - BAR_RANGE_START) / BAR_RANGE_HOURS) * 100;
    const bar2Width = ((closeDec - lunchEndDec) / BAR_RANGE_HOURS) * 100;

    return (
      <div className="relative h-1.5 rounded-full bg-muted">
        <div className="absolute h-full rounded-full bg-[var(--brand-accent)]/60" style={{ left: `${bar1Left}%`, width: `${bar1Width}%` }} />
        <div className="absolute h-full rounded-full bg-[var(--brand-accent)]/60" style={{ left: `${bar2Left}%`, width: `${bar2Width}%` }} />
      </div>
    );
  }

  const leftPct = ((openDec - BAR_RANGE_START) / BAR_RANGE_HOURS) * 100;
  const widthPct = ((closeDec - openDec) / BAR_RANGE_HOURS) * 100;

  return (
    <div className="relative h-1.5 rounded-full bg-muted">
      <div className="absolute h-full rounded-full bg-[var(--brand-accent)]/60" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkingHoursEditor() {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [savedHours, setSavedHours] = useState(null);
  const [slotDuration, setSlotDuration] = useState('60');
  const [savedSlotDuration, setSavedSlotDuration] = useState('60');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [savedTimezone, setSavedTimezone] = useState('America/Chicago');
  const [saving, setSaving] = useState(false);
  const [copyPopoverDay, setCopyPopoverDay] = useState(null);
  const [copySelections, setCopySelections] = useState({});

  const isDirty =
    JSON.stringify(hours) !== JSON.stringify(savedHours) ||
    slotDuration !== savedSlotDuration ||
    timezone !== savedTimezone;

  const allDaysClosed = DAYS.every((d) => !hours[d]?.enabled);
  const activePreset = useMemo(() => detectPreset(hours), [hours]);

  // ── Load data ───────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadHours() {
      try {
        const res = await fetch('/api/working-hours');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        const wh = data.working_hours ? { ...DEFAULT_HOURS, ...data.working_hours } : DEFAULT_HOURS;
        setHours(wh);
        setSavedHours(wh);
        const dur = String(data.slot_duration_mins || 60);
        setSlotDuration(dur);
        setSavedSlotDuration(dur);
        const tz = data.tenant_timezone || 'America/Chicago';
        setTimezone(tz);
        setSavedTimezone(tz);
      } catch {
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    }
    loadHours();
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const updateDay = useCallback((day, field, value) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }, []);

  const toggleLunchBreak = useCallback((day) => {
    setHours((prev) => {
      const current = prev[day];
      if (current.lunchStart) {
        return { ...prev, [day]: { ...current, lunchStart: null, lunchEnd: null } };
      }
      return { ...prev, [day]: { ...current, lunchStart: '12:00', lunchEnd: '13:00' } };
    });
  }, []);

  function handleQuickSet(value) {
    if (value === 'custom') return;
    const preset = QUICK_SET_PRESETS.find((p) => p.value === value);
    if (preset) setHours(preset.apply());
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/working-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          working_hours: hours,
          slot_duration_mins: parseInt(slotDuration, 10),
          tenant_timezone: timezone,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedHours(hours);
      setSavedSlotDuration(slotDuration);
      setSavedTimezone(timezone);
      toast.success('Working hours saved.');
    } catch {
      toast.error("Working hours couldn't be saved. Check your connection and try again.");
    } finally {
      setTimeout(() => setSaving(false), 600);
    }
  }

  function openCopyPopover(day) {
    const initial = DAYS.reduce((acc, d) => {
      if (d !== day) acc[d] = false;
      return acc;
    }, {});
    setCopySelections(initial);
    setCopyPopoverDay(day);
  }

  function applyCopy(sourceDay) {
    const sourceSchedule = hours[sourceDay];
    setHours((prev) => {
      const updated = { ...prev };
      DAYS.forEach((day) => {
        if (copySelections[day]) updated[day] = { ...sourceSchedule };
      });
      return updated;
    });
    setCopyPopoverDay(null);
  }

  function applyToWeekdays(sourceDay) {
    const sourceSchedule = hours[sourceDay];
    setHours((prev) => {
      const updated = { ...prev };
      WEEKDAYS.forEach((day) => {
        if (day !== sourceDay) updated[day] = { ...sourceSchedule };
      });
      return updated;
    });
    setCopyPopoverDay(null);
  }

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="space-y-2">
          {DAYS.map((day) => (
            <Skeleton key={day} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Working hours couldn&apos;t be loaded. Refresh to try again.
        </AlertDescription>
      </Alert>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="working-hours-heading" className="pb-20">
      {/* Subtitle + controls */}
      <p className="text-sm text-muted-foreground mb-5">
        Set the days and hours your team is available. Your AI receptionist uses this to offer booking slots.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Select value={activePreset} onValueChange={handleQuickSet}>
          <SelectTrigger className="w-52 h-9 text-sm">
            <SelectValue placeholder="Quick set…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom" disabled>Custom</SelectItem>
            {QUICK_SET_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger className="w-56 h-9 text-sm">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {TIMEZONE_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.zones.map((z) => (
                  <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Weekly overview */}
      <div className="rounded-xl border border-border bg-muted/50 p-4 mb-6">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Weekly Overview</p>
        <div className="space-y-2">
          {DAYS.map((day) => {
            const d = hours[day] || DEFAULT_DAY;
            return (
              <div key={day} className="flex items-center gap-3">
                <span className={`text-xs w-8 shrink-0 font-medium ${d.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {DAY_LABELS[day]}
                </span>
                <div className="flex-1 min-w-0">
                  <ScheduleBar dayData={d} />
                </div>
                <span className="text-[11px] text-muted-foreground w-24 text-right shrink-0 tabular-nums">
                  {d.enabled
                    ? d.lunchStart
                      ? `${formatTimeLabel(d.open)}\u2013${formatTimeLabel(d.lunchStart)}, ${formatTimeLabel(d.lunchEnd)}\u2013${formatTimeLabel(d.close)}`
                      : `${formatTimeLabel(d.open)}\u2013${formatTimeLabel(d.close)}`
                    : 'Closed'}
                </span>
              </div>
            );
          })}
        </div>
        {/* Time axis labels */}
        <div className="flex justify-between mt-2 px-11">
          <span className="text-[10px] text-muted-foreground/50">6 AM</span>
          <span className="text-[10px] text-muted-foreground/50">12 PM</span>
          <span className="text-[10px] text-muted-foreground/50">6 PM</span>
          <span className="text-[10px] text-muted-foreground/50">10 PM</span>
        </div>
      </div>

      {/* Day cards */}
      <div className="space-y-2">
        {DAYS.map((day) => {
          const dayData = hours[day] || DEFAULT_DAY;
          const hasLunch = !!dayData.lunchStart;
          const isEnabled = !!dayData.enabled;

          return (
            <div
              key={day}
              className={`rounded-xl border px-4 py-3 transition-colors duration-150 ${
                isEnabled
                  ? 'bg-card border-border border-l-[3px] border-l-[var(--brand-accent)]'
                  : 'bg-muted/80 border-border/50'
              }`}
            >
              {/* Day header row — always visible */}
              <div className="flex items-center gap-3">
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => updateDay(day, 'enabled', checked)}
                  aria-label={`Toggle ${DAY_LABELS_FULL[day]}`}
                />
                <span className={`text-sm font-medium min-w-[84px] ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {DAY_LABELS_FULL[day]}
                </span>

                {isEnabled ? (
                  <>
                    {/* Desktop: inline time inputs */}
                    <div className="hidden sm:flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={dayData.open || '08:00'}
                        onChange={(e) => updateDay(day, 'open', e.target.value)}
                        className="h-8 text-sm rounded-lg border border-border px-2.5 bg-card focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/30 focus:border-[var(--brand-accent)] transition-shadow"
                        aria-label={`${DAY_LABELS_FULL[day]} open time`}
                      />
                      <span className="text-muted-foreground/50 text-sm">—</span>
                      <input
                        type="time"
                        value={dayData.close || '17:00'}
                        onChange={(e) => updateDay(day, 'close', e.target.value)}
                        className="h-8 text-sm rounded-lg border border-border px-2.5 bg-card focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/30 focus:border-[var(--brand-accent)] transition-shadow"
                        aria-label={`${DAY_LABELS_FULL[day]} close time`}
                      />
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground italic flex-1">Closed</span>
                )}

                {/* Copy button — always shown */}
                <Popover
                  open={copyPopoverDay === day}
                  onOpenChange={(open) => { if (!open) setCopyPopoverDay(null); }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={() => openCopyPopover(day)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                      aria-label={`Copy ${DAY_LABELS_FULL[day]} to other days`}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-3" side="left" align="start">
                    <p className="text-xs font-medium text-foreground mb-2">
                      Copy {DAY_LABELS_FULL[day]} to:
                    </p>
                    {/* Quick actions */}
                    <div className="flex gap-1.5 mb-3">
                      <button
                        type="button"
                        onClick={() => applyToWeekdays(day)}
                        className="text-xs px-2.5 py-1 rounded-md bg-muted hover:bg-accent text-foreground transition-colors"
                      >
                        All weekdays
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCopySelections(DAYS.reduce((acc, d) => {
                            if (d !== day) acc[d] = true;
                            return acc;
                          }, {}));
                        }}
                        className="text-xs px-2.5 py-1 rounded-md bg-muted hover:bg-accent text-foreground transition-colors"
                      >
                        Select all
                      </button>
                    </div>
                    <div className="space-y-1">
                      {DAYS.filter((d) => d !== day).map((d) => (
                        <label key={d} className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={!!copySelections[d]}
                            onChange={(e) =>
                              setCopySelections((prev) => ({ ...prev, [d]: e.target.checked }))
                            }
                            className="rounded border-border text-[var(--brand-accent)] focus:ring-[var(--brand-accent)]"
                          />
                          <span className="text-sm text-foreground/80">{DAY_LABELS_FULL[d]}</span>
                        </label>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-3 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)]"
                      onClick={() => applyCopy(day)}
                      disabled={!Object.values(copySelections).some(Boolean)}
                    >
                      Apply
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Mobile: stacked time inputs */}
              {isEnabled && (
                <div className="sm:hidden mt-3 flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Opens</label>
                    <input
                      type="time"
                      value={dayData.open || '08:00'}
                      onChange={(e) => updateDay(day, 'open', e.target.value)}
                      className="h-9 w-full text-sm rounded-lg border border-border px-2.5 bg-card focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/30 focus:border-[var(--brand-accent)]"
                      aria-label={`${DAY_LABELS_FULL[day]} open time`}
                    />
                  </div>
                  <span className="text-muted-foreground/50 mt-5">—</span>
                  <div className="flex-1">
                    <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Closes</label>
                    <input
                      type="time"
                      value={dayData.close || '17:00'}
                      onChange={(e) => updateDay(day, 'close', e.target.value)}
                      className="h-9 w-full text-sm rounded-lg border border-border px-2.5 bg-card focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/30 focus:border-[var(--brand-accent)]"
                      aria-label={`${DAY_LABELS_FULL[day]} close time`}
                    />
                  </div>
                </div>
              )}

              {/* Break section */}
              {isEnabled && (
                <div className="mt-2.5 ml-11 sm:ml-[calc(36px+84px+12px+12px)]">
                  {hasLunch ? (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted border border-border">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Break:</span>
                      <input
                        type="time"
                        value={dayData.lunchStart || '12:00'}
                        onChange={(e) => updateDay(day, 'lunchStart', e.target.value)}
                        className="h-6 text-xs rounded border border-border px-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/30 focus:border-[var(--brand-accent)]"
                        aria-label={`${DAY_LABELS_FULL[day]} break start`}
                      />
                      <span className="text-muted-foreground/50 text-xs">–</span>
                      <input
                        type="time"
                        value={dayData.lunchEnd || '13:00'}
                        onChange={(e) => updateDay(day, 'lunchEnd', e.target.value)}
                        className="h-6 text-xs rounded border border-border px-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/30 focus:border-[var(--brand-accent)]"
                        aria-label={`${DAY_LABELS_FULL[day]} break end`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleLunchBreak(day)}
                        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                        aria-label="Remove break"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleLunchBreak(day)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[var(--brand-accent)] transition-colors py-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add break
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* All-days-off warning */}
      {allDaysClosed && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-700">
            All days are set to closed. Your AI receptionist will not be able to offer any booking slots.
          </p>
        </div>
      )}

      {/* Appointment duration */}
      <div className="mt-6 pt-5 border-t border-border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Default appointment duration</span>
          </div>
          <Select value={slotDuration} onValueChange={setSlotDuration}>
            <SelectTrigger className="w-32 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLOT_DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 ml-6">
          Your AI will offer <span className="font-medium text-muted-foreground">{SLOT_DURATION_OPTIONS.find((o) => o.value === slotDuration)?.label}</span> time slots when booking appointments.
        </p>
      </div>

      {/* Sticky save bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 lg:left-60 z-30 transition-all duration-300 ease-out ${
          isDirty
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-4px_12px_0_rgba(0,0,0,0.05)] px-6 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm text-amber-700 font-medium">Unsaved changes</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setHours(savedHours);
                  setSlotDuration(savedSlotDuration);
                  setTimezone(savedTimezone);
                }}
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white min-w-[100px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
