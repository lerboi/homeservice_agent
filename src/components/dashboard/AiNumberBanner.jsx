'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, ArrowRight } from 'lucide-react';
import { card } from '@/lib/design-tokens';
import { formatInternational } from '@/lib/phone/normalize';

export default function AiNumberBanner() {
  const [phone, setPhone] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setPhone(data?.phone_number || null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !phone) return null;

  return (
    <Link
      href="/dashboard/more/account"
      className={`${card.base} ${card.hover} flex items-center gap-4 p-4 transition-colors`}
      aria-label="Your AI receptionist number — manage in Account"
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]"
      >
        <Phone className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground leading-tight">
          Your AI receptionist number
        </p>
        <p className="font-mono text-base sm:text-lg tabular-nums text-foreground truncate">
          {formatInternational(phone)}
        </p>
        <p className="text-xs text-muted-foreground leading-tight mt-0.5">
          Forward your business line here so customers reach your AI.
        </p>
      </div>

      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
