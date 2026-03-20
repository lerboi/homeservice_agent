'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ConflictAlertBanner({ conflicts = [], onReviewConflicts }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || conflicts.length === 0) return null;

  const count = conflicts.length;

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            {count} calendar conflict{count !== 1 ? 's' : ''} need{count === 1 ? 's' : ''} your review
          </p>
          <p className="text-sm text-amber-700 mt-1">
            External calendar events overlap with platform bookings. Review and dismiss or reschedule.
          </p>
          {onReviewConflicts && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={onReviewConflicts}
            >
              Review Conflicts
            </Button>
          )}
        </div>
        <button
          type="button"
          className="text-amber-400 hover:text-amber-600 transition-colors"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss conflict alert"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
