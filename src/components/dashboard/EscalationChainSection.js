'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Phone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { ContactCard } from '@/components/dashboard/ContactCard';

// Per-urgency escalation mapping — static config per RESEARCH.md
// Urgency toggles are display-only indicators (not persisted to DB)
function getUrgencyEscalation(t) {
  return [
    {
      urgency: 'emergency',
      label: t('escalation.emergency_label'),
      description: t('escalation.emergency_desc'),
      borderClass: 'border-l-4 border-red-400',
      defaultEnabled: true,
      locked: true,
    },
    {
      urgency: 'high_ticket',
      label: t('escalation.high_ticket_label'),
      description: t('escalation.high_ticket_desc'),
      borderClass: 'border-l-4 border-amber-400',
      defaultEnabled: true,
      locked: false,
    },
    {
      urgency: 'routine',
      label: t('escalation.routine_label'),
      description: t('escalation.routine_desc'),
      borderClass: 'border-l-4 border-stone-300',
      defaultEnabled: false,
      locked: false,
    },
  ];
}

// A blank contact object used when adding a new contact
let _newContactIdCounter = -1;
function makeNewContact() {
  return {
    id: _newContactIdCounter--,
    name: '',
    role: '',
    phone: '',
    email: '',
    timeout_seconds: 30,
    notification_pref: 'both',
    sort_order: 999,
    is_active: true,
  };
}

// SortableContactWrapper — applies useSortable and passes drag props to ContactCard
function SortableContactWrapper({ contact, ...rest }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: contact.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ContactCard
      contact={contact}
      dragHandleProps={{ ...listeners, ...attributes }}
      dragRef={setNodeRef}
      dragStyle={style}
      isDragging={isDragging}
      {...rest}
    />
  );
}

export function EscalationChainSection() {
  const t = useTranslations('services');

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newContact, setNewContact] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const URGENCY_ESCALATION = getUrgencyEscalation(t);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    setLoading(true);
    try {
      const res = await fetch('/api/escalation-contacts');
      if (!res.ok) throw new Error('Failed to load contacts');
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch {
      toast.error('Failed to load escalation contacts');
    } finally {
      setLoading(false);
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setContacts((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      setHasChanges(true);
    }
  }

  function handleAddClick() {
    if (contacts.length >= 5) {
      toast.error(t('escalation.max_contacts'));
      return;
    }
    const blank = makeNewContact();
    setNewContact(blank);
    setIsAddingNew(true);
    setEditingId(blank.id);
  }

  async function handleUpdateContact(id, formData) {
    // New contact being saved via POST
    if (isAddingNew && newContact && id === newContact.id) {
      try {
        const res = await fetch('/api/escalation-contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Create failed');
        }
        const data = await res.json();
        setContacts((prev) => [...prev, data.contact]);
        setIsAddingNew(false);
        setNewContact(null);
        setEditingId(null);
      } catch (err) {
        toast.error(err.message || 'Failed to add contact');
      }
      return;
    }

    // Existing contact update via PUT
    try {
      const res = await fetch('/api/escalation-contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...formData }),
      });
      if (!res.ok) throw new Error('Update failed');
      const data = await res.json();
      setContacts((prev) =>
        prev.map((c) => (c.id === id ? data.contact : c))
      );
      setEditingId(null);
    } catch {
      toast.error('Failed to update contact');
    }
  }

  async function handleRemoveContact(id) {
    try {
      const res = await fetch('/api/escalation-contacts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      setContacts((prev) => prev.filter((c) => c.id !== id));
      if (editingId === id) setEditingId(null);
    } catch {
      toast.error('Failed to remove contact');
    }
  }

  async function handleSaveChain() {
    setIsSaving(true);
    try {
      const order = contacts.map((c, i) => ({ id: c.id, sort_order: i }));
      const res = await fetch('/api/escalation-contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error('Save failed');
      setHasChanges(false);
      toast.success(t('escalation.save_success'));
    } catch {
      toast.error(t('escalation.save_error'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelNew() {
    setIsAddingNew(false);
    setNewContact(null);
    setEditingId(null);
  }

  // ─── Loading state ──────────────────────────────────────────────────────────

  function SkeletonRows() {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────────────

  function EmptyState() {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Phone className="h-12 w-12 text-stone-300 mb-4" />
        <h2 className="text-xl font-semibold text-[#0F172A] mb-2">
          {t('escalation.empty_heading')}
        </h2>
        <p className="text-base text-[#475569] mb-6 max-w-sm">
          {t('escalation.empty_body')}
        </p>
        <Button
          className="bg-[#C2410C] hover:bg-[#C2410C]/90 text-white"
          onClick={() => handleAddClick()}
        >
          {t('escalation.empty_cta')}
        </Button>
      </div>
    );
  }

  // Combine persisted contacts + new contact being added
  const allContacts = isAddingNew && newContact
    ? [...contacts, newContact]
    : contacts;

  // IDs used for SortableContext — only persisted contacts are sortable
  const sortableIds = contacts.map((c) => c.id);

  const showContactList = !loading && (contacts.length > 0 || isAddingNew);
  const showEmptyState = !loading && contacts.length === 0 && !isAddingNew;

  return (
    <div>
      {/* Per-urgency mapping rows */}
      <div className="space-y-3 mb-6">
        <h3 className="text-sm font-semibold text-[#475569]">
          {t('escalation.urgency_heading')}
        </h3>
        {URGENCY_ESCALATION.map((row) => (
          <div
            key={row.urgency}
            className={`flex items-center justify-between p-3 rounded-lg bg-white border border-stone-200 ${row.borderClass}`}
          >
            <div>
              <span className="font-medium text-[#0F172A]">{row.label}</span>
              <p
                className="text-sm text-[#475569]"
                id={`${row.urgency}-desc`}
              >
                {row.description}
              </p>
            </div>
            <Switch
              checked={row.defaultEnabled}
              disabled={row.locked}
              aria-describedby={`${row.urgency}-desc`}
            />
          </div>
        ))}
      </div>

      <Separator className="my-4" />

      {/* Contact chain or empty state */}
      {loading && <SkeletonRows />}
      {showEmptyState && <EmptyState />}

      {showContactList && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2" role="list" aria-label="Escalation contacts">
              {allContacts.map((contact) => {
                // New (unsaved) contact: not sortable, render ContactCard directly
                if (isAddingNew && newContact && contact.id === newContact.id) {
                  return (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onUpdate={handleUpdateContact}
                      onRemove={handleRemoveContact}
                      isEditing={editingId === contact.id}
                      onEditToggle={(id) => {
                        if (id === null) handleCancelNew();
                        else setEditingId(id);
                      }}
                      dragHandleProps={{}}
                      dragRef={null}
                      dragStyle={{}}
                      isDragging={false}
                      t={t}
                    />
                  );
                }
                return (
                  <SortableContactWrapper
                    key={contact.id}
                    contact={contact}
                    onUpdate={handleUpdateContact}
                    onRemove={handleRemoveContact}
                    isEditing={editingId === contact.id}
                    onEditToggle={(id) => setEditingId(id)}
                    t={t}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add Contact + Save Chain buttons */}
      {!loading && (contacts.length > 0 || isAddingNew) && (
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            onClick={handleAddClick}
            disabled={contacts.length >= 5 || isAddingNew}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('escalation.add_contact')}
          </Button>
          <Button
            className="bg-[#C2410C] hover:bg-[#C2410C]/90 text-white"
            disabled={!hasChanges || isSaving}
            onClick={handleSaveChain}
          >
            {isSaving ? 'Saving...' : t('escalation.save_chain')}
          </Button>
        </div>
      )}
    </div>
  );
}
