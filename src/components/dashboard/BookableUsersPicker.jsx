'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { computeDefaultSelected } from './BookableUsersPicker.helpers';

export { computeDefaultSelected };

function initials(name) {
  const parts = (name || '').split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function BookableUsersPickerSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

export function BookableUsersPicker({ users, initialSelected, onSaved }) {
  const list = users ?? [];
  const allNoActivity = list.length > 0 && !list.some((u) => u.hasRecentActivity);
  const [selected, setSelected] = useState(() => computeDefaultSelected(list, initialSelected));
  const [saving, setSaving] = useState(false);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/integrations/jobber/bookable-users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userIds: Array.from(selected) }),
      });
      if (!res.ok) throw new Error('save failed');
      toast.success('Team members updated.');
      onSaved?.();
    } catch {
      toast.error("Couldn't save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (list.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No team members found in Jobber.
      </div>
    );
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium mb-1">Who should Voco mirror from Jobber?</legend>
      <p className="text-xs text-muted-foreground mb-3">
        Voco will block slots for visits assigned to these team members.
      </p>
      <div className="flex flex-col gap-2">
        {list.map((u) => (
          <label key={u.id} className="flex items-center gap-3 cursor-pointer">
            <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggle(u.id)} />
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
              {initials(u.name)}
            </div>
            <span className="text-sm font-medium text-foreground">{u.name}</span>
            {u.hasRecentActivity && (
              <span className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Active
              </span>
            )}
          </label>
        ))}
      </div>
      {allNoActivity && (
        <p className="text-xs text-muted-foreground mt-3">
          No recent visits found — all members selected. Deselect office or admin accounts.
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        Changing this set triggers a re-sync of your Jobber schedule.
      </p>
      <Button
        onClick={save}
        disabled={saving}
        className="mt-4 bg-[var(--brand-accent)] text-white min-w-[160px]"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Saving…
          </>
        ) : (
          'Save team members'
        )}
      </Button>
    </fieldset>
  );
}
