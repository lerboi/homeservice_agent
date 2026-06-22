'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, ArrowRight, AlertTriangle, Copy, Check } from 'lucide-react';
import { card } from '@/lib/design-tokens';
import { formatInternational } from '@/lib/phone/normalize';

export default function AiNumberBanner() {
  const [phone, setPhone] = useState(null);
  const [provisioningFailed, setProvisioningFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setPhone(data?.phone_number || null);
        setProvisioningFailed(data?.provisioning_failed === true);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCopy(e) {
    // The banner is a Link — keep the copy click from navigating.
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context) — the number is selectable text.
    }
  }

  if (!loaded) return null;

  // Provisioning failed and no number assigned — the customer paid and must
  // not be left staring at a silently numberless dashboard.
  if (!phone && provisioningFailed) {
    return (
      <div
        className={`${card.base} flex items-center gap-4 p-4 border-amber-300/60 bg-amber-50 dark:bg-amber-950/30`}
        role="alert"
      >
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
        >
          <AlertTriangle className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground leading-tight">
            We hit a snag assigning your AI number
          </p>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
            Our team has been notified and is on it — you don&apos;t need to do
            anything. Questions?{' '}
            <Link href="/contact?type=support" className="underline">
              Contact support
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  if (!phone) return null;

  return (
    <Link
      href="/dashboard/more/account"
      className={`${card.base} ${card.hover} flex items-center gap-4 p-4 transition-colors`}
      aria-label="Your AI receptionist number — manage in Account"
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]"
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

      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy number to clipboard'}
        className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        {copied ? (
          <Check className="size-4 text-emerald-600" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
      </button>

      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
