'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { buttonClasses } from '@/components/marketing/primitives';
import { BOOK_DEMO_HREF, NAV_LINKS } from '@/data/site';

const LOGO_DARK = '/images/logos/VOCO%20Logo%20V1%20(no%20bg).png';

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <nav
        aria-label="Main"
        className={`fixed left-0 right-0 top-0 z-50 h-16 border-b bg-mk-paper/85 backdrop-blur-md transition-colors duration-200 ${
          scrolled ? 'border-mk-line' : 'border-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Voco home">
            <Image src={LOGO_DARK} alt="Voco" width={172} height={96} className="h-11 w-auto -ml-3" priority />
          </Link>

          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 md:flex">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={`text-sm transition-colors ${
                  isActive(href) ? 'text-mk-ink' : 'text-mk-muted hover:text-mk-ink'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link href={BOOK_DEMO_HREF} className={buttonClasses({ variant: 'ink', size: 'sm', className: 'hidden md:inline-flex' })}>
              Book a demo
            </Link>

            <button
              type="button"
              className="flex size-11 items-center justify-center text-mk-ink md:hidden"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={drawerOpen}
            >
              {drawerOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer: CSS transitions only */}
      <div
        onClick={closeDrawer}
        className={`fixed inset-0 z-40 bg-mk-ink/40 transition-opacity duration-200 md:hidden ${
          drawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden="true"
      />
      <div
        className={`fixed bottom-0 right-0 top-0 z-50 flex w-72 flex-col border-l border-mk-line bg-mk-paper transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!drawerOpen}
      >
        <div className="flex h-16 items-center justify-between border-b border-mk-line px-5">
          <span className="font-code text-[11px] uppercase tracking-[0.16em] text-mk-muted">Menu</span>
          <button
            type="button"
            onClick={closeDrawer}
            className="flex size-9 items-center justify-center text-mk-ink"
            aria-label="Close menu"
            tabIndex={drawerOpen ? 0 : -1}
          >
            <X className="size-5" />
          </button>
        </div>

        <nav aria-label="Mobile" className="flex-1 px-3 py-4">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={closeDrawer}
              tabIndex={drawerOpen ? 0 : -1}
              className={`block rounded-lg px-3 py-3 text-[15px] font-medium ${
                isActive(href) ? 'bg-mk-ink/[0.05] text-mk-ink' : 'text-mk-muted hover:text-mk-ink'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="space-y-3 border-t border-mk-line p-4">
          <Link href={BOOK_DEMO_HREF} onClick={closeDrawer} tabIndex={drawerOpen ? 0 : -1} className={buttonClasses({ variant: 'ink', size: 'lg', className: 'w-full' })}>
            Book a demo
          </Link>
        </div>
      </div>
    </>
  );
}
