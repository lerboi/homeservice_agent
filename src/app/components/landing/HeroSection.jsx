import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from './AnimatedSection';
import { Phone } from 'lucide-react';
import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';
import dynamic from 'next/dynamic';

// 21st.dev animated-hero RotatingText — lazy loaded, SSR shows static fallback
const RotatingText = dynamic(
  () => import('./RotatingText').then((m) => m.RotatingText),
  {
    loading: () => <span className="text-[#C2410C]">Competitor</span>,
  }
);

// 21st.dev serafim/splite Spline 3D scene — lazy loaded, heavy (~500KB)
// Falls back to static dashboard image during load and on SSR
const SplineScene = dynamic(
  () => import('./SplineScene').then((m) => m.SplineScene),
  {
    loading: () => (
      <div className="w-full aspect-[4/3] rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
        <div className="size-8 border-2 border-[#C2410C]/40 border-t-[#C2410C] rounded-full animate-spin" />
      </div>
    ),
  }
);

// TODO: Update to D-03 community model once prod URL is extracted
// Community URL: https://app.spline.design/community/file/2ce6351a-d7a5-4c4e-bf13-75bc9f841891
const SPLINE_SCENE_URL = 'https://prod.spline.design/PyzDhpQ9E5f1E3MT/scene.splinecode';

export function HeroSection() {
  return (
    <section className="relative bg-[#0F172A] overflow-hidden">
      {/* Radial gradient accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(194,65,12,0.08),transparent_70%)]" />
      {/* Grid texture */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      {/* Floating orb */}
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-[#C2410C]/[0.04] blur-[120px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-20 md:pt-36 md:pb-28">
        <div className="md:grid md:grid-cols-12 md:gap-12 md:items-center">
          {/* Copy */}
          <div className="md:col-span-6 lg:col-span-7">
            <AnimatedSection>
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-6">
                <div className="size-1.5 rounded-full bg-[#C2410C] animate-pulse" />
                <span className="text-xs font-medium text-white/70 tracking-wide uppercase">
                  AI-Powered Answering for Trades
                </span>
              </div>

              <h1 className="text-[2.5rem] md:text-[3.25rem] lg:text-[3.75rem] font-semibold text-white leading-[1.1] tracking-tight">
                Every Call You Miss Is a Job Your{' '}
                <RotatingText
                  texts={['Competitor', 'Revenue', 'Customer']}
                  rotationInterval={3000}
                  staggerDuration={0.03}
                  staggerFrom="first"
                  className="text-[#C2410C]"
                />{' '}
                Just Won
              </h1>

              <p className="text-lg md:text-xl text-white/60 mt-5 mb-8 max-w-xl leading-relaxed">
                Voco answers every call, triages the emergency, and books the slot — while you&apos;re knee-deep in someone else&apos;s burst pipe.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <AuthAwareCTA variant="hero" />
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-white/20 text-white hover:bg-white/[0.06] min-h-[48px] px-6 text-[15px] font-medium rounded-xl backdrop-blur-sm"
                >
                  <Link href="/demo">
                    <Phone className="mr-2 size-4" />
                    Watch Demo
                  </Link>
                </Button>
              </div>

              {/* Social proof micro-line */}
              <div className="flex items-center gap-3 mt-8">
                <div className="flex -space-x-2">
                  {['bg-amber-600', 'bg-sky-600', 'bg-emerald-600'].map((bg, i) => (
                    <div key={i} className={`size-7 rounded-full ${bg} border-2 border-[#0F172A] flex items-center justify-center text-[10px] text-white font-medium`}>
                      {['D', 'J', 'M'][i]}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-white/40">
                  Trusted by <span className="text-white/60 font-medium">500+</span> trades businesses
                </p>
              </div>
            </AnimatedSection>
          </div>

          {/* Interactive 3D scene — replaces static dashboard mockup */}
          <div className="md:col-span-6 lg:col-span-5 mt-12 md:mt-0">
            <AnimatedSection delay={0.2} direction="right">
              <div className="relative">
                {/* Glow behind scene */}
                <div className="absolute -inset-4 bg-gradient-to-br from-[#C2410C]/20 via-transparent to-transparent rounded-2xl blur-2xl" />

                {/* Mobile: static image fallback for performance */}
                <div className="block md:hidden relative rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/40">
                  <Image
                    src="/images/dashboard-mockup.png"
                    alt="Voco dashboard showing live call triage and booking"
                    width={640}
                    height={400}
                    priority
                    className="w-full h-auto"
                  />
                </div>

                {/* Desktop: interactive Spline 3D scene */}
                <div className="hidden md:block relative rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/40 aspect-[4/3]">
                  <SplineScene
                    scene={SPLINE_SCENE_URL}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </div>
    </section>
  );
}
