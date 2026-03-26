'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';

export default function ImpersonationBanner({ tenantName }) {
  return (
    <div className="sticky top-0 z-40 h-11 bg-amber-50 border-b border-amber-300 flex items-center justify-between px-4 lg:px-8">
      <div className="flex items-center gap-2 text-sm text-amber-800">
        <Eye className="h-4 w-4" />
        <span>
          Viewing as: <strong>{tenantName}</strong> (read-only)
        </span>
      </div>
      <Link
        href="/admin/tenants"
        className="text-sm font-medium border border-amber-400 text-amber-800 px-3 py-1 rounded-md hover:bg-amber-100 transition-colors"
      >
        Exit Impersonation
      </Link>
    </div>
  );
}
