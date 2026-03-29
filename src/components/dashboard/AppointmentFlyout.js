'use client';

import { useState, useEffect } from 'react';
import { MapPin, Phone, ExternalLink, FileText, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
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
import { toast } from 'sonner';

const URGENCY_STYLES = {
  emergency: { badge: 'bg-red-100 text-red-700', label: 'Emergency' },
  routine: { badge: 'bg-[#0F172A]/[0.06] text-[#0F172A]/70', label: 'Routine' },
  high_ticket: { badge: 'bg-amber-100 text-amber-700', label: 'High Ticket' },
};

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

function formatRelativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AppointmentFlyout({ appointment, conflict, open, onOpenChange, onCancelled }) {
  const [cancelling, setCancelling] = useState(false);
  const [dismissingConflict, setDismissingConflict] = useState(false);

  // Resolve recording URL — prefer Supabase Storage (new calls), fall back to recording_url (historical)
  const call = appointment?.calls;
  const [recordingSrc, setRecordingSrc] = useState(null);
  useEffect(() => {
    if (!call) { setRecordingSrc(null); return; }
    if (call.recording_storage_path) {
      supabase.storage
        .from('call-recordings')
        .createSignedUrl(call.recording_storage_path, 3600)
        .then(({ data }) => setRecordingSrc(data?.signedUrl || null));
    } else {
      setRecordingSrc(call.recording_url || null);
    }
  }, [call]);

  if (!appointment) return null;

  const urgency = URGENCY_STYLES[appointment.urgency] || URGENCY_STYLES.routine;

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) throw new Error('Cancel failed');
      toast.success('Appointment cancelled');
      onOpenChange(false);
      onCancelled?.(appointment.id);
    } catch {
      toast.error('Failed to cancel appointment');
    } finally {
      setCancelling(false);
    }
  }

  async function handleDismissConflict() {
    if (!conflict) return;
    setDismissingConflict(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conflict_dismissed: true,
          calendar_event_id: conflict.calendar_event.id,
        }),
      });
      if (!res.ok) throw new Error('Dismiss failed');
      toast.success('Conflict dismissed');
    } catch {
      toast.error('Failed to dismiss conflict');
    } finally {
      setDismissingConflict(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge className={urgency.badge}>{urgency.label}</Badge>
          </div>
          <SheetTitle className="text-xl">{appointment.caller_name}</SheetTitle>
          <SheetDescription>{appointment.notes || 'Appointment details'}</SheetDescription>
        </SheetHeader>

        <div className="px-6 space-y-6">
          {/* Appointment Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#475569] uppercase tracking-wider">Details</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-[#0F172A]/80">
                <Clock className="h-4 w-4 text-stone-400" />
                <span>{formatDateTime(appointment.start_time)}</span>
                <span className="text-stone-400">({formatDuration(appointment.start_time, appointment.end_time)})</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#0F172A]/80">
                <MapPin className="h-4 w-4 text-stone-400" />
                <span>{appointment.service_address || 'No address'}</span>
              </div>
              {appointment.booked_via && (
                <div className="text-xs text-stone-400">
                  Booked via {appointment.booked_via}
                </div>
              )}
            </div>
          </div>

          {/* Caller */}
          {appointment.caller_phone && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#475569] uppercase tracking-wider">Caller</h3>
              <div className="flex items-center gap-2 text-sm text-[#0F172A]/80">
                <Phone className="h-4 w-4 text-stone-400" />
                <span>{appointment.caller_phone}</span>
              </div>
              {call?.created_at && (
                <div className="text-xs text-stone-400">
                  Called {formatRelativeTime(call.created_at)}
                </div>
              )}
            </div>
          )}

          {/* Links */}
          {call && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#475569] uppercase tracking-wider">Links</h3>
              <div className="flex flex-col gap-2">
                {recordingSrc && (
                  <a
                    href={recordingSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[#C2410C] hover:text-[#9A3412]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Listen to Recording
                  </a>
                )}
                {call.transcript_text && (
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm text-[#C2410C] hover:text-[#9A3412] text-left"
                  >
                    <FileText className="h-4 w-4" />
                    View Transcript
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {appointment.notes && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#475569] uppercase tracking-wider">Notes</h3>
              <p className="text-sm text-[#0F172A]/80">{appointment.notes}</p>
            </div>
          )}

          {/* Conflict */}
          {conflict && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Calendar Conflict
              </div>
              <p className="text-sm text-amber-700">
                Overlaps with &ldquo;{conflict.calendar_event.title}&rdquo;
                ({formatDateTime(conflict.calendar_event.start_time)} &ndash; {formatDateTime(conflict.calendar_event.end_time)})
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={handleDismissConflict}
                disabled={dismissingConflict}
              >
                {dismissingConflict ? 'Dismissing...' : 'Dismiss Conflict'}
              </Button>
            </div>
          )}
        </div>

        <SheetFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full">
                Cancel Appointment
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will cancel the appointment with {appointment.caller_name}.
                  {appointment.external_event_id && ' The calendar event will also be removed.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel Appointment'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
