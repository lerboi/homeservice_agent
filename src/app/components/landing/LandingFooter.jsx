import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="bg-landing-dark px-6">
      <div className="max-w-5xl mx-auto py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-white/60 text-sm">HomeService AI — No call goes to voicemail.</p>
        <div className="flex gap-6 text-white/40 text-sm">
          <Link href="/terms" className="hover:text-white/60">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-white/60">
            Privacy
          </Link>
        </div>
        <p className="text-white/30 text-xs">&copy; {new Date().getFullYear()} HomeService AI</p>
      </div>
    </footer>
  );
}
