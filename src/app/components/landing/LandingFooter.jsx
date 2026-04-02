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

        {/* Newsletter CTA section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-10 mb-10 border-b border-white/[0.06]">
          <div>
            <h3 className="text-xl font-semibold text-[#F5F5F5] mb-1">Stay in the loop</h3>
            <p className="text-sm text-[#71717A]">Product updates and tips for growing your business.</p>
          </div>
          <div className="flex shrink-0">
            <input
              type="email"
              placeholder="you@example.com"
              className="bg-[#121110] border border-white/[0.1] text-[#F5F5F5] placeholder:text-[#71717A] rounded-l-xl h-11 px-4 text-sm focus:border-[#F97316] focus:outline-none focus:shadow-[0_0_0_3px_rgba(249,115,22,0.2)] w-52"
            />
            <button
              type="button"
              className="bg-[#F97316] hover:bg-[#F97316]/90 text-white font-semibold px-5 h-11 rounded-r-xl text-sm transition-colors"
            >
              Subscribe
            </button>
          </div>
        </div>

        {/* Three-column grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
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
                <Link href="/#how-it-works" className="text-sm text-white/40 hover:text-[#F97316] transition-colors duration-200">
                  How it works
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
                width={100}
                height={36}
                className="h-9"
                style={{ width: 'auto', height: 'auto' }}
              />
              <span className="text-base text-[#71717A]">Every call answered. Every job booked.</span>
            </div>

            {/* Social links */}
            <div className="flex items-center gap-6">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#71717A] hover:text-[#F97316] transition-colors"
              >
                Twitter / X
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#71717A] hover:text-[#F97316] transition-colors"
              >
                LinkedIn
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#71717A] hover:text-[#F97316] transition-colors"
              >
                GitHub
              </a>
            </div>

            {/* Copyright + back to top */}
            <div className="flex items-center gap-4">
              <p className="text-xs text-white/15">&copy; {new Date().getFullYear()} Voco Private Limited. All rights reserved.</p>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-1 text-sm text-[#71717A] hover:text-[#F97316] transition-colors"
                aria-label="Back to top"
              >
                <ArrowUp className="size-3.5" />
                <span>Top</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
