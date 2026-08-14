'use client';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUp } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="relative bg-[#090807] overflow-hidden">
      {/* Subtle orange radial glow — matches hero warmth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.025),transparent_60%)] pointer-events-none" />
      {/* Copper gradient top border */}
      <div
        className="h-px w-full"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #F97316 50%, transparent 100%)' }}
        aria-hidden="true"
      />
      <div className="relative max-w-6xl mx-auto px-6 py-20">

        {/* Four-column grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Product column */}
          <div>
            <h4 className="text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/#features" className="text-sm text-white/40 hover:text-[#F97316] transition-colors duration-200">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-white/40 hover:text-[#F97316] transition-colors duration-200">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/#audio-demo" className="text-sm text-white/40 hover:text-[#F97316] transition-colors duration-200">
                  Hear a demo
                </Link>
              </li>
            </ul>
          </div>

          {/* Company column */}
          <div>
            <h4 className="text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/about" className="text-sm text-white/40 hover:text-[#F97316] transition-colors duration-200">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-white/40 hover:text-[#F97316] transition-colors duration-200">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources column */}
          <div>
            <h4 className="text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider mb-4">Resources</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/blog" className="text-sm text-white/40 hover:text-[#F97316] transition-colors duration-200">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/for" className="text-sm text-white/40 hover:text-[#F97316] transition-colors duration-200">
                  For Your Trade
                </Link>
              </li>
              <li>
                <Link href="/compare" className="text-sm text-white/40 hover:text-[#F97316] transition-colors duration-200">
                  Compare
                </Link>
              </li>
              <li>
                <Link href="/integrations" className="text-sm text-white/40 hover:text-[#F97316] transition-colors duration-200">
                  Integrations
                </Link>
              </li>
              <li>
                <Link href="/glossary" className="text-sm text-white/40 hover:text-[#F97316] transition-colors duration-200">
                  Glossary
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal column */}
          <div>
            <h4 className="text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider mb-4">Legal</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/terms" className="text-sm text-white/40 hover:text-[#F97316] transition-colors duration-200">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-white/40 hover:text-[#F97316] transition-colors duration-200">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.06] pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Logo + tagline */}
            <div className="flex items-center gap-3">
              <Image
                src="/images/logos/WHITE%20VOCO%20LOGO%20V1%20(no%20bg).png"
                alt="Voco"
                width={129}
                height={72}
                className="h-9 w-auto"
              />
              <span className="text-base text-[#71717A]">Every call answered. Every job booked.</span>
            </div>

            {/* Copyright + back to top */}
            <div className="flex items-center gap-4">
              <p className="text-xs text-white/15">&copy; {new Date().getFullYear()} Voco Private Limited. All rights reserved.</p>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="group flex items-center gap-1 text-sm text-[#71717A] hover:text-[#F97316] transition-colors"
                aria-label="Back to top"
              >
                <ArrowUp className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5" />
                <span>Top</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
