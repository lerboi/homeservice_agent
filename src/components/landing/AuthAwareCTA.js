'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, LayoutDashboard, Play } from 'lucide-react';
import { supabase } from '@/lib/supabase-browser';
import { buttonClasses } from '@/components/marketing/primitives';
import { BOOK_DEMO_HREF, WATCH_DEMO_HREF } from '@/data/site';

/**
 * The public site's call to action: "Book a demo" plus, optionally, "Watch
 * the demo". There is no self-serve signup link on public pages; a signed-in
 * visitor gets a link to their dashboard instead.
 *
 * @param {boolean} onInk     - true when placed on an ink (dark) section
 * @param {boolean} withWatch - also render the "Watch the demo" button
 */
export function AuthAwareCTA({ onInk = false, withWatch = true, size = 'lg', className = '' }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  const secondary = onInk ? 'secondaryOnInk' : 'secondary';

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {isLoggedIn ? (
        <Link href="/dashboard" className={buttonClasses({ variant: 'primary', size })}>
          <LayoutDashboard className="size-4" />
          Go to dashboard
        </Link>
      ) : (
        <Link href={BOOK_DEMO_HREF} className={buttonClasses({ variant: 'primary', size })}>
          Book a demo
          <ArrowRight className="size-4" />
        </Link>
      )}
      {withWatch && (
        <Link href={WATCH_DEMO_HREF} className={buttonClasses({ variant: secondary, size })}>
          <Play className="size-3.5" />
          Watch the demo
        </Link>
      )}
    </div>
  );
}
