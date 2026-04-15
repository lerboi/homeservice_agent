'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Loader2, AlertCircle, Search, X, Layers } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import LineItemRow from '@/components/dashboard/LineItemRow';
import TierEditor from '@/components/dashboard/TierEditor';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function emptyLineItem(sortOrder = 0) {
  return {
    item_type: 'labor',
    description: '',
    quantity: 1,
    unit_price: 0,
    markup_pct: 0,
    taxable: true,
    sort_order: sortOrder,
  };
}

const DEFAULT_TIER_LABELS = ['Good', 'Better', 'Best'];

export default function EstimateEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get('lead_id');
  const estimateId = searchParams.get('id');

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [jobType, setJobType] = useState('');
  const [createdDate, setCreatedDate] = useState(todayIso());
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [estimateNumber, setEstimateNumber] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);

  // Line items (single-price mode)
  const [lineItems, setLineItems] = useState([emptyLineItem(0)]);

  // Tier mode
  const [tiered, setTiered] = useState(false);
  const [tiers, setTiers] = useState([]);

  // Settings
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  // Lead search
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadResults, setLeadResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimerRef = useRef(null);

  // Load settings
  useEffect(() => {
    fetch('/api/invoice-settings')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setSettings(data); })
      .catch(() => {});
  }, []);

  // Pre-fill from lead_id
  useEffect(() => {
    if (!leadId) return;
    fetch(`/api/leads/${leadId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((lead) => {
        if (!lead) return;
        setCustomerName(lead.caller_name || '');
        setCustomerPhone(lead.from_number || '');
        setCustomerEmail(lead.caller_email || '');
        setCustomerAddress(lead.service_address || '');
        setJobType(lead.job_type || '');
        setSelectedLead({ id: lead.id, caller_name: lead.caller_name });
      })
      .catch(() => {});
  }, [leadId]);

  // Edit mode: load existing estimate
  useEffect(() => {
    if (!estimateId) return;
    fetch(`/api/estimates/${estimateId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const est = data.estimate || data;
        setEstimateNumber(est.estimate_number || '');
        setCustomerName(est.customer_name || '');
        setCustomerPhone(est.customer_phone || '');
        setCustomerEmail(est.customer_email || '');
        setCustomerAddress(est.customer_address || '');
        setJobType(est.job_type || '');
        setCreatedDate(est.created_date || todayIso());
        setValidUntil(est.valid_until || '');
        setNotes(est.notes || '');
        if (est.lead_id) {
          setSelectedLead({ id: est.lead_id, caller_name: est.customer_name });
        }

        // Check if tiered
        const estTiers = data.tiers || est.tiers || [];
        if (estTiers.length > 0) {
          setTiered(true);
          setTiers(estTiers.map((t) => ({
            tier_label: t.tier_label,
            line_items: t.line_items || [],
          })));
          setLineItems([]);
        } else {
          setLineItems(data.line_items || est.line_items || [emptyLineItem(0)]);
        }
      })
      .catch(() => {
        toast.error('Could not load estimate');
      });
  }, [estimateId]);

  // Lead search with debounce
  const handleLeadSearch = useCallback((query) => {
    setLeadSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query || query.length < 2) {
      setLeadResults([]);
      setSearchOpen(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/leads?search=${encodeURIComponent(query)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setLeadResults(data.leads || []);
          setSearchOpen(true);
        }
      } catch {} finally {
        setSearchLoading(false);
      }
    }, 300);
  }, []);

  function handleSelectLead(lead) {
    setSelectedLead(lead);
    setCustomerName(lead.caller_name || '');
    setCustomerPhone(lead.from_number || '');
    setCustomerEmail(lead.caller_email || '');
    setCustomerAddress(lead.service_address || '');
    setJobType(lead.job_type || '');
    setLeadSearchQuery('');
    setLeadResults([]);
    setSearchOpen(false);
  }

  function handleUnlinkLead() {
    setSelectedLead(null);
  }

  // Line item handlers (single-price mode)
  function handleLineItemChange(index, updatedItem) {
    setLineItems((prev) => prev.map((item, i) => (i === index ? updatedItem : item)));
  }

  function handleLineItemRemove(index) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddLineItem() {
    setLineItems((prev) => [...prev, emptyLineItem(prev.length)]);
  }

  // Tier management
  function handleAddTier() {
    if (!tiered) {
      // Transition to tiered mode: current line items become first tier
      const firstTier = {
        tier_label: DEFAULT_TIER_LABELS[0],
        line_items: lineItems.length > 0 ? [...lineItems] : [emptyLineItem(0)],
      };
      const secondTier = {
        tier_label: DEFAULT_TIER_LABELS[1],
        line_items: [emptyLineItem(0)],
      };
      setTiers([firstTier, secondTier]);
      setTiered(true);
      setLineItems([]);
    } else if (tiers.length < 3) {
      // Add another tier (max 3)
      const nextLabel = DEFAULT_TIER_LABELS[tiers.length] || `Tier ${tiers.length + 1}`;
      setTiers((prev) => [...prev, { tier_label: nextLabel, line_items: [emptyLineItem(0)] }]);
    }
  }

  function handleTierUpdate(index, updatedTier) {
    setTiers((prev) => prev.map((t, i) => (i === index ? updatedTier : t)));
  }

  function handleTierRemove(index) {
    const remaining = tiers.filter((_, i) => i !== index);
    if (remaining.length <= 1) {
      // Revert to single-price mode with remaining tier's line items
      const lastTier = remaining[0];
      setLineItems(lastTier ? lastTier.line_items : [emptyLineItem(0)]);
      setTiers([]);
      setTiered(false);
    } else {
      setTiers(remaining);
    }
  }

  // Calculate totals for single-price mode
  const taxRate = settings?.tax_rate || 0;
  const { subtotal, tax_amount, total } = calculateInvoiceTotals(lineItems, taxRate);
  const taxRatePct = (taxRate * 100).toFixed(2).replace(/\.00$/, '');

  // Assemble estimate data for save
  function assembleEstimateData(status) {
    const base = {
      lead_id: selectedLead?.id || null,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      customer_address: customerAddress,
      job_type: jobType,
      created_date: createdDate,
      valid_until: validUntil || null,
      notes,
      status,
    };

    if (tiered) {
      // Calculate totals per tier
      const tiersWithTotals = tiers.map((t) => {
        const tierTotals = calculateInvoiceTotals(t.line_items || [], taxRate);
        return {
          tier_label: t.tier_label,
          line_items: (t.line_items || []).map((item, i) => ({ ...item, sort_order: i })),
          subtotal: tierTotals.subtotal,
          tax_amount: tierTotals.tax_amount,
          total: tierTotals.total,
        };
      });
      return { ...base, tiers: tiersWithTotals, line_items: [] };
    } else {
      return {
        ...base,
        line_items: lineItems.map((item, i) => ({ ...item, sort_order: i })),
        subtotal,
        tax_amount,
        total,
        tiers: [],
      };
    }
  }

  async function handleSave(status) {
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    setSaving(true);
    try {
      const data = assembleEstimateData(status);
      const method = estimateId ? 'PATCH' : 'POST';
      const url = estimateId ? `/api/estimates/${estimateId}` : '/api/estimates';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save estimate');
      }
      const result = await res.json();
      const id = result.id || result.estimate?.id || estimateId;
      toast.success(status === 'sent' ? 'Estimate sent' : 'Estimate saved');
      router.push(`/dashboard/estimates/${id}`);
    } catch (err) {
      toast.error(err.message || "Estimate couldn't be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 md:pb-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-stone-900">
          {estimateId ? 'Edit Estimate' : 'New Estimate'}
        </h1>
        {estimateNumber && (
          <p className="text-sm text-stone-500 mt-1">Estimate #{estimateNumber}</p>
        )}
        {!estimateNumber && !estimateId && (
          <p className="text-sm text-stone-500 mt-1">Estimate # (Auto)</p>
        )}
      </div>

      {/* Settings nudge */}
      {settings && !settings.business_name && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-900">Set up your business info</p>
            <p className="text-amber-700 text-xs mt-0.5">
              Add your business name, logo, and contact details so estimates look professional.
            </p>
          </div>
          <Link
            href="/dashboard/more/invoice-settings"
            className="text-sm font-medium text-[var(--brand-accent)] hover:underline shrink-0"
          >
            Go to Settings
          </Link>
        </div>
      )}

      {/* Customer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-900">Customer Information</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Lead search / link */}
          <div className="mb-4">
            {selectedLead ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                <Search className="h-4 w-4 text-[var(--brand-accent)]" />
                <span className="text-stone-700">
                  Linked to: <span className="font-medium text-stone-900">{selectedLead.caller_name}</span>
                </span>
                <button
                  type="button"
                  onClick={handleUnlinkLead}
                  className="ml-auto p-0.5 text-stone-400 hover:text-stone-600 rounded"
                  aria-label="Unlink lead"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Label className="text-sm font-medium text-stone-700 mb-1 block">
                  Link to Lead <span className="text-stone-400 font-normal">(optional)</span>
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <Input
                    placeholder="Search leads by name or phone..."
                    value={leadSearchQuery}
                    onChange={(e) => handleLeadSearch(e.target.value)}
                    onFocus={() => { if (leadResults.length) setSearchOpen(true); }}
                    onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                    className="pl-9"
                  />
                  {searchLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-stone-400" />
                  )}
                </div>
                {searchOpen && leadResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {leadResults.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-stone-50 text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectLead(lead)}
                      >
                        <div>
                          <span className="font-medium text-stone-900">{lead.caller_name || 'Unknown'}</span>
                          <span className="text-stone-500 ml-2">{lead.from_number}</span>
                        </div>
                        {lead.job_type && (
                          <span className="text-xs text-stone-400">{lead.job_type}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {searchOpen && leadResults.length === 0 && leadSearchQuery.length >= 2 && !searchLoading && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg p-3 text-sm text-stone-500">
                    No leads found
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator className="mb-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="customer-name" className="text-sm font-medium text-stone-700">
                Customer Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="customer-name"
                placeholder="Full name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="customer-email" className="text-sm font-medium text-stone-700">Email</Label>
              <Input
                id="customer-email"
                type="email"
                placeholder="customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="customer-phone" className="text-sm font-medium text-stone-700">Phone</Label>
              <Input
                id="customer-phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="job-type" className="text-sm font-medium text-stone-700">Job Type</Label>
              <Input
                id="job-type"
                placeholder="e.g. HVAC Repair, Plumbing"
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="customer-address" className="text-sm font-medium text-stone-700">
                Service Address
              </Label>
              <Input
                id="customer-address"
                placeholder="123 Main St, City, State 12345"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-900">Estimate Dates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="created-date" className="text-sm font-medium text-stone-700">Created Date</Label>
              <Input
                id="created-date"
                type="date"
                value={createdDate}
                onChange={(e) => setCreatedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="valid-until" className="text-sm font-medium text-stone-700">
                Valid Until <span className="text-stone-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="valid-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items / Tiers */}
      {!tiered ? (
        /* Single-price mode */
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-stone-900">Line Items</CardTitle>
            <span className="text-xs text-stone-400">
              {lineItems.length} item{lineItems.length !== 1 ? 's' : ''}
            </span>
          </CardHeader>
          <CardContent className="pt-0">
            {lineItems.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-stone-200 rounded-lg">
                <p className="text-sm text-stone-400 mb-3">No line items yet</p>
                <Button type="button" variant="outline" size="sm" onClick={handleAddLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {lineItems.map((item, index) => (
                  <LineItemRow
                    key={index}
                    item={item}
                    index={index}
                    onChange={(updated) => handleLineItemChange(index, updated)}
                    onRemove={() => handleLineItemRemove(index)}
                  />
                ))}
              </div>
            )}

            {lineItems.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 w-full border-dashed text-stone-500 hover:text-stone-700 hover:border-stone-400"
                onClick={handleAddLineItem}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Line Item
              </Button>
            )}

            {/* Totals */}
            {lineItems.length > 0 && (
              <div className="mt-5 ml-auto max-w-xs">
                <div className="bg-stone-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Subtotal</span>
                    <span className="font-medium text-stone-700 tabular-nums">${subtotal.toFixed(2)}</span>
                  </div>
                  {tax_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Tax ({taxRatePct}%)</span>
                      <span className="font-medium text-stone-700 tabular-nums">${tax_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between pt-1">
                    <span className="font-semibold text-stone-900">Estimated Total</span>
                    <span className="font-bold text-lg text-stone-900 tabular-nums">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Add Tier button */}
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-stone-600 hover:text-stone-800"
                onClick={handleAddTier}
              >
                <Layers className="h-4 w-4 mr-1" />
                Add Tier
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Tiered mode */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-900">Estimate Tiers</h2>
            {tiers.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-stone-600 hover:text-stone-800"
                onClick={handleAddTier}
              >
                <Layers className="h-4 w-4 mr-1" />
                Add Tier
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {tiers.map((tier, index) => (
              <TierEditor
                key={index}
                tier={tier}
                onUpdate={(updated) => handleTierUpdate(index, updated)}
                onRemove={() => handleTierRemove(index)}
                taxRate={taxRate}
                canRemove={tiers.length > 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-900">Notes & Terms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <Label htmlFor="estimate-notes" className="text-sm font-medium text-stone-700">
              Notes (visible to customer)
            </Label>
            <textarea
              id="estimate-notes"
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-stone-900 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 resize-none"
              placeholder="e.g. This estimate is valid for 30 days."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action bar — desktop */}
      <div className="hidden md:flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => handleSave('draft')}
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save as Draft
        </Button>
        <Button
          type="button"
          disabled={saving}
          className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white"
          onClick={() => handleSave('sent')}
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Send Estimate
        </Button>
      </div>

      {/* Mobile sticky bottom action bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 p-4 flex gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          className="flex-1"
          onClick={() => handleSave('draft')}
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save as Draft
        </Button>
        <Button
          type="button"
          disabled={saving}
          className="flex-1 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-white"
          onClick={() => handleSave('sent')}
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Send Estimate
        </Button>
      </div>
    </div>
  );
}
