import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="bg-[#0F172A] border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Logo + tagline */}
        <div className="flex items-center gap-2 mb-3">
          <div className="size-7 rounded-lg bg-gradient-to-br from-[#C2410C] to-[#9A3412] flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 16 16" className="size-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 2v6M4 6l4-4 4 4M3 10h10M5 14h6" />
            </svg>
          </div>
          <span className="text-white font-semibold text-[15px] tracking-tight">Voco</span>
        </div>
        <p className="text-sm text-white/40 mb-10 ml-9">Every call answered. Every job booked.</p>

        {/* Three-column grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          {/* Product column */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/#features" className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  How it works
                </Link>
              </li>
            </ul>
          </div>

          {/* Company column */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/about" className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal column */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/terms" className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom: copyright */}
        <div className="border-t border-white/[0.06] pt-8">
          <p className="text-xs text-white/20">&copy; {new Date().getFullYear()} Voco. No call goes to voicemail.</p>
        </div>
      </div>
    </footer>
  );
}
