'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <>
      <nav
        aria-label="Navigation"
        className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-500 ease-in-out border-b border-white/[0.06] ${
          scrolled
            ? 'bg-[#0F172A]/95 backdrop-blur-[12px]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto h-16 flex items-center justify-between px-6">
          <Link href="/" className="flex items-center group">
            <Image
              src="/images/logos/WHITE%20VOCO%20LOGO%20V1%20(no%20bg).png"
              alt="Voco"
              width={100}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </Link>

          <div className="flex items-center gap-3">
            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-6">
              <Link href="/pricing" className={`text-sm transition-colors relative pb-1 ${isActive('/pricing') ? 'text-white' : 'text-white/60 hover:text-white'}`}>
                Pricing
                {isActive('/pricing') && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C2410C]" />
                )}
              </Link>
              <Link href="/about" className={`text-sm transition-colors relative pb-1 ${isActive('/about') ? 'text-white' : 'text-white/60 hover:text-white'}`}>
                About
                {isActive('/about') && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C2410C]" />
                )}
              </Link>
              <Link href="/contact" className={`text-sm transition-colors relative pb-1 ${isActive('/contact') ? 'text-white' : 'text-white/60 hover:text-white'}`}>
                Contact
                {isActive('/contact') && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C2410C]" />
                )}
              </Link>
            </div>

            {/* CTA button (desktop) */}
            <Button
              asChild
              size="sm"
              className="hidden md:inline-flex bg-[#C2410C] text-white hover:bg-[#C2410C]/90 shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] min-h-[36px] px-4 text-[13px] font-medium rounded-lg transition-all hover:shadow-[0_2px_8px_0_rgba(194,65,12,0.4)]"
            >
              <Link href="/onboarding">Start My 5-Minute Setup</Link>
            </Button>

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

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-[#0F172A]/80 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            {/* Drawer panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className="fixed top-0 right-0 bottom-0 z-50 w-[280px] bg-[#1E293B] border-l border-white/[0.06] md:hidden flex flex-col"
            >
              {/* Close button */}
              <div className="h-16 flex items-center justify-end px-6">
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center justify-center size-10 min-h-[44px] min-w-[44px] text-white/70 hover:text-white transition-colors"
                  aria-label="Close menu"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Nav links */}
              <div className="flex-1 flex flex-col gap-1 px-6">
                <Link href="/pricing" className={`block py-3 text-[15px] transition-colors ${isActive('/pricing') ? 'text-[#C2410C]' : 'text-white/60 hover:text-white'}`}>
                  Pricing
                </Link>
                <Link href="/about" className={`block py-3 text-[15px] transition-colors ${isActive('/about') ? 'text-[#C2410C]' : 'text-white/60 hover:text-white'}`}>
                  About
                </Link>
                <Link href="/contact" className={`block py-3 text-[15px] transition-colors ${isActive('/contact') ? 'text-[#C2410C]' : 'text-white/60 hover:text-white'}`}>
                  Contact
                </Link>
              </div>

              {/* CTA pinned to bottom */}
              <div className="p-6 border-t border-white/[0.06]">
                <Button
                  asChild
                  className="w-full bg-[#C2410C] text-white hover:bg-[#C2410C]/90 min-h-[44px] font-medium rounded-lg"
                >
                  <Link href="/onboarding">Start My 5-Minute Setup</Link>
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
