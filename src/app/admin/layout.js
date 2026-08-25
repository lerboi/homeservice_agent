'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const TABS = [
  { label: 'Phone Inventory', href: '/admin/inventory' },
  { label: 'Tenants', href: '/admin/tenants' },
  { label: 'Test Agent', href: '/admin/test-agent' },
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
      {/* Header — single row on desktop; on mobile the tab bar drops to its own
          horizontally-scrollable row so all tabs stay reachable by thumb. */}
      <header className="sticky top-0 z-30 bg-[#0F1F3D]">
        <div className="flex items-center h-12 sm:h-14 px-4 sm:px-6">
          {/* Logo + ADMIN badge */}
          <div className="flex items-center shrink-0">
            <span className="text-white text-lg font-bold">Voco</span>
            <span className="ml-2 bg-[#1D4ED8] text-white text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-sm">
              ADMIN
            </span>
          </div>

          {/* Tab navigation — desktop (inline) */}
          <nav className="hidden sm:flex items-center ml-8 gap-1 flex-1">
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

          <div className="flex-1 sm:hidden" />

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="text-white/65 hover:text-white text-sm font-medium transition-colors ml-4 shrink-0 min-h-[44px] sm:min-h-0 flex items-center"
          >
            Sign Out
          </button>
        </div>

        {/* Tab navigation — mobile (own scrollable row) */}
        <nav className="sm:hidden flex items-center gap-1 px-2 overflow-x-auto border-t border-white/10 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  'px-3 h-11 flex items-center text-sm font-medium whitespace-nowrap transition-colors',
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
      </header>

      {/* Page content */}
      <main>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
