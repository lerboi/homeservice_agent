'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * RecurringSetupDialog — Dialog for setting up a recurring schedule on an invoice.
 *
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, invoiceId: string, onSetup: () => void }} props
 */
export default function RecurringSetupDialog({ open, onOpenChange, invoiceId, onSetup }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultStart = tomorrow.toISOString().split('T')[0];

  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!startDate) {
      toast.error('Please select a start date');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_recurring_template: true,
          recurring_frequency: frequency,
          recurring_start_date: startDate,
          recurring_end_date: endDate || null,
          recurring_next_date: startDate,
          recurring_active: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to set up recurring schedule');
      }

      toast.success('Recurring schedule set up');
      onOpenChange(false);
      onSetup?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Up Recurring Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger id="frequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start date */}
          <div className="space-y-2">
            <Label htmlFor="start-date">Start date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* End date (optional) */}
          <div className="space-y-2">
            <Label htmlFor="end-date">End date (optional)</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="No end date"
            />
            {endDate && (
              <button
                type="button"
                onClick={() => setEndDate('')}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear end date
              </button>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Dismiss
          </Button>
          <Button
            className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-[var(--brand-accent-fg)]"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Set Up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
