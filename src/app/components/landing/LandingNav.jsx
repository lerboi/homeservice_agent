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
      className={`fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6 transition-all duration-300 ${
        scrolled
          ? 'bg-landing-dark/95 backdrop-blur-md shadow-md'
          : 'bg-transparent'
      }`}
    >
      <Link href="/" className="text-white font-semibold text-lg">
        HomeService AI
      </Link>
      <Button
        asChild
        size="sm"
        className="bg-landing-accent text-white hover:bg-landing-accent/90 min-h-[44px] px-4"
      >
        <Link href="/onboarding">Start My 5-Minute Setup</Link>
      </Button>
    </nav>
  );
}
