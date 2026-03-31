'use client';

import { Trash2, GripVertical } from 'lucide-react';
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
  { value: 'labor', label: 'Labor', icon: '🔧' },
  { value: 'materials', label: 'Materials', icon: '📦' },
  { value: 'travel', label: 'Travel/Trip Charge', icon: '🚗' },
  { value: 'flat_rate', label: 'Flat Rate', icon: '💲' },
  { value: 'discount', label: 'Discount', icon: '🏷️' },
];

const TYPE_COLORS = {
  labor: 'border-l-blue-400 bg-blue-50/30',
  materials: 'border-l-amber-400 bg-amber-50/30',
  travel: 'border-l-emerald-400 bg-emerald-50/30',
  flat_rate: 'border-l-purple-400 bg-purple-50/30',
  discount: 'border-l-red-400 bg-red-50/30',
};

/**
 * Returns field visibility config for a given item type.
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
 * LineItemRow — a single editable line item card in the invoice editor.
 */
export default function LineItemRow({ item, onChange, onRemove, index }) {
  const config = getFieldConfig(item.item_type);
  const lineTotal = calculateLineTotal(item.item_type, item);
  const isDiscount = item.item_type === 'discount';
  const colorClass = TYPE_COLORS[item.item_type] || 'border-l-stone-300';

  function handleTypeChange(newType) {
    const newConfig = getFieldConfig(newType);
    onChange({
      ...item,
      item_type: newType,
      quantity: 1,
      markup_pct: 0,
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
    <div className={`rounded-lg border border-stone-200 border-l-4 ${colorClass} p-3 sm:p-4 transition-all hover:shadow-sm`}>
      {/* Top row: type + description + remove */}
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="flex items-center gap-2 pt-0.5 shrink-0">
          <GripVertical className="h-4 w-4 text-stone-300 hidden sm:block" />
          <span className="text-xs font-medium text-stone-400 w-5 text-center">{index + 1}</span>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Type + Description row */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="w-full sm:w-[150px] shrink-0">
              <Select value={item.item_type} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      <span className="mr-1.5">{t.icon}</span>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Description (e.g., Kitchen faucet replacement)"
              value={item.description}
              onChange={(e) => handleField('description', e.target.value)}
              className="h-9 text-sm flex-1"
            />
          </div>

          {/* Numbers row: qty, rate, markup, taxable, total */}
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            {config.qty && (
              <div className="w-[72px]">
                <Label className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1">{config.qtyLabel}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.quantity}
                  onChange={(e) => handleField('quantity', e.target.value)}
                  className="h-9 text-sm text-right tabular-nums"
                />
              </div>
            )}

            <div className="w-[90px]">
              <Label className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1">{config.priceLabel}</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.unit_price}
                  onChange={(e) => handleField('unit_price', e.target.value)}
                  className="h-9 text-sm text-right pl-6 tabular-nums"
                />
              </div>
            </div>

            {config.markup && (
              <div className="w-[72px]">
                <Label className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1">Markup</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.markup_pct}
                    onChange={(e) => handleField('markup_pct', e.target.value)}
                    className="h-9 text-sm text-right pr-6 tabular-nums"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">%</span>
                </div>
              </div>
            )}

            {config.taxable && (
              <div className="flex items-center gap-1.5 pb-0.5">
                <Switch
                  checked={item.taxable}
                  onCheckedChange={(checked) => handleField('taxable', checked)}
                  className="scale-90"
                />
                <Label className="text-[10px] text-stone-400 uppercase tracking-wider cursor-pointer">Tax</Label>
              </div>
            )}

            {/* Spacer pushes total to the right */}
            <div className="flex-1" />

            {/* Line total */}
            <div className="text-right min-w-[80px]">
              <Label className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1">Total</Label>
              <p className={`text-sm font-semibold tabular-nums ${isDiscount ? 'text-red-600' : 'text-stone-900'}`}>
                {isDiscount && lineTotal !== 0 ? '-' : ''}${Math.abs(lineTotal).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0"
          aria-label="Remove line item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
