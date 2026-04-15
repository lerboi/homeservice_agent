'use client';

import { Calendar, Clock, ExternalLink, MapPin } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(start, end) {
  if (!start || !end) return '';
  const mins = Math.round((new Date(end) - new Date(start)) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getCalendarEditUrl(event) {
  if (!event) return null;

  if (event.provider === 'google') {
    // Open Google Calendar to the event's date so the user can find and click it
    const d = new Date(event.start_time);
    const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    return `https://calendar.google.com/calendar/r/day/${dateStr}`;
  }

  if (event.provider === 'outlook') {
    const d = new Date(event.start_time);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `https://outlook.live.com/calendar/0/view/day/${dateStr}`;
  }

  return null;
}

/**
 * ExternalEventSheet — view details of a Google/Outlook calendar event.
 *
 * Props:
 *   event        — calendar_events row (or null)
 *   open         — boolean
 *   onOpenChange — function(boolean)
 *   isMobile     — boolean
 */
export default function ExternalEventSheet({ event, open, onOpenChange, isMobile }) {
  if (!event) return null;

  const providerLabel = event.provider === 'outlook' ? 'Outlook Calendar' : 'Google Calendar';
  const providerColor =
    event.provider === 'outlook'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border dark:border-blue-800/60'
      : 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 dark:border dark:border-violet-800/60';
  const editUrl = getCalendarEditUrl(event);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={isMobile ? 'max-h-[85vh] rounded-t-2xl overflow-y-auto' : 'sm:max-w-md overflow-y-auto'}
      >
        <SheetHeader>
          <Badge className={`w-fit ${providerColor}`}>{providerLabel}</Badge>
          <SheetTitle className="text-xl">{event.title || 'Untitled Event'}</SheetTitle>
        </SheetHeader>

        <div className="px-6 space-y-4">
          {/* Details card */}
          <div className="rounded-lg border border-border bg-muted p-3 space-y-2.5">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              {event.is_all_day ? (
                <span className="font-medium">All day</span>
              ) : (
                <>
                  <span className="font-medium">{formatDateTime(event.start_time)}</span>
                  <span className="text-muted-foreground text-xs">({formatDuration(event.start_time, event.end_time)})</span>
                </>
              )}
            </div>
            {!event.is_all_day && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Ends {formatDateTime(event.end_time)}</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground ml-6">
              Synced from {providerLabel}
            </div>
          </div>
        </div>

        <SheetFooter className="px-6 pb-6 pt-4 flex flex-col gap-2">
          {editUrl && (
            <Button
              asChild
              className="w-full h-11 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-[var(--brand-accent-fg)]"
            >
              <a href={editUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in {providerLabel}
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full h-11"
          >
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
