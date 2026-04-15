'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, UtensilsCrossed, User, ShoppingBag, Palmtree, CalendarSync } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const PRESETS = [
  { key: 'lunch', label: 'Lunch', Icon: UtensilsCrossed, defaultDuration: 60 },
  { key: 'personal', label: 'Personal', Icon: User, defaultDuration: 60 },
  { key: 'errand', label: 'Errand', Icon: ShoppingBag, defaultDuration: 90 },
  { key: 'vacation', label: 'Vacation', Icon: Palmtree, defaultDuration: 0, allDay: true },
];

/**
 * TimeBlockSheet — create/edit/delete time blocks.
 *
 * Props:
 *   open           — boolean, controls Sheet visibility
 *   onOpenChange   — function(boolean)
 *   selectedBlock  — null (create mode) | object (edit mode)
 *   onSave         — function({ title, date, start_time, end_time, is_all_day, note })
 *   onDelete       — function(id)
 *   isMobile       — boolean, controls sheet side positioning
 */
export default function TimeBlockSheet({ open, onOpenChange, selectedBlock, onSave, onDelete, onDeleteGroup, isMobile }) {
  const isEditMode = !!selectedBlock;

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [endDate, setEndDate] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [activePreset, setActivePreset] = useState(null);

  // Sync form fields when selectedBlock changes or sheet opens
  useEffect(() => {
    if (open) {
      if (selectedBlock) {
        const startDate = new Date(selectedBlock.start_time);
        const endDateObj = new Date(selectedBlock.end_time);

        const yyyy = startDate.getFullYear();
        const mm = String(startDate.getMonth() + 1).padStart(2, '0');
        const dd = String(startDate.getDate()).padStart(2, '0');

        const startH = String(startDate.getHours()).padStart(2, '0');
        const startM = String(startDate.getMinutes()).padStart(2, '0');
        const endH = String(endDateObj.getHours()).padStart(2, '0');
        const endM = String(endDateObj.getMinutes()).padStart(2, '0');

        setTitle(selectedBlock.title || '');
        setDate(`${yyyy}-${mm}-${dd}`);
        setEndDate('');
        setStartTime(`${startH}:${startM}`);
        setEndTime(`${endH}:${endM}`);
        setIsAllDay(selectedBlock.is_all_day || false);
        setNote(selectedBlock.note || '');
        setShowNote(!!selectedBlock.note);
        setSyncToCalendar(true);
        setActivePreset(null);
      } else {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        setTitle('');
        setDate(`${yyyy}-${mm}-${dd}`);
        setEndDate('');
        setStartTime('09:00');
        setEndTime('10:00');
        setIsAllDay(false);
        setNote('');
        setShowNote(false);
        setSyncToCalendar(true);
        setActivePreset(null);
      }
      setErrors({});
    }
  }, [open, selectedBlock]);

  function handlePreset(preset) {
    setActivePreset(preset.key);
    setTitle(preset.label);
    setIsAllDay(!!preset.allDay);
    if (!preset.allDay && preset.defaultDuration) {
      const defaultStart = preset.key === 'lunch' ? '12:00' : '09:00';
      const startMins = parseInt(defaultStart.split(':')[0]) * 60 + parseInt(defaultStart.split(':')[1]);
      const endMins = startMins + preset.defaultDuration;
      const endH = String(Math.floor(endMins / 60)).padStart(2, '0');
      const endM = String(endMins % 60).padStart(2, '0');
      setStartTime(defaultStart);
      setEndTime(`${endH}:${endM}`);
    }
    setErrors({});
  }

  function validate() {
    const newErrors = {};
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!date) {
      newErrors.date = 'Date is required';
    }
    if (endDate && endDate < date) {
      newErrors.endDate = 'End date must be on or after start date';
    }
    if (!isAllDay) {
      if (!startTime) {
        newErrors.startTime = 'Start time is required';
      }
      if (!endTime) {
        newErrors.endTime = 'End time is required';
      }
      if (startTime && endTime && endTime <= startTime) {
        newErrors.endTime = 'End time must be after start time';
      }
    }
    return newErrors;
  }

  async function handleSave() {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      if (endDate && endDate > date) {
        const start = new Date(date + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        // Generate a shared group_id so multi-day blocks can be deleted together
        const groupId = crypto.randomUUID();
        let count = 0;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          await onSave({
            title: title.trim(),
            date: dayStr,
            start_time: startTime,
            end_time: endTime,
            is_all_day: isAllDay,
            note: note.trim() || null,
            sync_to_calendar: syncToCalendar,
            group_id: groupId,
          });
          count++;
        }
        toast.success(`Time blocked for ${count} days`);
      } else {
        await onSave({
          title: title.trim(),
          date,
          start_time: startTime,
          end_time: endTime,
          is_all_day: isAllDay,
          note: note.trim() || null,
          sync_to_calendar: syncToCalendar,
        });
        toast.success('Time block saved');
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save time block. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // Group info for multi-day blocks — group_count comes from the API
  // (counts all blocks in the group, not just those in the current view)
  const groupCount = isEditMode && selectedBlock?.group_id
    ? (selectedBlock.group_count || 1)
    : 0;
  const isPartOfGroup = groupCount > 1;

  function handleDelete() {
    if (selectedBlock?.id) {
      onDelete(selectedBlock.id);
    }
  }

  function handleDeleteGroup() {
    if (selectedBlock?.id && selectedBlock?.group_id) {
      onDeleteGroup?.(selectedBlock.id, selectedBlock.group_id);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={isMobile ? 'max-h-[85vh] rounded-t-2xl overflow-y-auto' : 'sm:max-w-md overflow-y-auto'}
      >
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Edit Time Block' : 'Block Time'}</SheetTitle>
        </SheetHeader>

        <div className="px-6 py-4 space-y-5">

          {/* Quick presets — create mode only */}
          {!isEditMode && (
            <div className="space-y-2">
              <Label className="text-xs text-stone-500 uppercase tracking-wider">Quick add</Label>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((preset) => {
                  const isActive = activePreset === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handlePreset(preset)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all text-center min-h-[60px] ${
                        isActive
                          ? 'border-[var(--brand-accent)] bg-[var(--selected-fill)] text-[var(--brand-accent)]'
                          : 'border-border bg-muted text-muted-foreground hover:bg-accent active:scale-95'
                      }`}
                    >
                      <preset.Icon className="w-4 h-4" />
                      <span className="text-xs font-medium">{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="tb-title">Title</Label>
            <Input
              id="tb-title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setActivePreset(null); setErrors((prev) => ({ ...prev, title: undefined })); }}
              placeholder="e.g., Lunch break"
              className="h-11"
            />
            {errors.title && (
              <p className="text-destructive text-[12px]">{errors.title}</p>
            )}
          </div>

          {/* Date(s) */}
          <div className={isEditMode ? '' : 'grid grid-cols-2 gap-3'}>
            <div className="space-y-2">
              <Label htmlFor="tb-date">{!isEditMode ? 'Start date' : 'Date'}</Label>
              <Input
                id="tb-date"
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setErrors((prev) => ({ ...prev, date: undefined })); }}
                className="h-11"
              />
              {errors.date && (
                <p className="text-destructive text-[12px]">{errors.date}</p>
              )}
            </div>
            {!isEditMode && (
              <div className="space-y-2">
                <Label htmlFor="tb-end-date">End date <span className="text-stone-400 font-normal text-xs">(optional)</span></Label>
                <Input
                  id="tb-end-date"
                  type="date"
                  value={endDate}
                  min={date}
                  onChange={(e) => { setEndDate(e.target.value); setErrors((prev) => ({ ...prev, endDate: undefined })); }}
                  className="h-11"
                />
                {errors.endDate && (
                  <p className="text-destructive text-[12px]">{errors.endDate}</p>
                )}
              </div>
            )}
          </div>

          {/* All-day toggle */}
          <div className="flex items-center gap-3 py-1">
            <Switch
              id="tb-allday"
              checked={isAllDay}
              onCheckedChange={(checked) => {
                setIsAllDay(checked);
                setErrors((prev) => ({ ...prev, startTime: undefined, endTime: undefined }));
              }}
            />
            <Label htmlFor="tb-allday" className="cursor-pointer">All day</Label>
          </div>

          {/* Start + End time — native time inputs, hidden when all-day */}
          {!isAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tb-start">Start time</Label>
                <Input
                  id="tb-start"
                  type="time"
                  step="3600"
                  value={startTime}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartTime(val);
                    if (endTime && val && endTime <= val) {
                      // Auto-advance end time by 1 hour
                      const [h] = val.split(':').map(Number);
                      const newEnd = `${String(Math.min(h + 1, 23)).padStart(2, '0')}:00`;
                      setEndTime(newEnd);
                    }
                    setErrors((prev) => ({ ...prev, startTime: undefined, endTime: undefined }));
                  }}
                  className="h-11"
                />
                {errors.startTime && (
                  <p className="text-destructive text-[12px]">{errors.startTime}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tb-end">End time</Label>
                <Input
                  id="tb-end"
                  type="time"
                  step="3600"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setErrors((prev) => ({ ...prev, endTime: undefined }));
                  }}
                  className="h-11"
                />
                {errors.endTime && (
                  <p className="text-destructive text-[12px]">{errors.endTime}</p>
                )}
              </div>
            </div>
          )}

          {/* Sync to calendar toggle */}
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted border border-border">
            <div className="flex items-center gap-2">
              <CalendarSync className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Sync to calendar</span>
            </div>
            <Switch
              id="tb-sync"
              checked={syncToCalendar}
              onCheckedChange={setSyncToCalendar}
              aria-label="Sync time block to connected calendar"
            />
          </div>

          {/* Note — collapsed by default */}
          {showNote ? (
            <div className="space-y-2">
              <Label htmlFor="tb-note">Note</Label>
              <Textarea
                id="tb-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                rows={2}
                className="min-h-[60px]"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNote(true)}
              className="text-sm text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] font-medium py-1"
            >
              + Add a note
            </button>
          )}
        </div>

        <SheetFooter className="px-6 pb-6 pt-2 flex flex-col gap-3">
          {isEditMode ? (
            <>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-11 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-[var(--brand-accent-fg)]"
              >
                {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                Save changes
              </Button>

              {/* Delete section */}
              <div className="border-t border-stone-100 pt-3">
                {isPartOfGroup && (
                  <p className="text-xs text-stone-400 text-center mb-2">
                    Part of a {groupCount}-day block
                  </p>
                )}
                {isPartOfGroup ? (
                  <div className="grid grid-cols-2 gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          disabled={saving}
                          className="h-10 text-sm text-stone-500 hover:text-red-600 hover:bg-red-50"
                        >
                          Remove this day
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove this day?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the time block for this day only. The other {groupCount - 1} day{groupCount - 1 !== 1 ? 's' : ''} will remain.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Remove</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          disabled={saving}
                          className="h-10 text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Delete all {groupCount} days
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete all {groupCount} days?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove &ldquo;{selectedBlock?.title}&rdquo; for all {groupCount} days. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteGroup} className="bg-red-600 hover:bg-red-700 text-white">Delete All</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        disabled={saving}
                        className="w-full h-10 text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Delete Block
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this time block?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove &ldquo;{selectedBlock?.title}&rdquo; from your calendar{selectedBlock?.external_event_id ? ' and your connected calendar' : ''}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </>
          ) : (
            <>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-11 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-[var(--brand-accent-fg)]"
              >
                {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                Save Block
              </Button>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="w-full h-11"
              >
                Discard
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
