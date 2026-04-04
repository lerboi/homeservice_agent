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
  const editId = searchParams.get('edit');

  const [settings, setSettings] = useState(null);
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit mode state
  const [editInvoiceId, setEditInvoiceId] = useState(null);
  const [editLeadId, setEditLeadId] = useState(null);
  const [editHasTranscript, setEditHasTranscript] = useState(false);

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

        if (editId) {
          // Edit mode: fetch existing invoice and pre-fill
          const invoiceRes = await fetch(`/api/invoices/${editId}`);
          if (invoiceRes.ok) {
            const { invoice, line_items } = await invoiceRes.json();
            setInitialData({
              title: invoice.title || '',
              customer_name: invoice.customer_name || '',
              customer_phone: invoice.customer_phone || '',
              customer_email: invoice.customer_email || '',
              customer_address: invoice.customer_address || '',
              job_type: invoice.job_type || '',
              issued_date: invoice.issued_date || '',
              due_date: invoice.due_date || '',
              notes: invoice.notes || '',
              payment_terms: invoice.payment_terms || '',
              lead_id: invoice.lead_id || null,
              lead_name: invoice.customer_name || '',
              line_items: line_items || [],
            });
            setEditInvoiceId(editId);
            setEditLeadId(invoice.lead_id || null);
            // Use lead_id presence as proxy for transcript availability.
            // The ai-describe endpoint validates transcript availability and returns
            // a clear error if none found — no need for a separate check here.
            setEditHasTranscript(!!invoice.lead_id);
          } else {
            toast.error('Could not load invoice for editing');
          }
        } else if (leadId) {
          // Create mode: pre-fill from lead data (edit param takes precedence)
          const leadRes = await fetch(`/api/leads/${leadId}`);
          if (leadRes.ok) {
            const { lead } = await leadRes.json();
            setInitialData({
              lead_id: lead.id,
              lead_name: lead.caller_name || '',
              customer_name: lead.caller_name || '',
              customer_phone: lead.from_number || '',
              customer_email: lead.email || '',
              customer_address: lead.service_address || '',
              job_type: lead.job_type || '',
              title: lead.job_type ? lead.job_type.charAt(0).toUpperCase() + lead.job_type.slice(1) : '',
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
  }, [leadId, editId]);

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

  async function patchInvoice(id, invoiceData) {
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update invoice');
    }

    const json = await res.json();
    return json.invoice || json;
  }

  async function handleSave(invoiceData) {
    setSaving(true);
    try {
      if (editInvoiceId) {
        await patchInvoice(editInvoiceId, invoiceData);
        toast.success('Invoice updated');
        router.push(`/dashboard/invoices/${editInvoiceId}`);
      } else {
        const created = await createInvoice(invoiceData);
        toast.success('Invoice saved as draft');
        router.push(`/dashboard/invoices/${created.id}`);
      }
    } catch (err) {
      toast.error(err.message || 'Could not save invoice');
    } finally {
      setSaving(false);
    }
  }

  async function handleContinue(invoiceData) {
    setSaving(true);
    try {
      if (editInvoiceId) {
        await patchInvoice(editInvoiceId, invoiceData);
        toast.success('Invoice updated');
        router.push(`/dashboard/invoices/${editInvoiceId}`);
      } else {
        const created = await createInvoice(invoiceData);
        toast.success('Invoice saved');
        router.push(`/dashboard/invoices/${created.id}`);
      }
    } catch (err) {
      toast.error(err.message || 'Could not save invoice');
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
          href={editInvoiceId ? `/dashboard/invoices/${editInvoiceId}` : '/dashboard/invoices'}
          className="text-stone-500 hover:text-stone-900 transition-colors"
          aria-label="Back to invoices"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold text-stone-900">
          {editInvoiceId ? 'Edit Invoice' : 'New Invoice'}
        </h1>
      </div>

      <InvoiceEditor
        initialData={initialData}
        settings={settings}
        onSave={handleSave}
        onContinue={handleContinue}
        saving={saving}
        invoiceId={editInvoiceId}
        leadId={editLeadId}
        hasTranscript={editHasTranscript}
      />
    </div>
  );
}
