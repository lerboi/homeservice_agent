import Image from 'next/image';
import { AnimatedSection } from './AnimatedSection';
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
            <h1 className="text-[2.5rem] md:text-[3.25rem] lg:text-[3.75rem] font-semibold text-white leading-[1.1] tracking-tight">
              Every Missed Call Is a Job Your{' '}
              <RotatingText
                texts={['Competitor', 'Rival', 'Neighbor']}
                rotationInterval={3000}
                staggerDuration={0.03}
                staggerFrom="first"
                className="text-[#F97316]"
              />{' '}
              Just Booked
            </h1>

            <p className="text-lg md:text-xl text-white/50 mt-5 mb-8 max-w-xl leading-relaxed">
              Enter your business name and hear your AI receptionist answer in 30 seconds.
            </p>

            {/* Demo input/player — wired in Plan 04 */}
            <div className="mt-8 pointer-events-auto">
              {/* HeroDemoInput will be inserted here */}
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
