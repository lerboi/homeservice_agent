'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Phone, ExternalLink, FileText, AlertTriangle, Clock, Check, Loader2, User, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  routine: { badge: 'bg-foreground/[0.06] text-foreground/70', label: 'Routine' },
  urgent: { badge: 'bg-amber-100 text-amber-700', label: 'Urgent' },
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

export default function AppointmentFlyout({ appointment, conflict, open, onOpenChange, onCancelled, onStatusChange }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [dismissingConflict, setDismissingConflict] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // Mark-complete two-step flow state
  const [showCompletionNotes, setShowCompletionNotes] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  // Reset mark-complete state when flyout opens/closes
  useEffect(() => {
    if (!open) {
      setShowCompletionNotes(false);
      setCompletionNotes('');
      setIsCompleting(false);
    }
  }, [open]);

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
  // leads is a reverse-join array (leads.appointment_id -> appointments.id).
  // In practice at most one lead references any given appointment at a time.
  const linkedLead = Array.isArray(appointment.leads) ? appointment.leads[0] : appointment.leads;

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

  const handleConfirmComplete = async () => {
    setIsCompleting(true);
    const appointmentId = appointment.id; // capture primitive to avoid stale closure
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          ...(completionNotes.trim() ? { notes: completionNotes.trim() } : {}),
        }),
      });
      if (!res.ok) throw new Error('Failed');

      onOpenChange(false); // close flyout
      onStatusChange?.(appointmentId, 'completed'); // notify parent

      toast.success('Job marked as complete', {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: async () => {
            await fetch(`/api/appointments/${appointmentId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'confirmed' }),
            });
            onStatusChange?.(appointmentId, 'confirmed');
          },
        },
      });
    } catch (err) {
      toast.error("Couldn't update appointment. Try again.");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-card">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge className={urgency.badge}>{urgency.label}</Badge>
            {appointment.status === 'completed' && (
              <Badge className="bg-green-100 text-green-700">Completed</Badge>
            )}
          </div>
          <SheetTitle className="text-xl">{appointment.caller_name}</SheetTitle>
          <SheetDescription>{appointment.notes || 'Appointment details'}</SheetDescription>
        </SheetHeader>

        <div className="px-6 space-y-4">
          {/* Details card */}
          <div className="rounded-lg border border-border bg-muted p-3 space-y-2.5">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="h-4 w-4 text-stone-400 shrink-0" />
              <span className="font-medium">{formatDateTime(appointment.start_time)}</span>
              <span className="text-muted-foreground text-xs">({formatDuration(appointment.start_time, appointment.end_time)})</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <MapPin className="h-4 w-4 text-stone-400 shrink-0" />
              <span>{appointment.street_name && appointment.postal_code
                ? `${appointment.street_name}, ${appointment.postal_code}`
                : appointment.service_address || 'No address'}</span>
            </div>
            {appointment.caller_phone && (
              <div className="flex items-center gap-2 text-sm text-foreground/80">
                <Phone className="h-4 w-4 text-stone-400 shrink-0" />
                <span>{appointment.caller_phone}</span>
              </div>
            )}
            {appointment.booked_via && (
              <div className="text-xs text-stone-400 ml-6">
                Booked via {appointment.booked_via}{call?.created_at ? ` · Called ${formatRelativeTime(call.created_at)}` : ''}
              </div>
            )}
            {linkedLead && (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/leads?open=${linkedLead.id}`)}
                className="flex items-center justify-between w-full text-sm text-foreground/80 pt-2 mt-1 border-t border-border hover:bg-accent transition-colors -mx-1 px-1 rounded"
              >
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4 text-stone-400 shrink-0" />
                  <span>
                    Lead: <span className="font-medium text-foreground">{linkedLead.caller_name || 'Unnamed'}</span>
                    <span className="text-stone-400 ml-1.5">· {linkedLead.status}</span>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-stone-400" />
              </button>
            )}
            {appointment.status === 'completed' && appointment.completed_at && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 pt-1 border-t border-stone-200/60">
                <Check className="h-4 w-4 shrink-0" />
                <span>Completed on {formatDateTime(appointment.completed_at)}</span>
              </div>
            )}
          </div>

          {/* Call recording + transcript */}
          {call && (recordingSrc || call.transcript_text) && (
            <div className="rounded-lg border border-stone-200/60 p-3 space-y-2">
              {recordingSrc && (
                <a
                  href={recordingSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  Listen to Recording
                </a>
              )}
              {call.transcript_text && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowTranscript(!showTranscript)}
                    className="flex items-center gap-2 text-sm text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] text-left font-medium"
                  >
                    <FileText className="h-4 w-4" />
                    {showTranscript ? 'Hide Transcript' : 'View Transcript'}
                  </button>
                  {showTranscript && (
                    <div className="mt-1 p-3 bg-stone-900 rounded-lg text-sm text-stone-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {call.transcript_text}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Notes */}
          {appointment.notes && (
            <div className="rounded-lg border border-stone-200/60 p-3">
              <p className="text-sm text-foreground/80 leading-relaxed">{appointment.notes}</p>
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

        <SheetFooter className="flex-col gap-2">
          {/* Create Invoice — shortcut for the linked lead (gated on invoice-ready statuses) */}
          {linkedLead && ['booked', 'completed', 'paid'].includes(linkedLead.status) && !showCompletionNotes && (
            <Button
              variant="outline"
              onClick={() => router.push(`/dashboard/invoices/new?lead_id=${linkedLead.id}`)}
              className="w-full h-11 border-[var(--brand-accent)]/30 text-[var(--brand-accent)] hover:bg-accent"
            >
              <FileText className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          )}

          {/* Completion notes input — shown when Mark Complete is clicked */}
          {showCompletionNotes && (
            <div className="w-full space-y-3 animate-in slide-in-from-top-2 duration-200">
              <Textarea
                placeholder="Add completion notes (optional) — e.g., Replaced water heater thermostat"
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setCompletionNotes(''); handleConfirmComplete(); }}
                  disabled={isCompleting}
                  className="flex-1 h-11 text-sm"
                >
                  Skip & Complete
                </Button>
                <Button
                  onClick={handleConfirmComplete}
                  disabled={isCompleting}
                  className="flex-1 h-11 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isCompleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Save & Complete
                </Button>
              </div>
            </div>
          )}

          {/* Mark Complete button — only shown for confirmed appointments when notes panel is not open */}
          {appointment.status === 'confirmed' && !showCompletionNotes && (
            <Button
              onClick={() => setShowCompletionNotes(true)}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="h-4 w-4 mr-2" />
              Mark Complete
            </Button>
          )}

          {/* Undo Completion — shown for completed appointments */}
          {appointment.status === 'completed' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full h-11">
                  Undo Completion
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revert to confirmed?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the appointment with {appointment.caller_name} as confirmed again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Completed</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      const appointmentId = appointment.id;
                      try {
                        const res = await fetch(`/api/appointments/${appointmentId}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: 'confirmed' }),
                        });
                        if (!res.ok) throw new Error('Failed');
                        onOpenChange(false);
                        onStatusChange?.(appointmentId, 'confirmed');
                        toast.success('Appointment restored to confirmed');
                      } catch {
                        toast.error("Couldn't undo completion. Try again.");
                      }
                    }}
                    className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-[var(--brand-accent-fg)]"
                  >
                    Yes, Revert
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Cancel Appointment — hidden for already completed appointments */}
          {appointment.status !== 'completed' && (
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
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
