import { Bricolage_Grotesque, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { LandingNav } from '@/app/components/landing/LandingNav';
import { LandingFooter } from '@/app/components/landing/LandingFooter';
import { Toaster } from 'sonner';
import PublicChatButton from '@/components/landing/PublicChatButton';

// Marketing-site type: a characterful grotesque for headlines, an italic serif
// for the emphasised words inside them, and a mono face for transcript and
// action-log elements. Inter (root layout) stays the body face. Loaded here so
// the dashboard, onboarding and auth pages do not pay for them.
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-mk-display', display: 'swap' });
const accent = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-mk-accent', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

export default function PublicLayout({ children }) {
  return (
    <div className={`${display.variable} ${accent.variable} ${mono.variable} bg-mk-paper text-mk-ink antialiased`}>
      <LandingNav />
      <main className="relative overflow-x-clip">{children}</main>
      <LandingFooter />
      <Toaster richColors position="top-center" />
      <PublicChatButton />
    </div>
  );
}
