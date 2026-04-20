'use client';

// Phase 58 Plan 58-05 (POLISH-02 / POLISH-04 / POLISH-05):
// Previously this route was a redirect to /dashboard/more. The plan requires
// this literal path to render a polished settings form surface using the
// <ErrorState> + <AsyncButton> primitives from Plan 58-04. The setup-checklist
// links here directly (src/app/api/setup-checklist/route.js:55). Users can
// still reach the full More menu via /dashboard/more.
//
// This page is a lightweight business profile form. Deeper settings (working
// hours, service zones, notifications, etc.) keep their dedicated routes under
// /dashboard/more/*.

import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { card } from '@/lib/design-tokens';
import { ErrorState } from '@/components/ui/error-state';
import { AsyncButton } from '@/components/ui/async-button';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ business_name: '', greeting_script: '' });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/tenant');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      setForm({
        business_name: data.tenant?.business_name || '',
        greeting_script: data.tenant?.greeting_script || '',
      });
    } catch {
      setFetchError("Couldn't load your settings. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/tenant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Settings saved');
    } catch {
      toast.error("Changes couldn't be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className={`${card.base} p-6 space-y-5`}>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
    );
  }

  // ── Error state (POLISH-04) ───────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className={`${card.base} p-6`}>
          <ErrorState message={fetchError} onRetry={fetchSettings} />
        </div>
      </div>
    );
  }

  // ── Form (POLISH-05: Save uses <AsyncButton pendingLabel="Saving…">) ──────
  return (
    <div className="max-w-2xl mx-auto">
      <div className={`${card.base} p-6 space-y-5`}>
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Business profile used by your AI receptionist. Advanced settings
          (working hours, service zones, notifications) live in the More menu.
        </p>

        <div className="space-y-2">
          <Label htmlFor="business_name" className="text-sm font-medium">
            <span className="inline-flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              Business name
            </span>
          </Label>
          <Input
            id="business_name"
            value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            placeholder="Acme Plumbing"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="greeting_script" className="text-sm font-medium">Greeting script</Label>
          <textarea
            id="greeting_script"
            value={form.greeting_script}
            onChange={(e) => setForm({ ...form, greeting_script: e.target.value })}
            rows={4}
            placeholder="Thanks for calling Acme Plumbing, this is your AI receptionist — how can I help?"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]"
          />
        </div>

        <AsyncButton
          pending={saving}
          pendingLabel="Saving…"
          onClick={handleSave}
        >
          Save changes
        </AsyncButton>
      </div>
    </div>
  );
}
