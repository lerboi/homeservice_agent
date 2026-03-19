'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#0F172A]/95 backdrop-blur-xl shadow-[0_1px_0_0_rgba(255,255,255,0.06)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto h-16 flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="size-8 rounded-lg bg-gradient-to-br from-[#C2410C] to-[#9A3412] flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 16 16" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 2v6M4 6l4-4 4 4M3 10h10M5 14h6" />
            </svg>
          </div>
          <span className="text-white font-semibold text-[15px] tracking-tight">
            HomeService AI
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6">
            <a href="#how-it-works" className="text-sm text-white/60 hover:text-white transition-colors">
              How it works
            </a>
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">
              Features
            </a>
          </div>
          <Button
            asChild
            size="sm"
            className="bg-[#C2410C] text-white hover:bg-[#C2410C]/90 shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] min-h-[36px] px-4 text-[13px] font-medium rounded-lg transition-all hover:shadow-[0_2px_8px_0_rgba(194,65,12,0.4)]"
          >
            <Link href="/onboarding">Start My 5-Minute Setup</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
