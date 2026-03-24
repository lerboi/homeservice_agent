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
    loading: () => <span className="text-[#F97316]">Competitor</span>,
  }
);

// Spline 3D scene — lazy loaded via CDN web component (zero bundle impact).
// Poster placeholder is built into SplineScene, so no loading spinner needed.
const SplineScene = dynamic(
  () => import('./SplineScene').then((m) => m.SplineScene),
);

const SPLINE_SCENE_URL = 'https://prod.spline.design/CN1NeDZqows-DMX0/scene.splinecode';

export function HeroSection() {
  return (
    <section className="relative bg-[#050505] overflow-hidden">
      {/* Spline 3D scene — full-bleed canvas, centered */}
      <div className="absolute inset-0 hidden md:block">
        <SplineScene
          scene={SPLINE_SCENE_URL}
          className="w-full h-full"
        />
      </div>

      {/* Radial gradient accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.06),transparent_70%)] pointer-events-none" />
      {/* Grid texture */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
      {/* Floating orb */}
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-[#F97316]/[0.03] blur-[120px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-20 md:pt-36 md:pb-28 pointer-events-none">
        <div className="md:max-w-[50%]">
          <AnimatedSection>
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.07] mb-6 pointer-events-auto">
              <div className="size-1.5 rounded-full bg-[#F97316] animate-pulse" />
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
                className="text-[#F97316]"
              />{' '}
              Just Won
            </h1>

            <p className="text-lg md:text-xl text-white/50 mt-5 mb-8 max-w-xl leading-relaxed">
              Voco answers every call, triages the emergency, and books the slot — while you&apos;re knee-deep in someone else&apos;s burst pipe.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pointer-events-auto">
              <AuthAwareCTA variant="hero" />
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-white/15 text-white hover:bg-white/[0.05] min-h-[48px] px-6 text-[15px] font-medium rounded-xl backdrop-blur-sm"
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
                  <div key={i} className={`size-7 rounded-full ${bg} border-2 border-[#050505] flex items-center justify-center text-[10px] text-white font-medium`}>
                    {['D', 'J', 'M'][i]}
                  </div>
                ))}
              </div>
              <p className="text-sm text-white/30">
                Trusted by <span className="text-white/50 font-medium">500+</span> trades businesses
              </p>
            </div>
          </AnimatedSection>

          {/* Mobile: static image fallback for performance */}
          <div className="md:hidden mt-12 pointer-events-auto">
            <div className="relative rounded-xl overflow-hidden border border-white/[0.06] shadow-2xl shadow-black/40">
              <Image
                src="/images/dashboard-mockup.png"
                alt="Voco dashboard showing live call triage and booking"
                width={640}
                height={400}
                priority
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
