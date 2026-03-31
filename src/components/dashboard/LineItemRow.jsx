'use client';

import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { calculateLineTotal } from '@/lib/invoice-calculations';

const ITEM_TYPES = [
  { value: 'labor', label: 'Labor' },
  { value: 'materials', label: 'Materials' },
  { value: 'travel', label: 'Travel/Trip Charge' },
  { value: 'flat_rate', label: 'Flat Rate' },
  { value: 'discount', label: 'Discount' },
];

/**
 * Returns field visibility config for a given item type.
 * qty:     show quantity field
 * markup:  show markup % field
 * taxable: show taxable toggle
 * qtyLabel, priceLabel: field labels
 */
function getFieldConfig(type) {
  switch (type) {
    case 'labor':
      return { qty: true, qtyLabel: 'Hours', markup: false, priceLabel: 'Rate/hr', taxable: true };
    case 'materials':
      return { qty: true, qtyLabel: 'Qty', markup: true, priceLabel: 'Unit Cost', taxable: true };
    case 'travel':
      return { qty: false, qtyLabel: '', markup: false, priceLabel: 'Fee', taxable: true };
    case 'flat_rate':
      return { qty: false, qtyLabel: '', markup: false, priceLabel: 'Amount', taxable: true };
    case 'discount':
      return { qty: false, qtyLabel: '', markup: false, priceLabel: 'Amount', taxable: false };
    default:
      return { qty: true, qtyLabel: 'Qty', markup: false, priceLabel: 'Rate', taxable: true };
  }
}

/**
 * LineItemRow — a single editable line item row in the invoice editor.
 *
 * Props:
 *   item      — { item_type, description, quantity, unit_price, markup_pct, taxable, sort_order }
 *   onChange(updatedItem) — called when any field changes
 *   onRemove()            — called to remove this row
 *   index     — row number (0-based) for display
 */
export default function LineItemRow({ item, onChange, onRemove, index }) {
  const config = getFieldConfig(item.item_type);
  const lineTotal = calculateLineTotal(item.item_type, item);
  const isDiscount = item.item_type === 'discount';

  function handleTypeChange(newType) {
    const newConfig = getFieldConfig(newType);
    onChange({
      ...item,
      item_type: newType,
      quantity: 1,
      markup_pct: 0,
      // Discount type is always non-taxable; others default taxable
      taxable: newConfig.taxable,
    });
  }

  function handleField(field, rawValue) {
    const numFields = ['quantity', 'unit_price', 'markup_pct'];
    const value = numFields.includes(field)
      ? (isNaN(parseFloat(rawValue)) ? 0 : parseFloat(rawValue))
      : rawValue;
    onChange({ ...item, [field]: value });
  }

  return (
    <div className="flex flex-wrap items-start gap-2 py-3 border-b border-stone-100 last:border-b-0">
      {/* Row number */}
      <span className="text-xs text-stone-400 pt-2 w-5 shrink-0 text-right">{index + 1}</span>

      {/* Type select ~120px */}
      <div className="w-[130px] shrink-0">
        <Select value={item.item_type} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-9 text-xs w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ITEM_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description flex-1 */}
      <div className="flex-1 min-w-[120px]">
        <Input
          placeholder="Description"
          value={item.description}
          onChange={(e) => handleField('description', e.target.value)}
          className="h-9 text-sm"
        />
      </div>

      {/* Quantity (hidden for travel, flat_rate, discount) */}
      {config.qty && (
        <div className="w-20 shrink-0">
          <Label className="text-[10px] text-stone-400 block mb-1">{config.qtyLabel}</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={item.quantity}
            onChange={(e) => handleField('quantity', e.target.value)}
            className="h-9 text-sm text-right"
          />
        </div>
      )}

      {/* Unit price */}
      <div className="w-24 shrink-0">
        <Label className="text-[10px] text-stone-400 block mb-1">{config.priceLabel}</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={item.unit_price}
          onChange={(e) => handleField('unit_price', e.target.value)}
          className="h-9 text-sm text-right"
        />
      </div>

      {/* Markup % (materials only) */}
      {config.markup ? (
        <div className="w-20 shrink-0">
          <Label className="text-[10px] text-stone-400 block mb-1">Markup %</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={item.markup_pct}
            onChange={(e) => handleField('markup_pct', e.target.value)}
            className="h-9 text-sm text-right"
          />
        </div>
      ) : (
        /* Placeholder to keep layout stable when markup is hidden */
        <div className="w-20 shrink-0 hidden sm:block" aria-hidden="true" />
      )}

      {/* Taxable toggle (hidden for discount) */}
      {config.taxable ? (
        <div className="flex flex-col items-center shrink-0 w-14">
          <Label className="text-[10px] text-stone-400 mb-1">Taxable</Label>
          <Switch
            checked={item.taxable}
            onCheckedChange={(checked) => handleField('taxable', checked)}
          />
        </div>
      ) : (
        <div className="w-14 shrink-0 hidden sm:block" aria-hidden="true" />
      )}

      {/* Line total ~100px */}
      <div className="w-24 shrink-0 text-right pt-1">
        <Label className="text-[10px] text-stone-400 block mb-1">Total</Label>
        <span
          className={`text-sm font-medium ${isDiscount ? 'text-red-600' : 'text-stone-900'}`}
        >
          ${Math.abs(lineTotal).toFixed(2)}
          {isDiscount && lineTotal !== 0 ? ' (-)' : ''}
        </span>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="mt-1 p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
        aria-label="Remove line item"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
