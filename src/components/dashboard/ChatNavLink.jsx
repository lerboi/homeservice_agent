'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function ChatNavLink({ href, label, onNavigate }) {
  return (
    <Link
      href={href}
      onClick={() => onNavigate?.()}
      className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-normal
        bg-white border border-stone-200 text-[#C2410C] hover:bg-stone-50 transition-colors
        focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1 focus:outline-none"
    >
      {label}
      <ChevronRight className="h-3 w-3" />
    </Link>
  );
}
