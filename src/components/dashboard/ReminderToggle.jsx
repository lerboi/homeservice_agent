'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';

const REMINDER_TYPE_LABELS = {
  before_3: '3 days before',
  due_date: 'Due date',
  overdue_3: '3 days overdue',
  overdue_7: '7 days overdue',
};

/**
 * Per-invoice reminder toggle with optional reminder history display.
 */
export function ReminderToggle({ invoiceId, initialEnabled, onToggle, reminders }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  async function handleToggle(newValue) {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminders_enabled: newValue }),
      });
      if (!res.ok) throw new Error('Failed to update reminder setting');
      setEnabled(newValue);
      toast.success(newValue ? 'Payment reminders enabled' : 'Payment reminders disabled');
      onToggle?.(newValue);
    } catch (err) {
      console.error('[ReminderToggle] toggle error:', err);
      toast.error('Failed to update reminder setting');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={loading}
          id={`reminder-toggle-${invoiceId}`}
        />
        <label
          htmlFor={`reminder-toggle-${invoiceId}`}
          className="text-sm font-medium text-foreground cursor-pointer"
        >
          Send payment reminders
        </label>
      </div>

      <p className="text-xs text-muted-foreground ml-[44px]">
        Reminders sent 3 days before due, on due date, and 3 and 7 days after
      </p>

      {/* Reminder history */}
      {reminders && reminders.length > 0 && (
        <div className="ml-[44px] space-y-1.5 pt-1">
          {reminders.map((reminder) => (
            <div
              key={`${reminder.reminder_type}-${reminder.sent_at}`}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span>{REMINDER_TYPE_LABELS[reminder.reminder_type] || reminder.reminder_type}</span>
              <span>{format(new Date(reminder.sent_at), 'MMM d, yyyy')}</span>
              <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] px-1.5 py-0">
                Sent
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
