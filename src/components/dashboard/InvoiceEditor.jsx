'use client';

import { useState, useEffect } from 'react';
import { Plus, Loader2, AlertCircle, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRef, useCallback } from 'react';
import { addDays, format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import LineItemRow from '@/components/dashboard/LineItemRow';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';

const PAYMENT_TERMS_OPTIONS = [
  { value: 'Due on Receipt', days: 0 },
  { value: 'Net 15', days: 15 },
  { value: 'Net 30', days: 30 },
  { value: 'Net 45', days: 45 },
  { value: 'Net 60', days: 60 },
];

function parseTermsDays(terms) {
  if (!terms) return 30;
  if (terms === 'Due on Receipt') return 0;
  const match = terms.match(/\d+/);
  return match ? parseInt(match[0], 10) : 30;
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function dueDateFromTerms(issuedDate, terms) {
  const days = parseTermsDays(terms);
  const base = issuedDate ? new Date(issuedDate + 'T00:00:00') : new Date();
  return format(addDays(base, days), 'yyyy-MM-dd');
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

/**
 * InvoiceEditor — full invoice creation/editing form.
 *
 * Props:
 *   initialData — optional object for pre-filling (lead data or edit mode)
 *   settings    — invoice settings: { tax_rate, payment_terms, default_notes, invoice_prefix }
 *   onSave(invoiceData) — called when "Save as Draft" is clicked
 *   onSend(invoiceData) — called when "Send Invoice" is clicked
 *   saving      — boolean for button loading state
 */
export default function InvoiceEditor({ initialData, settings, onSave, onSend, saving }) {
  const defaultTerms = settings?.payment_terms || 'Net 30';
  const today = todayIso();

  const [customerName, setCustomerName] = useState(initialData?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(initialData?.customer_phone || '');
  const [customerEmail, setCustomerEmail] = useState(initialData?.customer_email || '');
  const [customerAddress, setCustomerAddress] = useState(initialData?.customer_address || '');
  const [jobType, setJobType] = useState(initialData?.job_type || '');
  const [issuedDate, setIssuedDate] = useState(today);
  const [paymentTerms, setPaymentTerms] = useState(defaultTerms);
  const [dueDate, setDueDate] = useState(dueDateFromTerms(today, defaultTerms));
  const [notes, setNotes] = useState(settings?.default_notes || '');
  const [lineItems, setLineItems] = useState([emptyLineItem(0)]);

  // Lead search state
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadResults, setLeadResults] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimerRef = useRef(null);

  // Re-apply initialData if it arrives after mount (async pre-fill from lead fetch)
  useEffect(() => {
    if (!initialData) return;
    if (initialData.customer_name !== undefined) setCustomerName(initialData.customer_name);
    if (initialData.customer_phone !== undefined) setCustomerPhone(initialData.customer_phone);
    if (initialData.customer_email !== undefined) setCustomerEmail(initialData.customer_email);
    if (initialData.customer_address !== undefined) setCustomerAddress(initialData.customer_address);
    if (initialData.job_type !== undefined) setJobType(initialData.job_type);
    if (initialData.lead_id && initialData.customer_name) {
      setSelectedLead({ id: initialData.lead_id, caller_name: initialData.lead_name || initialData.customer_name });
    }
  }, [initialData]);

  // Recalculate due date when issued date or payment terms change
  useEffect(() => {
    setDueDate(dueDateFromTerms(issuedDate, paymentTerms));
  }, [issuedDate, paymentTerms]);

  function handleTermsChange(terms) {
    setPaymentTerms(terms);
  }

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

  function handleLineItemChange(index, updatedItem) {
    setLineItems((prev) => prev.map((item, i) => (i === index ? updatedItem : item)));
  }

  function handleLineItemRemove(index) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddLineItem() {
    setLineItems((prev) => [...prev, emptyLineItem(prev.length)]);
  }

  function assembleInvoiceData() {
    return {
      lead_id: selectedLead?.id || initialData?.lead_id || null,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      customer_address: customerAddress,
      job_type: jobType,
      issued_date: issuedDate,
      due_date: dueDate,
      notes,
      payment_terms: paymentTerms,
      line_items: lineItems.map((item, i) => ({ ...item, sort_order: i })),
    };
  }

  const taxRate = settings?.tax_rate || 0;
  const { subtotal, tax_amount, total } = calculateInvoiceTotals(lineItems, taxRate);
  const taxRatePct = (taxRate * 100).toFixed(2).replace(/\.00$/, '');

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Settings nudge — shown when business identity is not configured */}
      {settings && !settings.business_name && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-900">Set up your business info</p>
            <p className="text-amber-700 text-xs mt-0.5">
              Add your business name, logo, and contact details so invoices look professional.
            </p>
          </div>
          <Link
            href="/dashboard/more/invoice-settings"
            className="text-sm font-medium text-[#C2410C] hover:underline shrink-0"
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
                <Search className="h-4 w-4 text-[#C2410C]" />
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

      {/* Dates & Payment Terms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-900">Invoice Dates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="issued-date" className="text-sm font-medium text-stone-700">Issue Date</Label>
              <Input
                id="issued-date"
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment-terms" className="text-sm font-medium text-stone-700">
                Payment Terms
              </Label>
              <Select value={paymentTerms} onValueChange={handleTermsChange}>
                <SelectTrigger id="payment-terms" className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="due-date" className="text-sm font-medium text-stone-700">Due Date</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-900">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {lineItems.length === 0 ? (
            <p className="text-sm text-stone-400 py-4 text-center">
              No line items yet. Add one below.
            </p>
          ) : (
            <div>
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

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 w-full sm:w-auto"
            onClick={handleAddLineItem}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Line Item
          </Button>

          {/* Totals */}
          {lineItems.length > 0 && (
            <div className="mt-6">
              <Separator className="mb-4" />
              <div className="flex flex-col items-end gap-1 text-sm">
                <div className="flex gap-8 w-full max-w-xs justify-between">
                  <span className="text-stone-500">Subtotal</span>
                  <span className="font-medium text-stone-900">${subtotal.toFixed(2)}</span>
                </div>
                {tax_amount > 0 && (
                  <div className="flex gap-8 w-full max-w-xs justify-between">
                    <span className="text-stone-500">Tax ({taxRatePct}%)</span>
                    <span className="font-medium text-stone-900">${tax_amount.toFixed(2)}</span>
                  </div>
                )}
                <Separator className="my-2 w-full max-w-xs" />
                <div className="flex gap-8 w-full max-w-xs justify-between">
                  <span className="font-semibold text-stone-900 text-base">Total Due</span>
                  <span className="font-semibold text-stone-900 text-base">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-900">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <Label htmlFor="invoice-notes" className="text-sm font-medium text-stone-700">
              Notes (visible to customer)
            </Label>
            <textarea
              id="invoice-notes"
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-stone-900 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 resize-none"
              placeholder="e.g. Thank you for your business!"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action bar — desktop: right-aligned, mobile: sticky bottom */}
      <div className="hidden md:flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => onSave(assembleInvoiceData())}
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save as Draft
        </Button>
        <Button
          type="button"
          disabled={saving}
          className="bg-[#C2410C] hover:bg-[#C2410C]/90 text-white"
          onClick={() => onSend(assembleInvoiceData())}
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Send Invoice
        </Button>
      </div>

      {/* Mobile sticky bottom action bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 p-4 flex gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          className="flex-1"
          onClick={() => onSave(assembleInvoiceData())}
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save as Draft
        </Button>
        <Button
          type="button"
          disabled={saving}
          className="flex-1 bg-[#C2410C] hover:bg-[#C2410C]/90 text-white"
          onClick={() => onSend(assembleInvoiceData())}
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Send Invoice
        </Button>
      </div>
    </div>
  );
}
