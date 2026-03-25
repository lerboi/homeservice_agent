'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function MoreBackButton() {
  return (
    <Link
      href="/dashboard/more"
      className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F172A] transition-colors mb-4"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>Back to More</span>
    </Link>
  );
}
