import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { LandingNav } from '@/app/components/landing/LandingNav';
import { LandingFooter } from '@/app/components/landing/LandingFooter';
import { Toaster } from 'sonner';
import PublicChatButton from '@/components/landing/PublicChatButton';

// Marketing-site type: a geometric display face for headlines and a mono face
// for transcript and action-log elements. Inter (root layout) stays the body
// face. Loaded here so the dashboard, onboarding and auth pages do not pay
// for them.
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

export default function PublicLayout({ children }) {
  return (
    <div className={`${display.variable} ${mono.variable} bg-mk-paper text-mk-ink antialiased`}>
      <LandingNav />
      <main className="relative overflow-x-clip">{children}</main>
      <LandingFooter />
      <Toaster richColors position="top-center" />
      <PublicChatButton />
    </div>
  );
}
