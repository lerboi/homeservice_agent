'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { BookableUsersPicker, BookableUsersPickerSkeleton } from './BookableUsersPicker';

/**
 * Phase 57 — wraps BookableUsersPicker for use inside the Jobber integrations
 * card connected-state. Fetches the picker data from
 * GET /api/integrations/jobber/bookable-users on mount and persists changes
 * via the picker's own PATCH (synchronous rebuild handled by the route).
 *
 * Permanently visible for ≤4 users; collapsible for larger crews per UI-SPEC §Layout.
 */
export function JobberBookableUsersSection() {
  const [data, setData] = useState({ users: null, selected: null });
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/integrations/jobber/bookable-users')
      .then(async (res) => {
        if (!res.ok && res.status !== 404) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setData({ users: json.users ?? [], selected: json.selected ?? null });
        // Auto-collapse when there are more than 4 users so the card stays compact.
        if ((json.users?.length ?? 0) > 4) setOpen(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e?.message || e));
      });
    return () => { cancelled = true; };
  }, []);

  const isLoading = data.users === null && !error;
  const userCount = data.users?.length ?? 0;
  const collapsible = userCount > 4;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-foreground">Schedule mirror — team members</h3>
        {collapsible && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Collapse team members' : 'Expand team members'}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {open && (
        <>
          {isLoading && <BookableUsersPickerSkeleton />}
          {error && (
            <p className="text-xs text-muted-foreground">
              Couldn&apos;t load team members. Reload the page to try again.
            </p>
          )}
          {data.users && (
            <BookableUsersPicker users={data.users} initialSelected={data.selected} />
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Changing this set triggers a re-sync of your Jobber schedule.
          </p>
        </>
      )}
    </div>
  );
}
