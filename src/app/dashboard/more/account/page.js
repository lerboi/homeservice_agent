'use client';

import { useState, useEffect } from 'react';
import { Loader2, LogOut, Save } from 'lucide-react';
import { card, btn } from '@/lib/design-tokens';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { supabase } from '@/lib/supabase-browser';

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    owner_email: '',
    owner_phone: '',
  });
  const [original, setOriginal] = useState(null);
  const [meta, setMeta] = useState({ email: '', trade_type: '', country: '', created_at: '' });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/account');
        if (res.ok) {
          const data = await res.json();
          const fields = {
            business_name: data.business_name || '',
            owner_name: data.owner_name || '',
            owner_email: data.owner_email || '',
            owner_phone: data.owner_phone || '',
          };
          setForm(fields);
          setOriginal(fields);
          setMeta({
            email: data.email || '',
            trade_type: data.trade_type || '',
            country: data.country || '',
            created_at: data.created_at || '',
          });
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  const isDirty = original && JSON.stringify(form) !== JSON.stringify(original);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    setError(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.business_name.trim()) {
      setError('Business name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setOriginal({ ...form });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save changes.');
      }
    } catch {
      setError('Failed to save changes.');
    }
    setSaving(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/auth/signin';
  }

  if (loading) {
    return (
      <div className={`${card.base} p-6`}>
        <h1 className="text-xl font-semibold text-[#0F172A] mb-6">Account</h1>
        <div className="space-y-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile section */}
      <div className={`${card.base} p-6`}>
        <h1 className="text-xl font-semibold text-[#0F172A] mb-1">Account</h1>
        <p className="text-sm text-[#475569] mb-6">Manage your business profile and account settings.</p>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business name</Label>
            <Input
              id="business_name"
              value={form.business_name}
              onChange={(e) => handleChange('business_name', e.target.value)}
              placeholder="e.g. Smith Plumbing"
            />
            <p className="text-xs text-[#475569]">This is how your AI receptionist greets callers.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner_name">Your name</Label>
            <Input
              id="owner_name"
              value={form.owner_name}
              onChange={(e) => handleChange('owner_name', e.target.value)}
              placeholder="e.g. John Smith"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner_email">Contact email</Label>
            <Input
              id="owner_email"
              type="email"
              value={form.owner_email}
              onChange={(e) => handleChange('owner_email', e.target.value)}
              placeholder="e.g. john@smithplumbing.com"
            />
            <p className="text-xs text-[#475569]">Used for notifications. Your login email is {meta.email}.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner_phone">Contact phone</Label>
            <Input
              id="owner_phone"
              type="tel"
              value={form.owner_phone}
              onChange={(e) => handleChange('owner_phone', e.target.value)}
              placeholder="e.g. +1 555 123 4567"
            />
            <p className="text-xs text-[#475569]">Used for SMS notifications and escalation calls.</p>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={!isDirty || saving}
              className={btn.primary}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
            {saved && (
              <span className="text-sm text-emerald-600">Saved</span>
            )}
          </div>
        </form>
      </div>

      {/* Account info */}
      <div className={`${card.base} p-6`}>
        <h2 className="text-base font-semibold text-[#0F172A] mb-4">Account details</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#475569]">Login email</dt>
            <dd className="text-[#0F172A] font-medium">{meta.email}</dd>
          </div>
          {meta.trade_type && (
            <div className="flex justify-between">
              <dt className="text-[#475569]">Trade</dt>
              <dd className="text-[#0F172A] font-medium capitalize">{meta.trade_type}</dd>
            </div>
          )}
          {meta.country && (
            <div className="flex justify-between">
              <dt className="text-[#475569]">Country</dt>
              <dd className="text-[#0F172A] font-medium">{meta.country}</dd>
            </div>
          )}
          {meta.created_at && (
            <div className="flex justify-between">
              <dt className="text-[#475569]">Member since</dt>
              <dd className="text-[#0F172A] font-medium">
                {new Date(meta.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Sign out */}
      <div className={`${card.base} p-6`}>
        <h2 className="text-base font-semibold text-[#0F172A] mb-2">Sign out</h2>
        <p className="text-sm text-[#475569] mb-4">Sign out of your account on this device.</p>
        <Button
          variant="outline"
          onClick={() => setShowLogoutDialog(true)}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>

      {/* Logout confirmation */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out of your account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-[#C2410C] hover:bg-[#B53B0A]">
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
