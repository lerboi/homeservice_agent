'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import WorkingHoursEditor from '@/components/dashboard/WorkingHoursEditor';
import CalendarSyncCard from '@/components/dashboard/CalendarSyncCard';
import ZoneManager from '@/components/dashboard/ZoneManager';

const URGENCY_BADGE_CLASSES = {
  emergency: 'bg-red-100 text-red-700 hover:bg-red-100',
  high_ticket: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  routine: 'bg-[#0F172A]/[0.06] text-[#0F172A]/70 hover:bg-[#0F172A]/[0.06]',
};

const VALID_URGENCY_TAGS = ['emergency', 'routine', 'high_ticket'];

export default function ServicesPage() {
  const t = useTranslations('services');

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingService, setAddingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const newServiceInputRef = useRef(null);

  // Pending deletion: { id, name, timer }
  const pendingDeletions = useRef({});

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (addingService && newServiceInputRef.current) {
      newServiceInputRef.current.focus();
    }
  }, [addingService]);

  async function fetchServices() {
    setLoading(true);
    try {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error('Failed to load services');
      const data = await res.json();
      setServices(data.services || []);
    } catch {
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  }

  async function handleTagChange(serviceId, newTag) {
    const previous = services.find((s) => s.id === serviceId)?.urgency_tag;

    // Optimistic update
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, urgency_tag: newTag } : s))
    );

    try {
      const res = await fetch('/api/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: serviceId, urgency_tag: newTag }),
      });

      if (!res.ok) throw new Error('Save failed');
      toast.success(t('save_success_toast'));
    } catch {
      // Revert on error
      setServices((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, urgency_tag: previous } : s))
      );
      toast.error(t('save_failed', { defaultMessage: "Changes couldn't be saved. Check your connection and try again." }));
    }
  }

  function handleRemoveService(service) {
    // Remove from UI immediately
    setServices((prev) => prev.filter((s) => s.id !== service.id));

    // Show undo toast — 4s duration
    const toastId = toast(
      `${t('remove_undo_toast', { serviceName: service.name })} `,
      {
        duration: 4000,
        action: {
          label: t('undo'),
          onClick: () => {
            // Undo: restore row and cancel scheduled delete
            clearTimeout(pendingDeletions.current[service.id]);
            delete pendingDeletions.current[service.id];
            setServices((prev) => {
              // Re-insert in approximate original position
              return [...prev, service].sort(
                (a, b) => new Date(a.created_at) - new Date(b.created_at)
              );
            });
          },
        },
      }
    );

    // Schedule the actual DELETE after 4 seconds
    const timer = setTimeout(async () => {
      delete pendingDeletions.current[service.id];
      try {
        await fetch('/api/services', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: service.id }),
        });
      } catch {
        // If delete fails, silently log — service is already removed from UI
        console.error('Failed to delete service:', service.id);
      }
    }, 4100);

    pendingDeletions.current[service.id] = timer;
  }

  async function handleAddService() {
    const name = newServiceName.trim();
    if (!name) return;

    setAddingService(false);
    setNewServiceName('');

    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, urgency_tag: 'routine' }),
      });

      if (!res.ok) throw new Error('Create failed');
      const data = await res.json();
      setServices((prev) => [...prev, data.service]);
    } catch {
      toast.error(t('save_failed', { defaultMessage: "Changes couldn't be saved. Check your connection and try again." }));
    }
  }

  function handleNewServiceKeyDown(e) {
    if (e.key === 'Enter') {
      handleAddService();
    } else if (e.key === 'Escape') {
      setAddingService(false);
      setNewServiceName('');
    }
  }

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6">
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

  // ─── Empty state ───────────────────────────────────────────────────────────

  if (services.length === 0 && !addingService) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-[#0F172A]">{t('page_heading')}</h1>
          <Button
            variant="outline"
            size="sm"
            className="border-stone-200 hover:bg-stone-50"
            onClick={() => setAddingService(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('add_service')}
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-xl font-semibold text-[#0F172A] mb-2">{t('empty_heading')}</h2>
          <p className="text-base text-[#475569] mb-6 max-w-sm">{t('empty_body')}</p>
          <Button
            className="bg-[#C2410C] hover:bg-[#C2410C]/90 text-white"
            onClick={() => setAddingService(true)}
          >
            {t('empty_cta')}
          </Button>
        </div>

        <Separator className="my-6" />
        <WorkingHoursEditor />
        <Separator className="my-6" />
        <CalendarSyncCard />
        <Separator className="my-6" />
        <ZoneManager />
      </div>
    );
  }

  // ─── Service table ─────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#0F172A]">{t('page_heading')}</h1>
        <Button
          variant="outline"
          size="sm"
          className="border-stone-200 hover:bg-stone-50"
          onClick={() => setAddingService(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('add_service')}
        </Button>
      </div>

      {/* Table */}
      <div className="border border-stone-200 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-[#F5F5F4] border-b border-stone-200">
          <span className="text-sm font-semibold text-[#475569]">Service Name</span>
          <span className="text-sm font-semibold text-[#475569] w-36 text-center">Urgency Tag</span>
          <span className="text-sm font-semibold text-[#475569] w-10 text-center">Actions</span>
        </div>

        {/* Service rows */}
        {services.map((service) => (
          <div
            key={service.id}
            className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 items-center min-h-14 border-b border-stone-100 last:border-b-0"
          >
            {/* Service name */}
            <span className="text-base text-[#0F172A]">{service.name}</span>

            {/* Urgency tag dropdown */}
            <div className="w-36 flex items-center gap-2">
              <Badge className={URGENCY_BADGE_CLASSES[service.urgency_tag] || URGENCY_BADGE_CLASSES.routine}>
                {service.urgency_tag === 'emergency' && t('tag_emergency')}
                {service.urgency_tag === 'routine' && t('tag_routine')}
                {service.urgency_tag === 'high_ticket' && t('tag_high_ticket')}
              </Badge>
              <Select
                value={service.urgency_tag}
                onValueChange={(value) => handleTagChange(service.id, value)}
              >
                <SelectTrigger className="h-8 w-8 p-0 border-0 shadow-none focus:ring-0 text-stone-400" aria-label={`Change urgency for ${service.name}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emergency">
                    <span className="text-red-700">{t('tag_emergency')}</span>
                  </SelectItem>
                  <SelectItem value="routine">
                    <span className="text-[#475569]">{t('tag_routine')}</span>
                  </SelectItem>
                  <SelectItem value="high_ticket">
                    <span className="text-amber-700">{t('tag_high_ticket')}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Remove button */}
            <button
              type="button"
              className="w-10 flex items-center justify-center h-10 rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              aria-label={`Remove ${service.name}`}
              onClick={() => handleRemoveService(service)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        {/* Add new service inline row */}
        {addingService && (
          <div className="flex items-center px-4 min-h-14 border-t border-stone-100 gap-2">
            <Input
              ref={newServiceInputRef}
              placeholder="Service name"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              onKeyDown={handleNewServiceKeyDown}
              onBlur={handleAddService}
              className="max-w-xs"
              autoFocus
            />
            <span className="text-sm text-stone-400">Press Enter to add</span>
          </div>
        )}
      </div>

      <Separator className="my-6" />
      <WorkingHoursEditor />
      <Separator className="my-6" />
      <CalendarSyncCard />
      <Separator className="my-6" />
      <ZoneManager />
    </div>
  );
}
