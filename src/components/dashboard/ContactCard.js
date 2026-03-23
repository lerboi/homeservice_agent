'use client';

import { useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function ContactCard({
  contact,
  onUpdate,
  onRemove,
  isEditing,
  onEditToggle,
  dragHandleProps,
  dragRef,
  dragStyle,
  isDragging,
  t,
}) {
  const [form, setForm] = useState({
    name: contact.name || '',
    role: contact.role || '',
    phone: contact.phone || '',
    email: contact.email || '',
    timeout_seconds: contact.timeout_seconds ?? 30,
    notification_pref: contact.notification_pref || 'both',
  });
  const [errors, setErrors] = useState({});

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) {
      errs.name = t('escalation.name_required');
    }
    if (form.notification_pref === 'sms' || form.notification_pref === 'both') {
      if (!form.phone.trim()) {
        errs.phone = t('escalation.phone_required');
      }
    }
    if (form.notification_pref === 'email' || form.notification_pref === 'both') {
      if (!form.email.trim()) {
        errs.email = t('escalation.email_required');
      }
    }
    return errs;
  }

  function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onUpdate(contact.id, {
      name: form.name.trim(),
      role: form.role.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      timeout_seconds: Number(form.timeout_seconds),
      notification_pref: form.notification_pref,
    });
  }

  function handleCancel() {
    // Reset form to contact values
    setForm({
      name: contact.name || '',
      role: contact.role || '',
      phone: contact.phone || '',
      email: contact.email || '',
      timeout_seconds: contact.timeout_seconds ?? 30,
      notification_pref: contact.notification_pref || 'both',
    });
    setErrors({});
    onEditToggle(null);
  }

  return (
    <div
      ref={dragRef}
      style={{ ...dragStyle, opacity: isDragging ? 0.5 : 1 }}
      className="border border-stone-200 rounded-lg bg-white"
      role="listitem"
    >
      {/* Display row */}
      <div className="flex items-center min-h-14 px-2">
        {/* Drag handle */}
        <button
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing p-2 text-stone-400 hover:text-stone-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={t('escalation.drag_hint')}
          type="button"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Contact info — click to edit */}
        <div
          className="flex-1 flex items-center gap-3 cursor-pointer py-3 pr-2"
          onClick={() => !isEditing && onEditToggle(contact.id)}
        >
          <span className="font-medium text-[#0F172A]">{contact.name}</span>
          {contact.role && (
            <span className="text-sm text-[#475569]">{contact.role}</span>
          )}
          <Badge variant="outline">{contact.timeout_seconds}s</Badge>
          <Badge variant="secondary" className="capitalize">
            {contact.notification_pref}
          </Badge>
        </div>

        {/* Remove button with AlertDialog */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              aria-label={`Remove ${contact.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('escalation.remove_title').replace('{name}', contact.name)}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('escalation.remove_description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('escalation.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onRemove(contact.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                {t('escalation.remove_confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Edit form — shown when isEditing */}
      {isEditing && (
        <div className="border-t border-stone-100 p-4 space-y-4">
          {/* Row 1: Name + Role */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor={`contact-name-${contact.id}`}>
                {t('escalation.contact_name_label')}
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                id={`contact-name-${contact.id}`}
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-xs text-red-600">{errors.name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`contact-role-${contact.id}`}>
                {t('escalation.contact_role_label')}
              </Label>
              <Input
                id={`contact-role-${contact.id}`}
                value={form.role}
                onChange={(e) => handleChange('role', e.target.value)}
                placeholder={t('escalation.contact_role_placeholder')}
              />
            </div>
          </div>

          {/* Row 2: Phone + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor={`contact-phone-${contact.id}`}>
                {t('escalation.contact_phone_label')}
              </Label>
              <Input
                id={`contact-phone-${contact.id}`}
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={errors.phone ? 'border-red-500' : ''}
              />
              {errors.phone && (
                <p className="text-xs text-red-600">{errors.phone}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`contact-email-${contact.id}`}>
                {t('escalation.contact_email_label')}
              </Label>
              <Input
                id={`contact-email-${contact.id}`}
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email}</p>
              )}
            </div>
          </div>

          {/* Row 3: Timeout + Notification channel */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor={`contact-timeout-${contact.id}`}>
                {t('escalation.contact_timeout_label')}
              </Label>
              <Select
                value={String(form.timeout_seconds)}
                onValueChange={(v) => handleChange('timeout_seconds', Number(v))}
              >
                <SelectTrigger id={`contact-timeout-${contact.id}`} className="min-w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">{t('escalation.timeout_15')}</SelectItem>
                  <SelectItem value="30">{t('escalation.timeout_30')}</SelectItem>
                  <SelectItem value="45">{t('escalation.timeout_45')}</SelectItem>
                  <SelectItem value="60">{t('escalation.timeout_60')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[#475569]">{t('escalation.contact_timeout_help')}</p>
            </div>
            <div className="space-y-1">
              <Label>{t('escalation.contact_channel_label')}</Label>
              <RadioGroup
                value={form.notification_pref}
                onValueChange={(v) => handleChange('notification_pref', v)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="sms" id={`channel-sms-${contact.id}`} />
                  <Label htmlFor={`channel-sms-${contact.id}`} className="cursor-pointer font-normal">
                    {t('escalation.channel_sms')}
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="email" id={`channel-email-${contact.id}`} />
                  <Label htmlFor={`channel-email-${contact.id}`} className="cursor-pointer font-normal">
                    {t('escalation.channel_email')}
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="both" id={`channel-both-${contact.id}`} />
                  <Label htmlFor={`channel-both-${contact.id}`} className="cursor-pointer font-normal">
                    {t('escalation.channel_both')}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* Row 4: Save + Cancel */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              onClick={handleSave}
              className="bg-[#C2410C] hover:bg-[#C2410C]/90 text-white"
            >
              Save
            </Button>
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
