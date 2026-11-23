'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { buttonClasses } from '@/components/marketing/primitives';
import { BOOK_DEMO_HREF, NAV_LINKS } from '@/data/site';

const LOGO_DARK = '/images/logos/VOCO%20Logo%20V1%20(no%20bg).png';
const LOGO_WHITE = '/images/logos/WHITE%20VOCO%20LOGO%20V1%20(no%20bg).png';

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // True while the bar sits over a dark hero (an element marked data-nav-ink).
  // Starts true so the home page does not flash a light bar before hydration.
  const [overInk, setOverInk] = useState(true);
  const ink = pathname === '/' && overInk;

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
      const dark = document.querySelector('[data-nav-ink]');
      setOverInk(dark ? dark.getBoundingClientRect().bottom > 56 : false);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <nav
        aria-label="Main"
        className={`fixed left-0 right-0 top-0 z-50 h-16 border-b backdrop-blur-md transition-colors duration-300 ${
          ink
            ? `bg-mk-ink/75 ${scrolled ? 'border-white/10' : 'border-transparent'}`
            : `bg-mk-paper/85 ${scrolled ? 'border-mk-line' : 'border-transparent'}`
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Voco home">
            <Image src={ink ? LOGO_WHITE : LOGO_DARK} alt="Voco" width={172} height={96} className="h-11 w-auto -ml-3" priority />
          </Link>

          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 md:flex">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={`text-sm transition-colors ${
                  ink
                    ? isActive(href) ? 'text-white' : 'text-white/60 hover:text-white'
                    : isActive(href) ? 'text-mk-ink' : 'text-mk-muted hover:text-mk-ink'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link href={BOOK_DEMO_HREF} className={buttonClasses({ variant: ink ? 'white' : 'ink', size: 'sm' })}>
              Book a demo
            </Link>

            <button
              type="button"
              className={`flex size-11 items-center justify-center md:hidden ${ink ? 'text-white' : 'text-mk-ink'}`}
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
