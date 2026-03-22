'use client';

import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';

export default function ChecklistItem({ item }) {
  const prefersReduced = useReducedMotion();

  return (
    <div className="flex items-center gap-3 py-2 min-h-[44px]">
      {/* Icon */}
      {item.complete ? (
        <motion.div
          animate={prefersReduced ? undefined : { scale: [1, 1.15, 1] }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <CheckCircle2 className="h-5 w-5 text-[#C2410C] shrink-0" aria-hidden="true" />
        </motion.div>
      ) : (
        <Circle className="h-5 w-5 text-stone-300 shrink-0" aria-hidden="true" />
      )}

      {/* Label */}
      <span className={`flex-1 text-sm ${item.complete ? 'text-[#475569]' : 'text-[#0F172A]'}`}>
        {item.label}
      </span>

      {/* Arrow link (only for non-locked, incomplete items with href) */}
      {!item.locked && !item.complete && item.href && (
        <Link
          href={item.href}
          className="flex items-center gap-1 text-sm text-[#C2410C] hover:underline"
          aria-label={`Go to Settings — ${item.label}`}
        >
          Go to Settings
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
