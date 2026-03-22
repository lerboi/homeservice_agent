'use client';

import { CheckCircle2, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

export default function SetupCompleteBar({ onDismiss }) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={
        prefersReduced
          ? { opacity: 0 }
          : { opacity: 0, scaleY: 0, transformOrigin: 'top' }
      }
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex items-center gap-3 py-3 px-6 rounded-2xl bg-[#C2410C]/[0.06] border border-[#C2410C]/20"
    >
      <CheckCircle2 className="h-5 w-5 text-[#C2410C] shrink-0" aria-hidden="true" />
      <span className="text-sm text-[#0F172A] flex-1">
        Setup complete! Your AI receptionist is ready.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-[#475569] hover:text-[#0F172A] transition-colors"
        aria-label="Dismiss setup checklist"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </motion.div>
  );
}
