'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, MapPin, Calendar, Briefcase, FileText, ExternalLink, ClipboardList, Mail, Pencil, Check, X, UserCheck, AlertCircle } from 'lucide-react';
import InvoiceStatusBadge from '@/components/dashboard/InvoiceStatusBadge';
import CustomerTimeline from '@/components/dashboard/CustomerTimeline';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import AudioPlayer from '@/components/dashboard/AudioPlayer';
import TranscriptViewer from '@/components/dashboard/TranscriptViewer';
import RevenueInput from '@/components/dashboard/RevenueInput';
import { supabase } from '@/lib/supabase-browser';
import { btn } from '@/lib/design-tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY_STYLES = {
  emergency: { badge: 'bg-red-100 text-red-700', label: 'Emergency' },
  routine: { badge: 'bg-foreground/[0.06] text-foreground/70', label: 'Routine' },
  urgent: { badge: 'bg-amber-100 text-amber-700', label: 'Urgent' },
};

const STATUS_LABELS = {
  new: 'New',
  booked: 'Booked',
  completed: 'Completed',
  paid: 'Paid',
  lost: 'Lost',
};

const STATUS_OPTIONS = ['new', 'booked', 'completed', 'paid', 'lost'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function showsRevenueInput(status) {
  return status === 'completed' || status === 'paid';
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LeadFlyoutSkeleton() {
  return (
    <div className="px-6 space-y-6 animate-pulse">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Separator />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Separator />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-8 w-36" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * LeadFlyout — right Sheet panel with full lead detail.
 * Fetches from /api/leads/[id] on open. Handles status change + revenue input.
 *
 * @param {{ leadId: string | null, open: boolean, onOpenChange: Function, onStatusChange: Function }} props
 */
export default function LeadFlyout({ leadId, open, onOpenChange, onStatusChange }) {
  const router = useRouter();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Linked invoice state (for Create/View Invoice button)
  const [linkedInvoice, setLinkedInvoice] = useState(null);

  // Inline-editable fields
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editingJobType, setEditingJobType] = useState(false);
  const [jobTypeDraft, setJobTypeDraft] = useState('');
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');

  // Status change state
  const [selectedStatus, setSelectedStatus] = useState('');
  const [revenueAmount, setRevenueAmount] = useState('');
  const [revenueError, setRevenueError] = useState('');
  const [saving, setSaving] = useState(false);
  const [markingLost, setMarkingLost] = useState(false);

  // Fetch lead detail when flyout opens
  const fetchLead = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) throw new Error('Failed to fetch lead');
      const data = await res.json();
      setLead(data.lead);
      setSelectedStatus(data.lead.status);
      // Pre-fill revenue if already set
      setRevenueAmount(data.lead.revenue_amount ? String(data.lead.revenue_amount) : '');
      setRevenueError('');

      // Check for linked invoice — for Create/View Invoice button
      try {
        const invRes = await fetch(`/api/invoices?lead_id=${leadId}`);
        if (invRes.ok) {
          const invData = await invRes.json();
          setLinkedInvoice(invData.invoices?.[0] || null);
        }
      } catch {
        // Invoice check failure is non-fatal — button just won't appear
        setLinkedInvoice(null);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (open && leadId) {
      fetchLead();
    } else if (!open) {
      // Reset on close
      setLead(null);
      setLoading(false);
      setFetchError(false);
      setSelectedStatus('');
      setRevenueAmount('');
      setRevenueError('');
      setLinkedInvoice(null);
      setEditingEmail(false);
      setEditingName(false);
      setEditingJobType(false);
      setEditingAddress(false);
      setEditingPhone(false);
      setEmailDraft('');
      setNameDraft('');
      setJobTypeDraft('');
      setAddressDraft('');
      setPhoneDraft('');
    }
  }, [open, leadId, fetchLead]);

  // Inline field save helper
  async function saveLeadField(field, value) {
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setLead((prev) => ({ ...prev, [field]: value }));
      toast.success(field === 'email' ? 'Email saved' : 'Name saved');
    } catch {
      toast.error(`Could not save ${field}`);
    }
  }

  function handleEmailSave() {
    const trimmed = emailDraft.trim();
    saveLeadField('email', trimmed || null);
    setEditingEmail(false);
  }

  function handleNameSave() {
    const trimmed = nameDraft.trim();
    if (trimmed) {
      saveLeadField('caller_name', trimmed);
    }
    setEditingName(false);
  }

  function handleJobTypeSave() {
    const trimmed = jobTypeDraft.trim();
    saveLeadField('job_type', trimmed || null);
    setEditingJobType(false);
  }

  function handlePhoneSave() {
    const trimmed = phoneDraft.trim();
    if (!trimmed) {
      // Phone is NOT NULL in the DB — reject empty submits client-side.
      toast.error('Phone number cannot be empty');
      return;
    }
    saveLeadField('from_number', trimmed);
    setEditingPhone(false);
  }

  // Address save — clears street_name/postal_code so the display-priority logic
  // (street+postal wins when both present) falls through to service_address.
  async function handleAddressSave() {
    const trimmed = addressDraft.trim();
    const body = {
      service_address: trimmed || null,
      street_name: null,
      postal_code: null,
    };
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setLead((prev) => ({ ...prev, ...body }));
      toast.success('Address saved');
    } catch {
      toast.error('Could not save address');
    } finally {
      setEditingAddress(false);
    }
  }

  function currentAddressText(l) {
    if (!l) return '';
    if (l.street_name && l.postal_code) return `${l.street_name}, ${l.postal_code}`;
    return l.service_address || '';
  }

  // First call associated with this lead (for recording/transcript)
  const firstCall = lead?.lead_calls?.[0]?.calls ?? null;
  const urgencyStyle = URGENCY_STYLES[lead?.urgency] || URGENCY_STYLES.routine;

  // Resolve recording URL — prefer Supabase Storage (new calls), fall back to recording_url (historical)
  const [recordingSrc, setRecordingSrc] = useState(null);
  useEffect(() => {
    if (!firstCall) { setRecordingSrc(null); return; }
    if (firstCall.recording_storage_path) {
      supabase.storage
        .from('call-recordings')
        .createSignedUrl(firstCall.recording_storage_path, 3600)
        .then(({ data }) => setRecordingSrc(data?.signedUrl || null));
    } else {
      setRecordingSrc(firstCall.recording_url || null);
    }
  }, [firstCall]);

  // ─── Save status change ──────────────────────────────────────────────────

  async function handleSave() {
    if (!lead) return;

    // Validate paid requires revenue
    if (selectedStatus === 'paid' && !revenueAmount) {
      setRevenueError('Enter a revenue amount to save this as Paid.');
      return;
    }

    setRevenueError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedStatus,
          previous_status: lead.status,
          revenue_amount: revenueAmount ? parseFloat(revenueAmount) : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Update failed');
      }

      const updatedData = await res.json();
      setLead(updatedData.lead);

      // Toast notifications per UI-SPEC
      if (selectedStatus === 'lost') {
        toast.success('Lead marked as Lost');
      } else if (revenueAmount && (selectedStatus === 'paid' || selectedStatus === 'completed')) {
        toast.success(`$${parseFloat(revenueAmount).toFixed(2)} recorded for ${lead.caller_name || 'lead'}`);
      } else {
        toast.success(`${lead.caller_name || 'Lead'} moved to ${STATUS_LABELS[selectedStatus]}`);
      }

      onStatusChange?.(updatedData.lead);
    } catch (err) {
      toast.error('Status update failed. Try again — your changes weren\'t saved.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Mark as Lost ────────────────────────────────────────────────────────

  async function handleMarkLost() {
    if (!lead) return;
    setMarkingLost(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'lost',
          previous_status: lead.status,
        }),
      });
      if (!res.ok) throw new Error('Failed to mark as lost');
      const updatedData = await res.json();
      toast.success('Lead marked as Lost');
      onStatusChange?.(updatedData.lead);
      onOpenChange(false);
    } catch {
      toast.error('Status update failed. Try again — your changes weren\'t saved.');
    } finally {
      setMarkingLost(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-card">

        {/* Loading state */}
        {loading && (
          <>
            <SheetHeader className="pb-0">
              <SheetTitle className="sr-only">Loading lead details</SheetTitle>
            </SheetHeader>
            <LeadFlyoutSkeleton />
          </>
        )}

        {/* Error state */}
        {!loading && fetchError && (
          <>
            <SheetHeader>
              <SheetTitle className="text-xl text-foreground">Lead Details</SheetTitle>
            </SheetHeader>
            <div className="px-6 flex flex-col items-center gap-4 py-8">
              <p className="text-sm text-stone-500 text-center">
                Couldn&apos;t load lead details.
              </p>
              <Button variant="outline" size="sm" onClick={fetchLead}>
                Retry
              </Button>
            </div>
          </>
        )}

        {/* Lead detail */}
        {!loading && !fetchError && lead && (
          <>
            {/* ── SheetHeader: Urgency badge + status select + lead age ── */}
            <SheetHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs font-semibold ${urgencyStyle.badge}`}>
                    {urgencyStyle.label}
                  </Badge>
                  <span className="text-xs text-stone-400">
                    {formatRelativeTime(lead.created_at)}
                  </span>
                </div>
              </div>
              {editingName ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    className="flex-1 text-xl font-semibold text-foreground leading-snug border-b-2 border-[var(--brand-accent)] outline-none bg-transparent"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleNameSave(); if (e.key === 'Escape') setEditingName(false); }}
                    autoFocus
                  />
                  <button type="button" onClick={handleNameSave} className="p-1 text-green-600 hover:text-green-700">
                    <Check className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setEditingName(false)} className="p-1 text-stone-400 hover:text-stone-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <SheetTitle
                  className="text-xl font-semibold text-foreground leading-snug mt-1 group cursor-pointer"
                  onClick={() => { setNameDraft(lead.caller_name || ''); setEditingName(true); }}
                >
                  {lead.caller_name || 'Unknown Caller'}
                  <Pencil className="inline-block h-3.5 w-3.5 ml-2 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </SheetTitle>
              )}
            </SheetHeader>

            <div className="px-6 space-y-6 pb-4">

              {/* ── Caller section ── */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-foreground/80">
                  <Phone className="h-4 w-4 text-stone-400 flex-shrink-0" />
                  {editingPhone ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="tel"
                        className="flex-1 text-sm border-b border-[var(--brand-accent)] outline-none bg-transparent py-0.5"
                        placeholder="+1 555 123 4567"
                        value={phoneDraft}
                        onChange={(e) => setPhoneDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handlePhoneSave(); if (e.key === 'Escape') setEditingPhone(false); }}
                        autoFocus
                      />
                      <button type="button" onClick={handlePhoneSave} className="p-0.5 text-green-600 hover:text-green-700">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingPhone(false)} className="p-0.5 text-stone-400 hover:text-stone-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : lead.from_number ? (
                    <div className="flex items-center gap-2 flex-1 group">
                      <a
                        href={`tel:${lead.from_number}`}
                        className="text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] transition-colors"
                      >
                        {lead.from_number}
                      </a>
                      <button
                        type="button"
                        className="p-0.5 text-stone-300 opacity-0 group-hover:opacity-100 hover:text-stone-600 transition-opacity"
                        onClick={() => { setPhoneDraft(lead.from_number || ''); setEditingPhone(true); }}
                        aria-label="Edit phone number"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-stone-400 hover:text-[var(--brand-accent)] transition-colors text-sm"
                      onClick={() => { setPhoneDraft(''); setEditingPhone(true); }}
                    >
                      + Add phone
                    </button>
                  )}
                </div>
                {/* Email — inline editable */}
                <div className="flex items-center gap-2 text-sm text-foreground/80">
                  <Mail className="h-4 w-4 text-stone-400 flex-shrink-0" />
                  {editingEmail ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="email"
                        className="flex-1 text-sm border-b border-[var(--brand-accent)] outline-none bg-transparent py-0.5"
                        placeholder="customer@example.com"
                        value={emailDraft}
                        onChange={(e) => setEmailDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSave(); if (e.key === 'Escape') setEditingEmail(false); }}
                        autoFocus
                      />
                      <button type="button" onClick={handleEmailSave} className="p-0.5 text-green-600 hover:text-green-700">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingEmail(false)} className="p-0.5 text-stone-400 hover:text-stone-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : lead.email ? (
                    <button
                      type="button"
                      className="text-foreground/80 hover:text-[var(--brand-accent)] transition-colors text-left"
                      onClick={() => { setEmailDraft(lead.email || ''); setEditingEmail(true); }}
                    >
                      {lead.email}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-stone-400 hover:text-[var(--brand-accent)] transition-colors text-sm"
                      onClick={() => { setEmailDraft(''); setEditingEmail(true); }}
                    >
                      + Add email
                    </button>
                  )}
                </div>
                {firstCall?.start_timestamp && (
                  <div className="flex items-center gap-2 text-sm text-stone-500">
                    <Calendar className="h-4 w-4 text-stone-400 flex-shrink-0" />
                    <span>{formatDateTime(firstCall.start_timestamp)}</span>
                  </div>
                )}
              </div>

              <Separator className="bg-stone-100" />

              {/* ── Job section ── */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Job Details
                </h3>

                {/* Job type — inline editable */}
                <div className="flex items-center gap-2 text-sm text-foreground/80">
                  <Briefcase className="h-4 w-4 text-stone-400 flex-shrink-0" />
                  {editingJobType ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        className="flex-1 text-sm border-b border-[var(--brand-accent)] outline-none bg-transparent py-0.5"
                        placeholder="e.g. Plumbing repair"
                        value={jobTypeDraft}
                        onChange={(e) => setJobTypeDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleJobTypeSave(); if (e.key === 'Escape') setEditingJobType(false); }}
                        autoFocus
                      />
                      <button type="button" onClick={handleJobTypeSave} className="p-0.5 text-green-600 hover:text-green-700">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingJobType(false)} className="p-0.5 text-stone-400 hover:text-stone-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : lead.job_type ? (
                    <div className="flex items-center gap-2 flex-1 group">
                      <span className="capitalize">{lead.job_type}</span>
                      <button
                        type="button"
                        className="p-0.5 text-stone-300 opacity-0 group-hover:opacity-100 hover:text-stone-600 transition-opacity"
                        onClick={() => { setJobTypeDraft(lead.job_type || ''); setEditingJobType(true); }}
                        aria-label="Edit job type"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-stone-400 hover:text-[var(--brand-accent)] transition-colors text-sm"
                      onClick={() => { setJobTypeDraft(''); setEditingJobType(true); }}
                    >
                      + Add job type
                    </button>
                  )}
                </div>

                {/* Address — inline editable single-line */}
                <div className="flex items-start gap-2 text-sm text-foreground/80">
                  <MapPin className="h-4 w-4 text-stone-400 flex-shrink-0 mt-0.5" />
                  {editingAddress ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        className="flex-1 text-sm border-b border-[var(--brand-accent)] outline-none bg-transparent py-0.5"
                        placeholder="Street, postal/ZIP"
                        value={addressDraft}
                        onChange={(e) => setAddressDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddressSave(); if (e.key === 'Escape') setEditingAddress(false); }}
                        autoFocus
                      />
                      <button type="button" onClick={handleAddressSave} className="p-0.5 text-green-600 hover:text-green-700">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingAddress(false)} className="p-0.5 text-stone-400 hover:text-stone-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : currentAddressText(lead) ? (
                    <div className="flex items-start gap-2 flex-1 group">
                      <span className="flex-1">{currentAddressText(lead)}</span>
                      <button
                        type="button"
                        className="p-0.5 text-stone-300 opacity-0 group-hover:opacity-100 hover:text-stone-600 transition-opacity shrink-0"
                        onClick={() => { setAddressDraft(currentAddressText(lead)); setEditingAddress(true); }}
                        aria-label="Edit address"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-stone-400 hover:text-[var(--brand-accent)] transition-colors text-sm"
                      onClick={() => { setAddressDraft(''); setEditingAddress(true); }}
                    >
                      + Add address
                    </button>
                  )}
                </div>

                {/* Urgency — Select (direct commit on change) */}
                <div className="flex items-center gap-2 text-sm text-foreground/80">
                  <AlertCircle className="h-4 w-4 text-stone-400 flex-shrink-0" />
                  <Select
                    value={lead.urgency || 'routine'}
                    onValueChange={async (v) => {
                      const prev = lead.urgency;
                      setLead((p) => ({ ...p, urgency: v }));
                      try {
                        const res = await fetch(`/api/leads/${lead.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ urgency: v }),
                        });
                        if (!res.ok) throw new Error();
                        toast.success('Urgency updated');
                      } catch {
                        setLead((p) => ({ ...p, urgency: prev }));
                        toast.error('Could not update urgency');
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 w-auto text-sm border-none shadow-none px-2 -mx-2 hover:bg-stone-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="bg-stone-100" />

              {/* ── Audio player ── */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Call Recording
                </h3>
                <AudioPlayer src={recordingSrc} />
              </div>

              {/* ── Transcript ── */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Transcript
                </h3>
                <TranscriptViewer
                  transcriptStructured={firstCall?.transcript_structured ?? null}
                  transcriptText={firstCall?.transcript_text ?? null}
                />
              </div>

              {/* ── Invoice section ── */}
              {(lead.status === 'booked' || lead.status === 'completed' || lead.status === 'paid') && (
                <>
                  <Separator className="bg-stone-100" />
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Invoice
                    </h3>

                    {linkedInvoice ? (
                      <button
                        onClick={() => router.push(`/dashboard/invoices/${linkedInvoice.id}`)}
                        className="flex items-center justify-between w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                      >
                        <span className="flex items-center gap-2 text-stone-700 font-medium">
                          <FileText className="h-4 w-4 text-stone-400" />
                          {linkedInvoice.invoice_number}
                        </span>
                        <span className="flex items-center gap-2">
                          <InvoiceStatusBadge status={linkedInvoice.status} />
                          <ExternalLink className="h-3.5 w-3.5 text-stone-400" />
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push(`/dashboard/invoices/new?lead_id=${lead.id}`)}
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-[var(--brand-accent)] border border-[var(--brand-accent)]/30 rounded-lg hover:bg-accent transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        {lead.status === 'booked' ? 'Create Draft Invoice' : 'Create Invoice'}
                      </button>
                    )}

                    <button
                      onClick={() => router.push(`/dashboard/estimates/new?lead_id=${lead.id}`)}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-[var(--brand-accent)] border border-[var(--brand-accent)] rounded-lg hover:bg-[var(--brand-accent)]/10 transition-colors"
                    >
                      <ClipboardList className="h-4 w-4" />
                      Create Estimate
                    </button>
                  </div>
                </>
              )}

              {/* ── Customer Journey Timeline ── */}
              {lead.from_number && (
                <>
                  <Separator className="bg-stone-100" />
                  <CustomerTimeline phone={lead.from_number} leadId={lead.id} />
                </>
              )}

              {/* -- VIP Caller toggle -- */}
              {lead.from_number && (
                <>
                  <Separator className="bg-stone-100" />
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <UserCheck className={`h-3.5 w-3.5 ${lead.is_vip ? 'text-violet-500' : 'text-stone-400'}`} />
                      <div>
                        <span className="text-sm font-medium text-foreground">Priority Caller</span>
                        <p className="text-xs text-muted-foreground">Always ring your phone when this caller dials in.</p>
                      </div>
                    </div>
                    <Switch
                      checked={lead.is_vip || false}
                      onCheckedChange={async (checked) => {
                        // Optimistic update
                        setLead(prev => ({ ...prev, is_vip: checked }));
                        try {
                          const res = await fetch(`/api/leads/${lead.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ is_vip: checked }),
                          });
                          if (!res.ok) throw new Error();
                          toast.success(checked ? 'Caller marked as priority' : 'Priority status removed');
                        } catch {
                          // Revert optimistic update
                          setLead(prev => ({ ...prev, is_vip: !checked }));
                          toast.error('Could not update priority status -- try again');
                        }
                      }}
                      aria-label="Toggle priority status"
                    />
                  </div>
                </>
              )}

              <Separator className="bg-stone-100" />

              {/* ── Pipeline actions: status select + revenue input ── */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Pipeline Status
                </h3>

                <Select
                  value={selectedStatus}
                  onValueChange={(val) => {
                    setSelectedStatus(val);
                    setRevenueError('');
                    if (!showsRevenueInput(val)) setRevenueAmount('');
                  }}
                >
                  <SelectTrigger className="w-full min-h-[44px] text-sm">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem
                        key={status}
                        value={status}
                        className={
                          status === lead.status
                            ? 'border-l-2 border-[var(--brand-accent)] pl-2'
                            : ''
                        }
                      >
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Revenue input — visible for completed or paid */}
                {showsRevenueInput(selectedStatus) && (
                  <RevenueInput
                    value={revenueAmount}
                    onChange={setRevenueAmount}
                    required={selectedStatus === 'paid'}
                    error={revenueError}
                  />
                )}

                {/* Save button */}
                <Button
                  onClick={handleSave}
                  disabled={saving || (selectedStatus === lead.status && !revenueAmount)}
                  className={`w-full min-h-[44px] font-semibold ${btn.primary}`}
                >
                  {saving ? 'Saving...' : 'Update Status'}
                </Button>
              </div>
            </div>

            {/* ── SheetFooter: Mark as Lost (destructive) ── */}
            <SheetFooter className="px-6">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={markingLost || lead.status === 'lost'}
                  >
                    {markingLost ? 'Moving to Lost...' : 'Mark as Lost'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark this lead as Lost?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This lead will be moved to Lost. You can still view the call history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleMarkLost}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Yes, Mark as Lost
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
