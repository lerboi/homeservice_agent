'use client';

// Phase 59 Plan 07 — D-18 Customer Edit modal
// Full CRUD modal: name, default_address, email, notes, tags (free-form chips)
// Phone is read-only with help text "To change phone, use Merge" (D-05)
// PATCH /api/customers/[id] on save; AlertDialog on unsaved close.

import { useState, useEffect } from 'react';
import { Info, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { btn, focus } from '@/lib/design-tokens';

// ─── Tags chip input ──────────────────────────────────────────────────────────

function TagsInput({ tags, onChange }) {
  const [inputValue, setInputValue] = useState('');

  function addTag(raw) {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag]);
  }

  function removeTag(tag) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className="min-h-[38px] flex flex-wrap gap-1.5 items-center px-3 py-2 border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-[var(--brand-accent)] focus-within:ring-offset-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-foreground"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? 'Add tags (Enter to add)' : ''}
        className="flex-1 min-w-[120px] text-sm bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * CustomerEditModal — modal for editing customer fields.
 * Phone is read-only (D-05/D-18). All other fields PATCH /api/customers/[id].
 *
 * @param {{ customer: object, open: boolean, onOpenChange: function, onSaved: function }} props
 */
export default function CustomerEditModal({ customer, open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    default_address: '',
    email: '',
    notes: '',
    tags: [],
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  // Sync form when customer changes or modal opens
  useEffect(() => {
    if (open && customer) {
      setForm({
        name: customer.name || '',
        default_address: customer.default_address || '',
        email: customer.email || '',
        notes: customer.notes || '',
        tags: Array.isArray(customer.tags) ? customer.tags : [],
      });
      setFormError(null);
      setIsDirty(false);
    }
  }, [open, customer]);

  function handleFieldChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setFormError(null);
  }

  function handleOpenChange(newOpen) {
    if (!newOpen && isDirty) {
      setDiscardDialogOpen(true);
      return;
    }
    onOpenChange(newOpen);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          default_address: form.default_address.trim() || null,
          email: form.email.trim() || null,
          notes: form.notes.trim() || null,
          tags: form.tags,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.field) {
          setFormError(`"${err.field}" cannot be changed here. ${err.error || ''}`);
        } else {
          setFormError(err.error || "Couldn't save changes. Please try again.");
        }
        return;
      }

      const data = await res.json();
      toast.success('Customer updated');
      onSaved?.(data.customer);
      setIsDirty(false);
      onOpenChange(false);
    } catch {
      setFormError("Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscardConfirm() {
    setDiscardDialogOpen(false);
    setIsDirty(false);
    onOpenChange(false);
  }

  if (!customer) return null;

  // Phone display: E.164 formatted for readability
  const displayPhone = customer.phone_e164 || '';

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription className="sr-only">
              Edit customer details. Phone cannot be changed — use Merge to change phone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Error banner */}
            {formError && (
              <div className="px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm">
                {formError}
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="cust-name">Name</Label>
              <Input
                id="cust-name"
                value={form.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="Full name or business name"
                className={focus.ring}
              />
            </div>

            {/* Phone — read-only */}
            <div className="space-y-1.5">
              <Label htmlFor="cust-phone" className="text-muted-foreground">
                Phone
              </Label>
              <Input
                id="cust-phone"
                value={displayPhone}
                readOnly
                disabled
                className="font-mono tabular-nums text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3.5 w-3.5 flex-shrink-0" />
                To change phone, use Merge
              </p>
            </div>

            {/* Default address */}
            <div className="space-y-1.5">
              <Label htmlFor="cust-address">Default address</Label>
              <Input
                id="cust-address"
                value={form.default_address}
                onChange={(e) => handleFieldChange('default_address', e.target.value)}
                placeholder="Street, city, postal code"
                className={focus.ring}
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="cust-email">Email</Label>
              <Input
                id="cust-email"
                type="email"
                value={form.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                placeholder="customer@example.com"
                className={focus.ring}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="cust-notes">Notes</Label>
              <Textarea
                id="cust-notes"
                value={form.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                placeholder="Any details about this customer…"
                rows={3}
                className={focus.ring}
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <TagsInput
                tags={form.tags}
                onChange={(newTags) => handleFieldChange('tags', newTags)}
              />
              <p className="text-xs text-muted-foreground">
                Press Enter to add a tag. Backspace to remove the last tag.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className={btn.primary}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard changes confirmation */}
      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Closing will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDiscardDialogOpen(false)}>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscardConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
