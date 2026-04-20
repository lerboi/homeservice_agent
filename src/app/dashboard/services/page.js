'use client';

// Phase 58 Plan 58-05 (POLISH-01 / POLISH-02 / POLISH-04 / POLISH-05):
// Previously this route was a redirect to /dashboard/more/services-pricing.
// The plan's acceptance contract requires this exact path to render the
// polished services surface with <EmptyState> (Wrench icon, "No services yet"
// UI-SPEC §10.1 locked copy), <ErrorState onRetry> on fetch failure, and an
// <AsyncButton> for the Save flow. Setup-checklist already links here
// (src/app/api/setup-checklist/route.js:60) so the URL was always intended as
// a first-class destination — the redirect was vestigial. Routing via the More
// menu still works via /dashboard/more/services-pricing (left untouched).

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Wrench, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { card } from '@/lib/design-tokens';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { AsyncButton } from '@/components/ui/async-button';

const URGENCY_BADGE_CLASSES = {
  emergency: 'bg-red-100 text-red-700 hover:bg-red-100',
  urgent: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  routine: 'bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.06]',
};

const VALID_URGENCY_TAGS = ['emergency', 'routine', 'urgent'];

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [addingService, setAddingService] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const newServiceInputRef = useRef(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error('Failed to load services');
      const data = await res.json();
      setServices(data.services || []);
    } catch {
      setFetchError("Couldn't load services. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    if (addingService && newServiceInputRef.current) {
      newServiceInputRef.current.focus();
    }
  }, [addingService]);

  async function handleTagChange(serviceId, newTag) {
    const previous = services.find((s) => s.id === serviceId)?.urgency_tag;
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, urgency_tag: newTag } : s)),
    );
    try {
      const res = await fetch('/api/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: serviceId, urgency_tag: newTag }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Service updated');
    } catch {
      setServices((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, urgency_tag: previous } : s)),
      );
      toast.error("Changes couldn't be saved. Check your connection and try again.");
    }
  }

  async function handleAddService() {
    const name = newServiceName.trim();
    if (!name) {
      setAddingService(false);
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, urgency_tag: 'routine' }),
      });
      if (!res.ok) throw new Error('Create failed');
      const data = await res.json();
      setServices((prev) => [...prev, data.service]);
      setAddingService(false);
      setNewServiceName('');
    } catch {
      toast.error("Changes couldn't be saved. Check your connection and try again.");
    } finally {
      setAdding(false);
    }
  }

  function handleRemoveService(service) {
    setServices((prev) => prev.filter((s) => s.id !== service.id));
    fetch('/api/services', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: service.id }),
    }).catch(() => {
      toast.error('Delete failed — refresh to see current list.');
    });
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`${card.base} p-6`}>
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state (POLISH-04) ───────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className={`${card.base} p-6`}>
        <ErrorState message={fetchError} onRetry={fetchServices} />
      </div>
    );
  }

  // ── Empty state (POLISH-01) ───────────────────────────────────────────────
  // UI-SPEC §10.1 locked copy: "No services yet" / "Add the services you offer
  // so callers can book the right job." / CTA "Add a service" → openAddServiceDialog.
  if (services.length === 0 && !addingService) {
    return (
      <div className={`${card.base} p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-foreground">Services & Pricing</h1>
        </div>
        <EmptyState
          icon={Wrench}
          headline="No services yet"
          description="Add the services you offer so callers can book the right job."
          ctaLabel="Add a service"
          ctaOnClick={() => setAddingService(true)}
        />
      </div>
    );
  }

  // ── Service list ──────────────────────────────────────────────────────────
  return (
    <div className={`${card.base} p-6`}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground">Services & Pricing</h1>
        <Button
          variant="outline"
          size="sm"
          className="border-border hover:bg-muted"
          onClick={() => setAddingService(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add service
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-[var(--warm-surface)] border-b border-border">
          <span className="text-sm font-semibold text-muted-foreground">Service Name</span>
          <span className="text-sm font-semibold text-muted-foreground w-36 text-center">Urgency Tag</span>
          <span className="text-sm font-semibold text-muted-foreground w-10 text-center">Actions</span>
        </div>

        {services.map((service) => (
          <div
            key={service.id}
            className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-4 py-3 border-t border-border"
          >
            <span className="text-sm text-foreground">{service.name}</span>
            <Select
              value={service.urgency_tag || 'routine'}
              onValueChange={(value) => handleTagChange(service.id, value)}
            >
              <SelectTrigger className="w-36 h-8">
                <SelectValue>
                  <Badge className={URGENCY_BADGE_CLASSES[service.urgency_tag || 'routine']}>
                    {(service.urgency_tag || 'routine').charAt(0).toUpperCase() +
                      (service.urgency_tag || 'routine').slice(1)}
                  </Badge>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VALID_URGENCY_TAGS.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag.charAt(0).toUpperCase() + tag.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => handleRemoveService(service)}
              aria-label={`Remove ${service.name}`}
              className="w-10 h-8 flex items-center justify-center text-muted-foreground hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)] rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        {/* Add new service inline row — uses <AsyncButton> for POLISH-05 */}
        {addingService && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
            <Input
              ref={newServiceInputRef}
              placeholder="Service name"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddService();
                if (e.key === 'Escape') {
                  setAddingService(false);
                  setNewServiceName('');
                }
              }}
              className="max-w-xs"
              autoFocus
            />
            <AsyncButton
              pending={adding}
              pendingLabel="Adding…"
              onClick={handleAddService}
              size="sm"
            >
              Add service
            </AsyncButton>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAddingService(false);
                setNewServiceName('');
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
