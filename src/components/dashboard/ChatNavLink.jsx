'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function ChatNavLink({ href, label, onNavigate }) {
  return (
    <Link
      href={href}
      onClick={() => onNavigate?.()}
      className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-normal
        bg-card border border-border text-[var(--brand-accent)] hover:bg-accent transition-colors
        focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1 focus:outline-none"
    >
      {label}
      <ChevronRight className="h-3 w-3" />
    </Link>
  );
}
