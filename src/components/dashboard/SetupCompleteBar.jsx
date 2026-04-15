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
      className="flex items-center gap-3 py-3 px-6 rounded-2xl bg-[var(--brand-accent)]/[0.06] border border-[var(--brand-accent)]/20"
    >
      <CheckCircle2 className="h-5 w-5 text-[var(--brand-accent)] shrink-0" aria-hidden="true" />
      <span className="text-sm text-foreground flex-1">
        Setup complete! Your AI receptionist is ready.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss setup checklist"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </motion.div>
  );
}
