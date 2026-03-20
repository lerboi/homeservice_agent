'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

const TRAVEL_BUFFER_OPTIONS = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '60 min' },
];

function PostalCodeInput({ onAdd }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const code = value.trim().replace(/,$/, '');
      if (code) {
        onAdd(code);
        setValue('');
      }
    } else if (e.key === 'Backspace' && !value) {
      // Signal to parent to remove last tag
      onAdd(null);
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        const code = value.trim().replace(/,$/, '');
        if (code) {
          onAdd(code);
          setValue('');
        }
      }}
      placeholder="Add postal code…"
      className="min-w-0 flex-1 h-7 text-xs border-0 outline-none focus:ring-0 bg-transparent placeholder:text-slate-400"
    />
  );
}

function ZoneCard({ zone, onUpdate, onDelete }) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(zone.name);
  const [postalCodes, setPostalCodes] = useState(zone.postal_codes || []);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  async function saveName() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === zone.name) {
      setNameValue(zone.name);
      setEditingName(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/zones/${zone.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, postal_codes: postalCodes }),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      onUpdate(data.zone);
      setEditingName(false);
    } catch {
      toast.error("Zone name couldn't be saved. Try again.");
      setNameValue(zone.name);
      setEditingName(false);
    } finally {
      setSaving(false);
    }
  }

  async function savePostalCodes(codes) {
    try {
      const res = await fetch(`/api/zones/${zone.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: zone.name, postal_codes: codes }),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      onUpdate(data.zone);
    } catch {
      toast.error("Postal codes couldn't be saved. Try again.");
    }
  }

  function addPostalCode(code) {
    if (code === null) {
      // Remove last tag
      const updated = postalCodes.slice(0, -1);
      setPostalCodes(updated);
      savePostalCodes(updated);
      return;
    }
    if (postalCodes.includes(code)) return;
    const updated = [...postalCodes, code];
    setPostalCodes(updated);
    savePostalCodes(updated);
  }

  function removePostalCode(code) {
    const updated = postalCodes.filter((c) => c !== code);
    setPostalCodes(updated);
    savePostalCodes(updated);
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      {/* Zone name header */}
      <div className="flex items-center justify-between mb-3">
        {editingName ? (
          <div className="flex items-center gap-2 flex-1 mr-2">
            <input
              ref={nameInputRef}
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName();
                if (e.key === 'Escape') {
                  setNameValue(zone.name);
                  setEditingName(false);
                }
              }}
              className="flex-1 h-8 text-sm font-semibold border border-slate-300 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="button"
              onClick={saveName}
              disabled={saving}
              className="h-7 w-7 flex items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
              aria-label="Save zone name"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setNameValue(zone.name);
                setEditingName(false);
              }}
              className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
              aria-label="Cancel edit"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{zone.name}</span>
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              aria-label="Edit zone name"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <button
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-auto"
            aria-label={`Delete ${zone.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{zone.name}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>
                This zone and its travel buffer settings will be permanently removed. Existing
                appointments in this zone will not be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(zone.id)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Zone
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Postal code tags */}
      <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-slate-200 bg-slate-50 min-h-10">
        {postalCodes.map((code) => (
          <span
            key={code}
            className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs rounded-full px-2 h-7"
          >
            {code}
            <button
              type="button"
              onClick={() => removePostalCode(code)}
              className="text-slate-400 hover:text-slate-700 transition-colors ml-0.5"
              aria-label={`Remove ${code}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <PostalCodeInput onAdd={addPostalCode} />
      </div>
      <p className="text-xs text-slate-400 mt-1">Press Enter or comma to add a postal code</p>
    </div>
  );
}

export default function ZoneManager() {
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState([]);
  const [travelBuffers, setTravelBuffers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const addInputRef = useRef(null);

  useEffect(() => {
    if (adding && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [adding]);

  useEffect(() => {
    loadZones();
  }, []);

  async function loadZones() {
    try {
      const res = await fetch('/api/zones');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setZones(data.zones || []);
      setTravelBuffers(data.travelBuffers || []);
    } catch {
      toast.error('Failed to load service zones.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddZone() {
    const name = newZoneName.trim();
    if (!name) {
      setAdding(false);
      return;
    }
    try {
      const res = await fetch('/api/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, postal_codes: [] }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Create failed');
      }
      const data = await res.json();
      setZones((prev) => [...prev, data.zone]);
      toast.success(`Zone "${name}" created.`);
    } catch (err) {
      toast.error(err.message || "Zone couldn't be created. Try again.");
    } finally {
      setNewZoneName('');
      setAdding(false);
    }
  }

  const handleUpdateZone = useCallback((updatedZone) => {
    setZones((prev) => prev.map((z) => (z.id === updatedZone.id ? updatedZone : z)));
  }, []);

  async function handleDeleteZone(zoneId) {
    const zone = zones.find((z) => z.id === zoneId);
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
    // Also remove any travel buffers involving this zone
    setTravelBuffers((prev) =>
      prev.filter((b) => b.zone_a_id !== zoneId && b.zone_b_id !== zoneId)
    );

    try {
      const res = await fetch(`/api/zones/${zoneId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success(`Zone "${zone?.name || ''}" deleted.`);
    } catch {
      // Restore on failure
      if (zone) setZones((prev) => [...prev, zone].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
      toast.error("Zone couldn't be deleted. Try again.");
    }
  }

  function getBuffer(zoneAId, zoneBId) {
    const buf = travelBuffers.find(
      (b) =>
        (b.zone_a_id === zoneAId && b.zone_b_id === zoneBId) ||
        (b.zone_a_id === zoneBId && b.zone_b_id === zoneAId)
    );
    return buf ? String(buf.buffer_mins) : '30';
  }

  async function handleBufferChange(zoneAId, zoneBId, bufferMins) {
    const newBuffer = { zone_a_id: zoneAId, zone_b_id: zoneBId, buffer_mins: parseInt(bufferMins, 10) };

    // Optimistic update
    setTravelBuffers((prev) => {
      const existing = prev.findIndex(
        (b) =>
          (b.zone_a_id === zoneAId && b.zone_b_id === zoneBId) ||
          (b.zone_a_id === zoneBId && b.zone_b_id === zoneAId)
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], buffer_mins: parseInt(bufferMins, 10) };
        return updated;
      }
      return [...prev, newBuffer];
    });

    try {
      const res = await fetch('/api/zones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buffers: [newBuffer] }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch {
      toast.error("Travel buffer couldn't be saved. Try again.");
    }
  }

  // Generate all zone pairs for travel buffers
  const zonePairs = [];
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      zonePairs.push([zones[i], zones[j]]);
    }
  }

  const atLimit = zones.length >= 5;

  if (loading) {
    return (
      <section aria-labelledby="zone-manager-heading" className="mt-6">
        <h2 id="zone-manager-heading" className="text-xl font-semibold text-slate-900 mb-1">
          Service Zones
        </h2>
        <div className="space-y-3 mt-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <TooltipProvider>
      <section aria-labelledby="zone-manager-heading" className="mt-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 id="zone-manager-heading" className="text-xl font-semibold text-slate-900">
              Service Zones
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Define the areas you serve. Zones help your AI suggest the right time slots and account
              for travel between jobs.
            </p>
          </div>

          {zones.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAdding(true)}
                    disabled={atLimit || adding}
                    className={atLimit ? 'opacity-50 cursor-not-allowed' : ''}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Zone
                  </Button>
                </span>
              </TooltipTrigger>
              {atLimit && (
                <TooltipContent>
                  <p>Maximum of 5 zones reached</p>
                </TooltipContent>
              )}
            </Tooltip>
          )}
        </div>

        {/* Add zone inline input */}
        {adding && (
          <div className="mt-4 flex items-center gap-2">
            <Input
              ref={addInputRef}
              placeholder="Zone name (e.g. North Side)"
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddZone();
                if (e.key === 'Escape') {
                  setAdding(false);
                  setNewZoneName('');
                }
              }}
              onBlur={handleAddZone}
              className="max-w-xs"
            />
            <span className="text-sm text-slate-400">Press Enter to create</span>
          </div>
        )}

        {/* Empty state */}
        {zones.length === 0 && !adding && (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 flex flex-col items-center text-center">
            <div className="p-3 rounded-full bg-white border border-slate-200 mb-3">
              <MapPin className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">No zones configured</h3>
            <p className="text-sm text-slate-500 mb-4 max-w-xs">
              Add service zones to let your AI understand which areas you cover and how long it takes
              to travel between them.
            </p>
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Zone
            </Button>
          </div>
        )}

        {/* Zone cards */}
        {zones.length > 0 && (
          <div className="mt-4 space-y-3">
            {zones.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                onUpdate={handleUpdateZone}
                onDelete={handleDeleteZone}
              />
            ))}
          </div>
        )}

        {/* Travel buffers — shown only when 2+ zones */}
        {zonePairs.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Travel Buffers</h3>
            <p className="text-xs text-slate-500 mb-3">
              Set the travel time between zones. This prevents back-to-back bookings without enough
              travel time.
            </p>
            <div className="space-y-2">
              {zonePairs.map(([zA, zB]) => (
                <div
                  key={`${zA.id}-${zB.id}`}
                  className="flex items-center gap-3 flex-wrap"
                >
                  <span className="text-sm text-slate-700 w-48 truncate">
                    {zA.name} ↔ {zB.name}
                  </span>
                  <Select
                    value={getBuffer(zA.id, zB.id)}
                    onValueChange={(val) => handleBufferChange(zA.id, zB.id, val)}
                  >
                    <SelectTrigger className="w-28 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRAVEL_BUFFER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}
