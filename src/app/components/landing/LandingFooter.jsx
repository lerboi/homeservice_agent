'use client';
import Link from 'next/link';
import { ArrowUp } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="bg-[#0F172A]">
      {/* Copper gradient top border */}
      <div
        className="h-px w-full"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #C2410C 50%, transparent 100%)' }}
        aria-hidden="true"
      />
      <div className="max-w-6xl mx-auto px-6 py-20">

        {/* Newsletter CTA section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-10 mb-10 border-b border-white/[0.06]">
          <div>
            <h3 className="text-xl font-semibold text-[#F1F5F9] mb-1">Stay in the loop</h3>
            <p className="text-sm text-[#94A3B8]">Product updates and tips for growing your business.</p>
          </div>
          <div className="flex shrink-0">
            <input
              type="email"
              placeholder="you@example.com"
              className="bg-[#1E293B] border border-white/[0.12] text-[#F1F5F9] placeholder:text-[#94A3B8] rounded-l-xl h-11 px-4 text-sm focus:border-[#C2410C] focus:outline-none focus:shadow-[0_0_0_3px_rgba(194,65,12,0.2)] w-52"
            />
            <button
              type="button"
              className="bg-[#C2410C] hover:bg-[#C2410C]/90 text-white font-semibold px-5 h-11 rounded-r-xl text-sm transition-colors"
            >
              Subscribe
            </button>
          </div>
        </div>

        {/* Three-column grid — D-10: 3 columns preserved */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          {/* Product column */}
          <div>
            <h4 className="text-sm font-semibold text-[#F1F5F9] uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/#features" className="text-sm text-white/50 hover:text-[#C2410C] transition-colors duration-200">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-white/50 hover:text-[#C2410C] transition-colors duration-200">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-sm text-white/50 hover:text-[#C2410C] transition-colors duration-200">
                  How it works
                </Link>
              </li>
            </ul>
          </div>

          {/* Company column */}
          <div>
            <h4 className="text-sm font-semibold text-[#F1F5F9] uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/about" className="text-sm text-white/50 hover:text-[#C2410C] transition-colors duration-200">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-white/50 hover:text-[#C2410C] transition-colors duration-200">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal column */}
          <div>
            <h4 className="text-sm font-semibold text-[#F1F5F9] uppercase tracking-wider mb-4">Legal</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/terms" className="text-sm text-white/50 hover:text-[#C2410C] transition-colors duration-200">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-white/50 hover:text-[#C2410C] transition-colors duration-200">
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
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-lg bg-gradient-to-br from-[#C2410C] to-[#9A3412] flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 16 16" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M8 2v6M4 6l4-4 4 4M3 10h10M5 14h6" />
                </svg>
              </div>
              <span className="text-base text-[#94A3B8]">Every call answered. Every job booked.</span>
            </div>

            {/* Social links */}
            <div className="flex items-center gap-6">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#94A3B8] hover:text-[#C2410C] transition-colors"
              >
                Twitter / X
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#94A3B8] hover:text-[#C2410C] transition-colors"
              >
                LinkedIn
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#94A3B8] hover:text-[#C2410C] transition-colors"
              >
                GitHub
              </a>
            </div>

            {/* Copyright + back to top */}
            <div className="flex items-center gap-4">
              <p className="text-xs text-white/20">&copy; {new Date().getFullYear()} Voco. No call goes to voicemail.</p>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-1 text-sm text-[#94A3B8] hover:text-[#C2410C] transition-colors"
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
