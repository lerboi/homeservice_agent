'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import InvoiceEditor from '@/components/dashboard/InvoiceEditor';

export default function NewInvoicePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const leadId = searchParams.get('lead_id');

  const [settings, setSettings] = useState(null);
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Always fetch invoice settings
        const settingsRes = await fetch('/api/invoice-settings');
        const settingsJson = await settingsRes.json();
        if (settingsRes.ok) {
          setSettings(settingsJson.settings || settingsJson);
        }

        // If lead_id present, fetch lead data for pre-fill
        if (leadId) {
          const leadRes = await fetch(`/api/leads/${leadId}`);
          if (leadRes.ok) {
            const { lead } = await leadRes.json();
            setInitialData({
              lead_id: lead.id,
              lead_name: lead.caller_name || '',
              customer_name: lead.caller_name || '',
              customer_phone: lead.caller_phone || '',
              customer_email: lead.caller_email || '',
              customer_address: lead.service_address || '',
              job_type: lead.service_type || '',
            });
          }
        }
      } catch (err) {
        console.error('Failed to load invoice data:', err);
        toast.error('Failed to load invoice settings');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [leadId]);

  async function createInvoice(invoiceData) {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create invoice');
    }

    const json = await res.json();
    return json.invoice || json;
  }

  async function handleSave(invoiceData) {
    setSaving(true);
    try {
      const created = await createInvoice(invoiceData);
      toast.success('Invoice saved as draft');
      router.push(`/dashboard/invoices/${created.id}`);
    } catch (err) {
      toast.error(err.message || 'Could not save invoice');
    } finally {
      setSaving(false);
    }
  }

  async function handleSend(invoiceData) {
    setSaving(true);
    try {
      // Step 1: create the invoice
      const created = await createInvoice(invoiceData);

      // Step 2: attempt to send (delivery wired in Plan 07 — no-op if not yet implemented)
      try {
        await fetch(`/api/invoices/${created.id}/send`, { method: 'POST' });
      } catch {
        // Delivery not yet wired — silently ignore (Plan 07)
      }

      toast.success('Invoice created');
      router.push(`/dashboard/invoices/${created.id}`);
    } catch (err) {
      toast.error(err.message || 'Could not create invoice');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-stone-200 rounded w-1/4" />
          <div className="h-40 bg-stone-100 rounded" />
          <div className="h-40 bg-stone-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/invoices"
          className="text-stone-500 hover:text-stone-900 transition-colors"
          aria-label="Back to invoices"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold text-stone-900">New Invoice</h1>
      </div>

      <InvoiceEditor
        initialData={initialData}
        settings={settings}
        onSave={handleSave}
        onSend={handleSend}
        saving={saving}
      />
    </div>
  );
}
