'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const TABS = [
  { label: 'Phone Inventory', href: '/admin/inventory' },
  { label: 'Tenants', href: '/admin/tenants' },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    await supabase.auth.signOut();
    router.push('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0F1F3D] h-14 flex items-center px-6">
        {/* Logo + ADMIN badge */}
        <div className="flex items-center shrink-0">
          <span className="text-white text-lg font-bold">Voco</span>
          <span className="ml-2 bg-[#1D4ED8] text-white text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-sm">
            ADMIN
          </span>
        </div>

        {/* Tab navigation */}
        <nav className="flex items-center ml-8 gap-1 flex-1">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  'px-4 h-14 flex items-center text-sm font-medium transition-colors',
                  isActive
                    ? 'text-white border-b-2 border-[#1D4ED8]'
                    : 'text-white/65 hover:text-white border-b-2 border-transparent',
                ].join(' ')}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="text-white/65 hover:text-white text-sm font-medium transition-colors ml-4 shrink-0"
        >
          Sign Out
        </button>
      </header>

      {/* Page content */}
      <main>
        <div className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
