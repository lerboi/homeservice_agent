'use client';
// Client component: the copyright year reads the current time, which a
// prerendered Server Component may not do under cacheComponents.
import Link from 'next/link';
import Image from 'next/image';
import { HEADLINE } from '@/data/site';

const COLUMNS = [
  {
    title: 'Products',
    links: [
      { href: '/voice', label: 'Voco Voice' },
      { href: '/agent', label: 'Voco Agent' },
      { href: '/demo', label: 'Watch the demo' },
    ],
  },
  {
    title: 'Explore',
    links: [
      { href: '/use-cases', label: 'Use cases' },
      { href: '/integrations', label: 'Integrations' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: '/contact?type=support', label: 'Support' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="bg-mk-ink text-white">
      <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_2fr]">
          <div>
            <Image
              src="/images/logos/WHITE%20VOCO%20LOGO%20V1%20(no%20bg).png"
              alt="Voco"
              width={172}
              height={96}
              className="-ml-3 h-12 w-auto"
            />
            <p className="mt-3 max-w-xs font-display text-xl leading-snug tracking-[-0.01em] text-white/90">
              {HEADLINE}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h2 className="font-code text-[11px] uppercase tracking-[0.16em] text-white/50">{column.title}</h2>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-white/75 transition-colors hover:text-mk-signal">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Voco Private Limited. All rights reserved.</p>
          <p className="font-code tracking-wide">voco.live</p>
        </div>
      </div>
    </footer>
  );
}
