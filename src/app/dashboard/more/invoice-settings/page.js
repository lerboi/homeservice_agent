'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { card, btn, heading, body } from '@/lib/design-tokens';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ImagePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_TERMS_OPTIONS = ['Net 15', 'Net 30', 'Net 45', 'Net 60'];

export default function InvoiceSettingsPage() {
  const [settings, setSettings] = useState({
    business_name: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
    license_number: '',
    tax_rate: 0,
    payment_terms: 'Net 30',
    default_notes: '',
    invoice_prefix: 'INV',
    late_fee_enabled: false,
    late_fee_type: 'flat',
    late_fee_amount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        // Get tenantId for storage uploads
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('owner_id', user.id)
            .maybeSingle();
          if (tenant) setTenantId(tenant.id);
        }

        const res = await fetch('/api/invoice-settings');
        if (!res.ok) throw new Error('Failed to load settings');
        const { settings: data } = await res.json();
        setSettings({
          business_name: data.business_name ?? '',
          address: data.address ?? '',
          phone: data.phone ?? '',
          email: data.email ?? '',
          logo_url: data.logo_url ?? '',
          license_number: data.license_number ?? '',
          tax_rate: data.tax_rate ?? 0,
          payment_terms: data.payment_terms ?? 'Net 30',
          default_notes: data.default_notes ?? '',
          invoice_prefix: data.invoice_prefix ?? 'INV',
          late_fee_enabled: data.late_fee_enabled ?? false,
          late_fee_type: data.late_fee_type ?? 'flat',
          late_fee_amount: data.late_fee_amount ?? 0,
        });
      } catch (err) {
        console.error('[invoice-settings] load error:', err);
        toast.error('Failed to load invoice settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type and size
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Logo upload failed. File must be PNG or JPG under 2MB.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo upload failed. File must be PNG or JPG under 2MB.');
      return;
    }

    setLogoFile(file);

    try {
      const ext = file.type === 'image/png' ? 'png' : 'jpg';
      const path = `${tenantId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('invoice-logos')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('invoice-logos')
        .getPublicUrl(path);

      setSettings((prev) => ({ ...prev, logo_url: urlData.publicUrl }));
      toast.success('Logo uploaded');
    } catch (err) {
      console.error('[invoice-settings] logo upload error:', err);
      toast.error('Logo upload failed. File must be PNG or JPG under 2MB.');
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...settings,
        // Convert display percentage back to decimal for storage
        tax_rate: Number(settings.tax_rate),
      };
      const res = await fetch('/api/invoice-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Save failed');
      }
      toast.success('Invoice settings saved');
    } catch (err) {
      console.error('[invoice-settings] save error:', err);
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  // Preview of invoice number format
  const currentYear = new Date().getFullYear();
  const numberPreview = `${settings.invoice_prefix || 'INV'}-${currentYear}-0001`;

  if (loading) {
    return (
      <div className="space-y-6 pb-10">
        <div>
          <h1 className={`text-xl font-semibold ${heading} mb-1`}>Invoice Settings</h1>
          <Separator className="mt-3" />
        </div>
        <div className={`${card.base} p-6 space-y-4`}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className={`${card.base} p-6 space-y-4`}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-48" />
        </div>
        <div className={`${card.base} p-6 space-y-4`}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Page header */}
      <div>
        <h1 className={`text-xl font-semibold ${heading}`}>Invoice Settings</h1>
        <Separator className="mt-3" />
      </div>

      {/* Section A: Business Identity */}
      <div className={`${card.base} p-6 space-y-5`}>
        <h2 className={`text-sm font-semibold ${heading}`}>Business Identity</h2>

        {/* Logo upload */}
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 h-24 w-24 rounded-xl border-2 border-dashed border-border bg-muted hover:bg-muted transition-colors flex items-center justify-center overflow-hidden"
            title="Upload logo"
          >
            {settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logo_url}
                alt="Business logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <ImagePlus className="h-7 w-7 text-muted-foreground" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleLogoChange}
          />
          <div className="pt-1">
            <p className={`text-sm font-medium ${heading}`}>Business Logo</p>
            <p className={`text-xs ${body} mt-0.5`}>PNG or JPG, max 2MB. Shown on invoices.</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 text-xs text-[var(--brand-accent)] hover:underline"
            >
              {settings.logo_url ? 'Change logo' : 'Upload logo'}
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={`text-sm font-medium ${heading}`} htmlFor="business_name">
              Business Name
            </label>
            <input
              id="business_name"
              type="text"
              value={settings.business_name}
              onChange={(e) => setSettings((p) => ({ ...p, business_name: e.target.value }))}
              placeholder="e.g., Smith Plumbing LLC"
              className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1"
            />
          </div>

          <div className="space-y-1.5">
            <label className={`text-sm font-medium ${heading}`} htmlFor="license_number">
              License Number
            </label>
            <input
              id="license_number"
              type="text"
              value={settings.license_number}
              onChange={(e) => setSettings((p) => ({ ...p, license_number: e.target.value }))}
              placeholder="e.g., LIC-12345"
              className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className={`text-sm font-medium ${heading}`} htmlFor="address">
              Address
            </label>
            <input
              id="address"
              type="text"
              value={settings.address}
              onChange={(e) => setSettings((p) => ({ ...p, address: e.target.value }))}
              placeholder="e.g., 123 Main St, Austin, TX 78701"
              className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1"
            />
          </div>

          <div className="space-y-1.5">
            <label className={`text-sm font-medium ${heading}`} htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={settings.phone}
              onChange={(e) => setSettings((p) => ({ ...p, phone: e.target.value }))}
              placeholder="e.g., (512) 555-0100"
              className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1"
            />
          </div>

          <div className="space-y-1.5">
            <label className={`text-sm font-medium ${heading}`} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={settings.email}
              onChange={(e) => setSettings((p) => ({ ...p, email: e.target.value }))}
              placeholder="e.g., info@smithplumbing.com"
              className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1"
            />
          </div>
        </div>
      </div>

      {/* Section B: Tax Configuration */}
      <div className={`${card.base} p-6 space-y-5`}>
        <h2 className={`text-sm font-semibold ${heading}`}>Tax Configuration</h2>

        <div className="space-y-1.5 max-w-xs">
          <label className={`text-sm font-medium ${heading}`} htmlFor="tax_rate">
            Tax Rate (%)
          </label>
          <div className="relative flex items-center">
            <input
              id="tax_rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={
                settings.tax_rate !== undefined && settings.tax_rate !== ''
                  ? Number((Number(settings.tax_rate) * 100).toFixed(4))
                  : ''
              }
              onChange={(e) => {
                const displayVal = parseFloat(e.target.value);
                const storedVal = isNaN(displayVal) ? 0 : displayVal / 100;
                setSettings((p) => ({ ...p, tax_rate: storedVal }));
              }}
              placeholder="e.g., 8.25"
              className="w-full h-9 rounded-md border border-border bg-card px-3 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1"
            />
            <span className={`absolute right-3 text-sm ${body} pointer-events-none`}>%</span>
          </div>
          <p className={`text-xs ${body}`}>Enter 0 for no tax. Applied to taxable line items only.</p>
        </div>
      </div>

      {/* Section B2: Late Fees */}
      <div className={`${card.base} p-6 space-y-5`}>
        <h2 className="text-lg font-semibold text-foreground">Late Fees</h2>

        <div className="flex items-center gap-3">
          <Switch
            checked={settings.late_fee_enabled}
            onCheckedChange={(val) => setSettings((p) => ({ ...p, late_fee_enabled: val }))}
            id="late_fee_enabled"
          />
          <label
            htmlFor="late_fee_enabled"
            className={`text-sm font-medium ${heading} cursor-pointer`}
          >
            Automatically apply late fees to overdue invoices
          </label>
        </div>

        {settings.late_fee_enabled && (
          <div className="space-y-4 pl-[44px]">
            <div className="space-y-1.5 max-w-xs">
              <label className={`text-sm font-medium ${heading}`} htmlFor="late_fee_type">
                Fee type
              </label>
              <Select
                value={settings.late_fee_type}
                onValueChange={(val) => setSettings((p) => ({ ...p, late_fee_type: val }))}
              >
                <SelectTrigger id="late_fee_type" className="w-full">
                  <SelectValue placeholder="Select fee type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat amount</SelectItem>
                  <SelectItem value="percentage">Percentage per month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 max-w-xs">
              {settings.late_fee_type === 'flat' ? (
                <>
                  <label className={`text-sm font-medium ${heading}`} htmlFor="late_fee_amount">
                    Late fee amount
                  </label>
                  <div className="relative flex items-center">
                    <span className={`absolute left-3 text-sm ${body} pointer-events-none`}>$</span>
                    <input
                      id="late_fee_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={settings.late_fee_amount || ''}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          late_fee_amount: parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="0.00"
                      className="w-full h-9 rounded-md border border-border bg-card pl-7 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1"
                    />
                  </div>
                </>
              ) : (
                <>
                  <label className={`text-sm font-medium ${heading}`} htmlFor="late_fee_amount">
                    Monthly percentage
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="late_fee_amount"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={settings.late_fee_amount || ''}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          late_fee_amount: parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="0"
                      className="w-full h-9 rounded-md border border-border bg-card px-3 pr-24 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1"
                    />
                    <span className={`absolute right-3 text-sm ${body} pointer-events-none`}>% per month</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section C: Invoice Defaults */}
      <div className={`${card.base} p-6 space-y-5`}>
        <h2 className={`text-sm font-semibold ${heading}`}>Invoice Defaults</h2>

        <div className="space-y-1.5 max-w-xs">
          <label className={`text-sm font-medium ${heading}`} htmlFor="payment_terms">
            Payment Terms
          </label>
          <Select
            value={settings.payment_terms}
            onValueChange={(val) => setSettings((p) => ({ ...p, payment_terms: val }))}
          >
            <SelectTrigger id="payment_terms" className="w-full">
              <SelectValue placeholder="Select payment terms" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_TERMS_OPTIONS.map((term) => (
                <SelectItem key={term} value={term}>
                  {term}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className={`text-sm font-medium ${heading}`} htmlFor="default_notes">
            Default Notes
          </label>
          <textarea
            id="default_notes"
            value={settings.default_notes}
            onChange={(e) => setSettings((p) => ({ ...p, default_notes: e.target.value }))}
            placeholder="e.g., Thank you for your business!"
            rows={3}
            className={`w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1`}
          />
          <p className={`text-xs ${body}`}>Appears at the bottom of every invoice. Editable per invoice.</p>
        </div>
      </div>

      {/* Section D: Numbering */}
      <div className={`${card.base} p-6 space-y-5`}>
        <h2 className={`text-sm font-semibold ${heading}`}>Numbering</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={`text-sm font-medium ${heading}`} htmlFor="invoice_prefix">
              Invoice Prefix
            </label>
            <input
              id="invoice_prefix"
              type="text"
              maxLength={10}
              value={settings.invoice_prefix}
              onChange={(e) => setSettings((p) => ({ ...p, invoice_prefix: e.target.value }))}
              placeholder="e.g., INV"
              className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1"
            />
            <p className={`text-xs ${body}`}>e.g., INV, SP, ABC — alphanumeric, max 10 characters</p>
          </div>

          <div className="space-y-1.5">
            <label className={`text-sm font-medium ${heading}`}>
              Next Invoice Number
            </label>
            <div className="h-9 rounded-md border border-border bg-muted px-3 flex items-center">
              <span className="text-sm text-muted-foreground">{numberPreview}</span>
            </div>
            <p className={`text-xs ${body}`}>Format preview — increments automatically</p>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`${btn.primary} inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg disabled:opacity-60`}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
