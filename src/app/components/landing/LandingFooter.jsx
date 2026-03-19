import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="bg-[#0F172A] border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-gradient-to-br from-[#C2410C] to-[#9A3412] flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 16 16" className="size-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 2v6M4 6l4-4 4 4M3 10h10M5 14h6" />
              </svg>
            </div>
            <span className="text-sm text-white/50">
              HomeService AI
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <Link href="/terms" className="text-sm text-white/30 hover:text-white/50 transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="text-sm text-white/30 hover:text-white/50 transition-colors">
              Privacy
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-xs text-white/20">
            &copy; {new Date().getFullYear()} HomeService AI. No call goes to voicemail.
          </p>
        </div>
      </div>
    </footer>
  );
}
