'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
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

/**
 * TimeBlockSheet — create/edit/delete time blocks.
 *
 * Props:
 *   open           — boolean, controls Sheet visibility
 *   onOpenChange   — function(boolean)
 *   selectedBlock  — null (create mode) | object (edit mode)
 *   onSave         — function({ title, date, start_time, end_time, is_all_day, note })
 *   onDelete       — function(id)
 */
export default function TimeBlockSheet({ open, onOpenChange, selectedBlock, onSave, onDelete }) {
  const isEditMode = !!selectedBlock;

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Sync form fields when selectedBlock changes or sheet opens
  useEffect(() => {
    if (open) {
      if (selectedBlock) {
        // Edit mode — pre-fill from existing block
        const startDate = new Date(selectedBlock.start_time);
        const endDate = new Date(selectedBlock.end_time);

        const yyyy = startDate.getFullYear();
        const mm = String(startDate.getMonth() + 1).padStart(2, '0');
        const dd = String(startDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const startH = String(startDate.getHours()).padStart(2, '0');
        const startM = String(startDate.getMinutes()).padStart(2, '0');
        const endH = String(endDate.getHours()).padStart(2, '0');
        const endM = String(endDate.getMinutes()).padStart(2, '0');

        setTitle(selectedBlock.title || '');
        setDate(dateStr);
        setStartTime(`${startH}:${startM}`);
        setEndTime(`${endH}:${endM}`);
        setIsAllDay(selectedBlock.is_all_day || false);
        setNote(selectedBlock.note || '');
      } else {
        // Create mode — reset to defaults
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        setTitle('');
        setDate(`${yyyy}-${mm}-${dd}`);
        setStartTime('09:00');
        setEndTime('10:00');
        setIsAllDay(false);
        setNote('');
      }
      setErrors({});
    }
  }, [open, selectedBlock]);

  function validate() {
    const newErrors = {};
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!date) {
      newErrors.date = 'Date is required';
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
      await onSave({ title: title.trim(), date, start_time: startTime, end_time: endTime, is_all_day: isAllDay, note: note.trim() || null });
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (selectedBlock?.id) {
      onDelete(selectedBlock.id);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Edit Time Block' : 'Add Time Block'}</SheetTitle>
        </SheetHeader>

        <div className="px-6 py-4 space-y-4">

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="tb-title">Title</Label>
            <Input
              id="tb-title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors((prev) => ({ ...prev, title: undefined })); }}
              placeholder="Lunch break"
            />
            {errors.title && (
              <p className="text-destructive text-[12px]">{errors.title}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="tb-date">Date</Label>
            <Input
              id="tb-date"
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setErrors((prev) => ({ ...prev, date: undefined })); }}
            />
            {errors.date && (
              <p className="text-destructive text-[12px]">{errors.date}</p>
            )}
          </div>

          {/* All-day toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="tb-allday"
              checked={isAllDay}
              onCheckedChange={(checked) => {
                setIsAllDay(checked);
                setErrors((prev) => ({ ...prev, startTime: undefined, endTime: undefined }));
              }}
            />
            <Label htmlFor="tb-allday">All day</Label>
          </div>

          {/* Start time — hidden when all-day */}
          {!isAllDay && (
            <div className="space-y-2">
              <Label htmlFor="tb-start">Start time</Label>
              <Input
                id="tb-start"
                type="time"
                value={startTime}
                onChange={(e) => { setStartTime(e.target.value); setErrors((prev) => ({ ...prev, startTime: undefined, endTime: undefined })); }}
              />
              {errors.startTime && (
                <p className="text-destructive text-[12px]">{errors.startTime}</p>
              )}
            </div>
          )}

          {/* End time — hidden when all-day */}
          {!isAllDay && (
            <div className="space-y-2">
              <Label htmlFor="tb-end">End time</Label>
              <Input
                id="tb-end"
                type="time"
                value={endTime}
                onChange={(e) => { setEndTime(e.target.value); setErrors((prev) => ({ ...prev, endTime: undefined })); }}
              />
              {errors.endTime && (
                <p className="text-destructive text-[12px]">{errors.endTime}</p>
              )}
            </div>
          )}

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="tb-note">Note</Label>
            <Textarea
              id="tb-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
              rows={3}
            />
          </div>
        </div>

        <SheetFooter className="px-6 pb-6 flex flex-col gap-2">
          {isEditMode ? (
            <>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-[#C2410C] hover:bg-[#9A3412] text-white"
              >
                {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                Save changes
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={saving}
                aria-label="Delete time block"
                className="w-full"
              >
                Delete Block
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-[#C2410C] hover:bg-[#9A3412] text-white"
              >
                {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                Save Block
              </Button>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="w-full"
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
