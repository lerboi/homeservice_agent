'use client';

import { CheckCircle2, Circle, ChevronDown, ArrowRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';

export default function ChecklistItem({ item, type, description, expanded, onToggle }) {
  const prefersReduced = useReducedMotion();

  const canExpand = !item.complete;

  return (
    <div className="border-b border-stone-100 last:border-b-0">
      <button
        onClick={() => canExpand && onToggle?.(item.id)}
        className="flex items-center gap-3 py-3 px-1 min-h-[44px] w-full text-left"
        disabled={!canExpand}
        aria-expanded={canExpand ? expanded : undefined}
      >
        {/* Checkmark or circle icon */}
        {item.complete ? (
          <CheckCircle2 className="h-5 w-5 text-[#C2410C] shrink-0" aria-hidden="true" />
        ) : (
          <Circle className="h-5 w-5 text-stone-300 shrink-0" aria-hidden="true" />
        )}

        {/* Label */}
        <span className={`flex-1 text-sm ${item.complete ? 'text-[#475569] line-through' : 'text-[#0F172A]'}`}>
          {item.label}
        </span>

        {/* Expand indicator */}
        {canExpand && (
          <ChevronDown
            className={`h-4 w-4 text-stone-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        )}
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={prefersReduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="pl-8 pb-3">
              <p className="text-sm text-[#475569] mb-3">{description}</p>
              {item.href && (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#C2410C] hover:underline"
                >
                  Set up
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
