'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase-browser';

export function AuthAwareCTA({ variant = 'hero' }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  const isHero = variant === 'hero';

  if (isLoggedIn) {
    return (
      <Button
        asChild
        size="lg"
        className={
          isHero
            ? 'bg-[#F97316] text-white hover:bg-[#F97316]/90 min-h-[48px] px-6 text-[15px] font-medium rounded-xl shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_4px_16px_0_rgba(249,115,22,0.4)] hover:-translate-y-0.5 group'
            : 'bg-[#F97316] text-white hover:bg-[#F97316]/90 min-h-[52px] px-8 text-base font-medium rounded-xl shadow-[0_4px_12px_0_rgba(0,0,0,0.3)] transition-all hover:shadow-[0_8px_24px_0_rgba(249,115,22,0.4)] hover:-translate-y-0.5 group'
        }
      >
        <Link href="/dashboard">
          <LayoutDashboard className="mr-2 size-4" />
          Go to Dashboard
        </Link>
      </Button>
    );
  }

  return (
    <Button
      asChild
      size="lg"
      className={
        isHero
          ? 'bg-[#F97316] text-white hover:bg-[#F97316]/90 min-h-[48px] px-6 text-[15px] font-medium rounded-xl shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_4px_16px_0_rgba(249,115,22,0.4)] hover:-translate-y-0.5 group'
          : 'bg-[#F97316] text-white hover:bg-[#F97316]/90 min-h-[52px] px-8 text-base font-medium rounded-xl shadow-[0_4px_12px_0_rgba(0,0,0,0.3)] transition-all hover:shadow-[0_8px_24px_0_rgba(249,115,22,0.4)] hover:-translate-y-0.5 group'
      }
    >
      <Link href="/pricing">
        Start My 5-Minute Setup
        <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Button>
  );
}
