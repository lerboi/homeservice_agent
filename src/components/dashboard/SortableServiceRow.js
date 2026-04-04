'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SortableServiceRow({
  service,
  urgencyBadgeClasses,
  onTagChange,
  onRemove,
  isSelected,
  onSelectToggle,
  t,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-4 px-4 items-center min-h-14 border-b border-stone-100 last:border-b-0 bg-white"
    >
      {/* Checkbox for bulk select */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onSelectToggle(service.id)}
        className="h-4 w-4 rounded border-stone-300 cursor-pointer"
        aria-label={`Select ${service.name}`}
      />

      {/* Drag handle */}
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="flex items-center justify-center w-11 h-11 cursor-grab active:cursor-grabbing p-1 text-stone-400 hover:text-stone-600 rounded-md hover:bg-stone-50 transition-colors"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Service name */}
      <span className="text-base text-[#0F172A]">{service.name}</span>

      {/* Urgency tag badge + Select dropdown */}
      <div className="w-36 flex items-center gap-2">
        <Badge
          className={
            urgencyBadgeClasses[service.urgency_tag] ||
            urgencyBadgeClasses.routine
          }
        >
          {service.urgency_tag === 'emergency' && t('tag_emergency')}
          {service.urgency_tag === 'routine' && t('tag_routine')}
          {service.urgency_tag === 'urgent' && t('tag_urgent')}
        </Badge>
        <Select
          value={service.urgency_tag}
          onValueChange={(value) => onTagChange(service.id, value)}
        >
          <SelectTrigger
            className="h-8 w-8 p-0 border-0 shadow-none focus:ring-0 text-stone-400"
            aria-label={`Change urgency for ${service.name}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="emergency">
              <span className="text-red-700">{t('tag_emergency')}</span>
            </SelectItem>
            <SelectItem value="routine">
              <span className="text-[#475569]">{t('tag_routine')}</span>
            </SelectItem>
            <SelectItem value="urgent">
              <span className="text-amber-700">{t('tag_urgent')}</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(service)}
        className="w-10 flex items-center justify-center h-10 rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        aria-label={`Remove ${service.name}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
