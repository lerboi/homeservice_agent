'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import LineItemRow from '@/components/dashboard/LineItemRow';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';

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
 * TierEditor — Reusable tier card component for good/better/best estimate tiers.
 *
 * Props:
 *   tier       — { tier_label, line_items: [...] }
 *   onUpdate   — (updatedTier) => void
 *   onRemove   — () => void
 *   taxRate    — decimal tax rate (e.g. 0.0825)
 *   canRemove  — boolean, shows remove button when true
 */
export default function TierEditor({ tier, onUpdate, onRemove, taxRate = 0, canRemove = true }) {
  const { subtotal, tax_amount, total } = calculateInvoiceTotals(tier.line_items || [], taxRate);
  const taxRatePct = (taxRate * 100).toFixed(2).replace(/\.00$/, '');

  function handleLabelChange(e) {
    onUpdate({ ...tier, tier_label: e.target.value });
  }

  function handleLineItemChange(index, updatedItem) {
    const newItems = (tier.line_items || []).map((item, i) => (i === index ? updatedItem : item));
    onUpdate({ ...tier, line_items: newItems });
  }

  function handleLineItemRemove(index) {
    const newItems = (tier.line_items || []).filter((_, i) => i !== index);
    onUpdate({ ...tier, line_items: newItems });
  }

  function handleAddLineItem() {
    const newItems = [...(tier.line_items || []), emptyLineItem((tier.line_items || []).length)];
    onUpdate({ ...tier, line_items: newItems });
  }

  return (
    <Card className="p-4">
      <CardContent className="p-0 space-y-3">
        {/* Tier label */}
        <div className="flex items-center justify-between gap-2">
          <Input
            value={tier.tier_label || ''}
            onChange={handleLabelChange}
            placeholder="Tier name"
            className="h-9 text-base font-semibold text-stone-900 border-none shadow-none px-0 focus-visible:ring-0 max-w-[200px]"
          />
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0"
              aria-label="Remove tier"
              title="Remove tier"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <Separator />

        {/* Line items */}
        {(tier.line_items || []).length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-stone-200 rounded-lg">
            <p className="text-sm text-stone-400 mb-3">No line items yet</p>
            <Button type="button" variant="outline" size="sm" onClick={handleAddLineItem}>
              <Plus className="h-4 w-4 mr-1" />
              Add First Item
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {(tier.line_items || []).map((item, index) => (
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

        {(tier.line_items || []).length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-dashed text-stone-500 hover:text-stone-700 hover:border-stone-400"
            onClick={handleAddLineItem}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Line Item
          </Button>
        )}

        {/* Totals */}
        {(tier.line_items || []).length > 0 && (
          <div className="bg-stone-50 rounded-lg p-3 space-y-1.5">
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
              <span className="font-semibold text-stone-900 text-sm">Tier Total</span>
              <span className="font-bold text-stone-900 tabular-nums">${total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
