'use client';
import { card } from '@/lib/design-tokens';
import { UserCircle } from 'lucide-react';

export default function AccountPage() {
  return (
    <div className={`${card.base} p-6`}>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-4">Account</h1>
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <UserCircle className="h-12 w-12 text-stone-300 mb-4" />
        <p className="text-sm text-[#475569]">Account management coming soon.</p>
      </div>
    </div>
  );
}
