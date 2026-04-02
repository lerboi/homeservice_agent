'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase-browser';

const NAV_LINKS = [
  { href: '/', label: 'Home', exact: true },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const pathname = usePathname();

  const isActive = (href, exact) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
  }, []);

  return (
    <>
      <nav
        aria-label="Navigation"
        className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-500 ease-in-out border-b border-white/[0.06] ${
          scrolled
            ? 'bg-[#090807]/90 shadow-[0_1px_0_0_rgba(255,255,255,0.04),0_4px_24px_0_rgba(0,0,0,0.4)]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto h-16 flex items-center justify-between px-6">

          {/* Logo */}
          <Link href="/" className="flex items-center group shrink-0">
            <Image
              src="/images/logos/WHITE%20VOCO%20LOGO%20V1%20(no%20bg).png"
              alt="Voco"
              width={140}
              height={44}
              className="h-8 md:h-14 w-auto"
              priority
            />
          </Link>

          {/* Desktop center links */}
          <div className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            {NAV_LINKS.map(({ href, label, exact }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm transition-colors relative pb-1 ${
                  isActive(href, exact) ? 'text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                {label}
                {isActive(href, exact) && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F97316]" />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {hasSession ? (
              <Button
                asChild
                size="sm"
                className="hidden md:inline-flex bg-[#F97316] text-white hover:bg-[#F97316]/90 shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] min-h-[36px] px-4 text-[13px] font-medium rounded-lg transition-all hover:shadow-[0_2px_8px_0_rgba(249,115,22,0.4)]"
              >
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                {/* Sign in (desktop) */}
                <Link
                  href="/auth/signin"
                  className="hidden md:inline-flex text-[13px] font-medium text-white/60 hover:text-white transition-colors"
                >
                  Sign in
                </Link>

                {/* CTA (desktop) */}
                <Button
                  asChild
                  size="sm"
                  className="hidden md:inline-flex bg-[#F97316] text-white hover:bg-[#F97316]/90 shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] min-h-[36px] px-4 text-[13px] font-medium rounded-lg transition-all hover:shadow-[0_2px_8px_0_rgba(249,115,22,0.4)]"
                >
                  <Link href="/pricing">Start My 5-Minute Setup</Link>
                </Button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center size-10 min-h-[44px] min-w-[44px] text-white/70 hover:text-white transition-colors"
              onClick={() => setDrawerOpen(v => !v)}
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={drawerOpen}
            >
              {drawerOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer — CSS transitions only, no Framer Motion */}

      {/* Backdrop */}
      <div
        onClick={() => setDrawerOpen(false)}
        className={`md:hidden fixed inset-0 z-40 bg-black/70 transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={`md:hidden fixed top-0 right-0 bottom-0 z-50 w-72 bg-[#0D0D0D] flex flex-col
          transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/[0.06]">
          <Link href="/" onClick={() => setDrawerOpen(false)}>
            <Image
              src="/images/logos/WHITE%20VOCO%20LOGO%20V1%20(no%20bg).png"
              alt="Voco"
              width={100}
              height={32}
              className="h-8"
              style={{ width: 'auto', height: 'auto' }}
            />
          </Link>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex items-center justify-center size-9 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Close menu"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_LINKS.map(({ href, label, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-colors ${
                  active
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {active && (
                  <span className="w-1 h-4 rounded-full bg-[#F97316] shrink-0" aria-hidden="true" />
                )}
                {label}
              </Link>
            );
          })}
        </nav>

        {/* CTA + Sign in */}
        <div className="p-4 border-t border-white/[0.06] space-y-3">
          {hasSession ? (
            <Link
              href="/dashboard"
              className="flex items-center justify-center w-full min-h-[48px] bg-[#F97316] hover:bg-[#F97316]/90 active:bg-[#EA6C10] text-white font-semibold rounded-xl text-[15px] transition-colors shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)]"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/pricing"
                className="flex items-center justify-center w-full min-h-[48px] bg-[#F97316] hover:bg-[#F97316]/90 active:bg-[#EA6C10] text-white font-semibold rounded-xl text-[15px] transition-colors shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)]"
              >
                Start My 5-Minute Setup
              </Link>
              <Link
                href="/auth/signin"
                className="flex items-center justify-center w-full min-h-[44px] text-[14px] font-medium text-white/50 hover:text-white transition-colors"
              >
                Already have an account? Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
