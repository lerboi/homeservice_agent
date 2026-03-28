import { LandingNav } from '@/app/components/landing/LandingNav';
import { LandingFooter } from '@/app/components/landing/LandingFooter';
import { Toaster } from 'sonner';

export default function PublicLayout({ children }) {
  return (
    <>
      <LandingNav />
      <main className="relative">{children}</main>
      <LandingFooter />
      <Toaster richColors position="top-center" />
    </>
  );
}
