'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const DEFAULT_DAY = { open: '08:00', close: '17:00', enabled: false, lunchStart: null, lunchEnd: null };

const DEFAULT_HOURS = DAYS.reduce((acc, day) => {
  acc[day] = { ...DEFAULT_DAY };
  return acc;
}, {});

const QUICK_SET_PRESETS = [
  {
    value: 'mf_8_5',
    label: 'Mon–Fri 8 AM–5 PM',
    apply: () => {
      const hours = DAYS.reduce((acc, day) => {
        acc[day] = {
          open: '08:00',
          close: '17:00',
          enabled: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(day),
          lunchStart: null,
          lunchEnd: null,
        };
        return acc;
      }, {});
      return hours;
    },
  },
  {
    value: 'mf_7_6',
    label: 'Mon–Fri 7 AM–6 PM',
    apply: () => {
      const hours = DAYS.reduce((acc, day) => {
        acc[day] = {
          open: '07:00',
          close: '18:00',
          enabled: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(day),
          lunchStart: null,
          lunchEnd: null,
        };
        return acc;
      }, {});
      return hours;
    },
  },
  {
    value: 'ms_8_5',
    label: 'Mon–Sat 8 AM–5 PM',
    apply: () => {
      const hours = DAYS.reduce((acc, day) => {
        acc[day] = {
          open: '08:00',
          close: '17:00',
          enabled: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(day),
          lunchStart: null,
          lunchEnd: null,
        };
        return acc;
      }, {});
      return hours;
    },
  },
  {
    value: 'ms_7_6',
    label: 'Mon–Sat 7 AM–6 PM',
    apply: () => {
      const hours = DAYS.reduce((acc, day) => {
        acc[day] = {
          open: '07:00',
          close: '18:00',
          enabled: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(day),
          lunchStart: null,
          lunchEnd: null,
        };
        return acc;
      }, {});
      return hours;
    },
  },
];

const SLOT_DURATION_OPTIONS = [
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '60 min' },
  { value: '90', label: '90 min' },
  { value: '120', label: '2 hours' },
];

export default function WorkingHoursEditor() {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [savedHours, setSavedHours] = useState(null);
  const [slotDuration, setSlotDuration] = useState('60');
  const [savedSlotDuration, setSavedSlotDuration] = useState('60');
  const [saving, setSaving] = useState(false);
  const [copyPopoverDay, setCopyPopoverDay] = useState(null);
  const [copySelections, setCopySelections] = useState({});

  const isDirty = JSON.stringify(hours) !== JSON.stringify(savedHours) || slotDuration !== savedSlotDuration;
  const allDaysClosed = DAYS.every((d) => !hours[d]?.enabled);

  useEffect(() => {
    async function loadHours() {
      try {
        const res = await fetch('/api/working-hours');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        const wh = data.working_hours
          ? { ...DEFAULT_HOURS, ...data.working_hours }
          : DEFAULT_HOURS;
        setHours(wh);
        setSavedHours(wh);
        const dur = String(data.slot_duration_mins || 60);
        setSlotDuration(dur);
        setSavedSlotDuration(dur);
      } catch {
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    }
    loadHours();
  }, []);

  const updateDay = useCallback((day, field, value) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
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
    if (preset) {
      const newHours = preset.apply();
      setHours(newHours);
    }
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
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedHours(hours);
      setSavedSlotDuration(slotDuration);
      toast.success('Working hours saved.');
    } catch {
      toast.error("Working hours couldn't be saved. Check your connection and try again.");
    } finally {
      // Keep spinner for at least 600ms for perceived smoothness
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

  function applyCopyTodays(sourceDay) {
    const sourceSchedule = hours[sourceDay];
    setHours((prev) => {
      const updated = { ...prev };
      DAYS.forEach((day) => {
        if (copySelections[day]) {
          updated[day] = { ...sourceSchedule };
        }
      });
      return updated;
    });
    setCopyPopoverDay(null);
  }

  if (loading) {
    return (
      <section aria-labelledby="working-hours-heading" className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-36" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="space-y-2">
          {DAYS.map((day) => (
            <Skeleton key={day} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </section>
    );
  }

  if (fetchError) {
    return (
      <section aria-labelledby="working-hours-heading" className="mt-6">
        <h2 id="working-hours-heading" className="text-xl font-semibold text-slate-900 mb-4">
          Working Hours
        </h2>
        <Alert variant="destructive">
          <AlertDescription>
            Working hours couldn&apos;t be loaded. Refresh to try again.
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  return (
    <TooltipProvider>
      <section aria-labelledby="working-hours-heading" className="mt-6">
        {/* Section header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div>
            <h2 id="working-hours-heading" className="text-xl font-semibold text-slate-900">
              Working Hours
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Set the days and hours your team is available to take bookings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="text-sm text-amber-600">Unsaved changes</span>
            )}
            <Select onValueChange={handleQuickSet} defaultValue="custom">
              <SelectTrigger className="w-48 h-8 text-sm">
                <SelectValue placeholder="Quick set…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                {QUICK_SET_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className={!isDirty ? 'opacity-50' : ''}
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save Hours'
              )}
            </Button>
          </div>
        </div>

        {/* Day grid */}
        <div className="mt-4 space-y-0.5">
          {DAYS.map((day) => {
            const dayData = hours[day] || DEFAULT_DAY;
            const hasLunch = !!dayData.lunchStart;

            return (
              <div key={day} className="grid grid-cols-[80px_44px_1fr_auto] gap-3 items-start py-2 border-b border-slate-50 last:border-b-0">
                {/* Day label */}
                <span className="text-sm text-slate-700 pt-1.5">{DAY_LABELS[day]}</span>

                {/* Toggle */}
                <div className="flex items-center justify-center h-9">
                  <Switch
                    checked={!!dayData.enabled}
                    onCheckedChange={(checked) => updateDay(day, 'enabled', checked)}
                    aria-label={`Toggle ${DAY_LABELS[day]}`}
                  />
                </div>

                {/* Time inputs */}
                <div className="flex flex-col gap-1.5">
                  {dayData.enabled ? (
                    <>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={dayData.open || '08:00'}
                          onChange={(e) => updateDay(day, 'open', e.target.value)}
                          className="h-8 text-sm rounded-md border border-slate-200 px-2 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                          aria-label={`${DAY_LABELS[day]} open time`}
                        />
                        <span className="text-slate-400 text-sm">–</span>
                        <input
                          type="time"
                          value={dayData.close || '17:00'}
                          onChange={(e) => updateDay(day, 'close', e.target.value)}
                          className="h-8 text-sm rounded-md border border-slate-200 px-2 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                          aria-label={`${DAY_LABELS[day]} close time`}
                        />
                      </div>

                      {hasLunch ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate-500">Lunch:</span>
                          <input
                            type="time"
                            value={dayData.lunchStart || '12:00'}
                            onChange={(e) => updateDay(day, 'lunchStart', e.target.value)}
                            className="h-8 text-sm rounded-md border border-slate-200 px-2 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                            aria-label={`${DAY_LABELS[day]} lunch start`}
                          />
                          <span className="text-slate-400 text-sm">–</span>
                          <input
                            type="time"
                            value={dayData.lunchEnd || '13:00'}
                            onChange={(e) => updateDay(day, 'lunchEnd', e.target.value)}
                            className="h-8 text-sm rounded-md border border-slate-200 px-2 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                            aria-label={`${DAY_LABELS[day]} lunch end`}
                          />
                          <button
                            type="button"
                            onClick={() => toggleLunchBreak(day)}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                          >
                            Remove break
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleLunchBreak(day)}
                          className="text-xs text-slate-400 hover:text-slate-700 transition-colors text-left"
                        >
                          + Add lunch break
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-slate-400 pt-1.5 italic">Closed</span>
                  )}
                </div>

                {/* Copy-to-days popover */}
                <div className="flex items-center justify-center h-9">
                  <Popover
                    open={copyPopoverDay === day}
                    onOpenChange={(open) => {
                      if (!open) setCopyPopoverDay(null);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => openCopyPopover(day)}
                            className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                            aria-label="Apply to other days"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p>Apply to other days</p>
                        </TooltipContent>
                      </Tooltip>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-3" side="left" align="start">
                      <p className="text-xs font-medium text-slate-700 mb-2">Copy to:</p>
                      <div className="space-y-1.5">
                        {DAYS.filter((d) => d !== day).map((d) => (
                          <label key={d} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!copySelections[d]}
                              onChange={(e) =>
                                setCopySelections((prev) => ({ ...prev, [d]: e.target.checked }))
                              }
                              className="rounded border-slate-300"
                            />
                            <span className="text-sm text-slate-700">{DAY_LABELS[d]}</span>
                          </label>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-3"
                        onClick={() => applyCopyTodays(day)}
                        disabled={!Object.values(copySelections).some(Boolean)}
                      >
                        Apply
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            );
          })}
        </div>

        {/* All-days-off warning */}
        {allDaysClosed && (
          <p className="text-xs text-amber-600 mt-3">
            All days are set to closed. Your AI will not offer booking slots.
          </p>
        )}

        {/* Slot duration */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-700">Default appointment duration:</span>
            <Select
              value={slotDuration}
              onValueChange={(val) => setSlotDuration(val)}
            >
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLOT_DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Calls booked with no specific duration use this default.
          </p>
        </div>
      </section>
    </TooltipProvider>
  );
}
