'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * <ErrorState /> — POLISH-04 inline error + retry primitive.
 *
 * Locked prop API (58-UI-SPEC §4.2):
 *   message    optional — falls back to default when absent
 *   onRetry    optional — if present, renders Retry button
 *   retryLabel optional — defaults to "Try again"
 *
 * Rules:
 *   - Outer container carries role="alert" so SR announces immediately.
 *   - Headline is fixed ("Something went wrong") — variance is in the message.
 *   - Retry button is secondary (outline + sm) so copper stays reserved for primary.
 */
const DEFAULT_MESSAGE = "We couldn't load this. Please try again.";

export function ErrorState({ message, onRetry, retryLabel = 'Try again' }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <AlertTriangle
        className="h-8 w-8 text-destructive/70 mb-3"
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-foreground mb-1">Something went wrong</p>
      <p className="text-xs text-muted-foreground max-w-sm mb-4">
        {message ?? DEFAULT_MESSAGE}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
