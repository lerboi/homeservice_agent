'use client';

import { AnimatedSection } from './AnimatedSection';
import dynamic from 'next/dynamic';

// 21st.dev animated-hero RotatingText — lazy loaded, SSR shows static fallback
const RotatingText = dynamic(
  () => import('./RotatingText').then((m) => m.RotatingText),
  {
    loading: () => <span className="text-[#F97316]">Phone Calls</span>,
  }
);

// Spline 3D scene — lazy loaded via CDN web component (zero bundle impact).
// Poster placeholder is built into SplineScene, so no loading spinner needed.
const SplineScene = dynamic(
  () => import('./SplineScene').then((m) => m.SplineScene),
);

// HeroDemoBlock — client component managing input-to-player transition (no SSR)
const HeroDemoBlock = dynamic(
  () => import('./HeroDemoBlock').then((m) => m.HeroDemoBlock),
  { ssr: false }
);

const SPLINE_SCENE_URL = 'https://prod.spline.design/CN1NeDZqows-DMX0/scene.splinecode';

export function HeroSection() {
  return (
    <section className="relative bg-[#050505] overflow-hidden min-h-[100svh] md:min-h-[700px] flex flex-col">
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
      {/* Mobile: enhanced warm glow echoing the Spline orb mood */}
      <div className="absolute inset-0 md:hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.12)_0%,rgba(251,146,60,0.05)_40%,transparent_70%)] blur-[40px]" />
        <div className="absolute top-[45%] right-[20%] w-[200px] h-[200px] rounded-full bg-[radial-gradient(circle,rgba(253,186,116,0.08)_0%,transparent_60%)]" />
      </div>

      <div className="relative w-full max-w-6xl mx-auto px-6 py-12 md:py-32 flex-1 flex flex-col justify-center pointer-events-none">
        <div className="w-full max-w-full min-w-0 md:max-w-[50%]">
          <AnimatedSection>
            <h1 className="text-[2.25rem] md:text-[2.5rem] lg:text-[3rem] font-semibold text-white leading-[1.2] tracking-tight break-words">
              Voco Answers So You Can Keep
              <br />
              <span className="text-[2.75rem] md:text-[3rem] lg:text-[3.75rem]">
                <RotatingText
                  texts={['Phone Calls', 'Bookings', 'Invoices', 'Paperwork']}
                  rotationInterval={3000}
                  staggerDuration={0.03}
                  staggerFrom="first"
                  className="text-[#F97316]"
                />
              </span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-white/60 mt-5 mb-4 max-w-xl leading-relaxed">
              Voco picks up when you're on the roof, in a crawlspace, or running on four hours of sleep. You stay in charge of every job — it just makes sure the next call doesn't hang up.
            </p>
            <p className="text-xs sm:text-sm text-white/35 mb-8">
              Enter your business name and hear it in action.
            </p>

            {/* Demo input/player — HeroDemoBlock manages input-to-player transition */}
            <div className="mt-8 pointer-events-auto">
              <HeroDemoBlock />
            </div>

            {/* Mobile: scrolling integration logo marquee */}
            <div className="md:hidden mt-10 pointer-events-auto">
              <p className="text-xs text-white/25 uppercase tracking-widest mb-4">Integrates with</p>
              <div className="overflow-hidden relative">
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#050505] to-transparent z-10" />
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#050505] to-transparent z-10" />
                <div className="flex items-center gap-10 w-max" style={{ animation: 'marquee 20s linear infinite' }}>
                  {[0, 1].map((i) => (
                    <div key={i} className="flex items-center gap-10 shrink-0">
                      {/* Google */}
                      <svg className="h-5 w-auto opacity-30 shrink-0" viewBox="0 0 74 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9.24 13.28H4.68v-2.4h7.56c.07.42.12.92.12 1.46 0 1.78-.49 3.98-2.06 5.56C8.94 19.26 7.18 20 4.94 20 .78 20 0 16.36 0 12.5S.78 5 4.94 5c2.3 0 3.94.9 5.16 2.08l-1.7 1.7c-.88-.82-2.02-1.46-3.46-1.46-2.82 0-5.04 2.28-5.04 5.18s2.22 5.18 5.04 5.18c1.84 0 2.88-.74 3.56-1.42.54-.54.9-1.32 1.06-2.38h-.32z" fill="white"/>
                        <path d="M25.08 12.5c0 3.24-2.54 5.62-5.66 5.62s-5.66-2.38-5.66-5.62 2.54-5.62 5.66-5.62 5.66 2.38 5.66 5.62zm-2.48 0c0-2.02-1.46-3.4-3.18-3.4s-3.18 1.38-3.18 3.4 1.46 3.4 3.18 3.4 3.18-1.38 3.18-3.4z" fill="white"/>
                        <path d="M38.04 12.5c0 3.24-2.54 5.62-5.66 5.62s-5.66-2.38-5.66-5.62 2.54-5.62 5.66-5.62 5.66 2.38 5.66 5.62zm-2.48 0c0-2.02-1.46-3.4-3.18-3.4s-3.18 1.38-3.18 3.4 1.46 3.4 3.18 3.4 3.18-1.38 3.18-3.4z" fill="white"/>
                        <path d="M50.36 7.18v9.94c0 4.1-2.42 5.76-5.28 5.76-2.7 0-4.32-1.8-4.92-3.28l2.16-.9c.38.9 1.3 1.96 2.76 1.96 1.8 0 2.92-1.12 2.92-3.22v-.78h-.08c-.54.66-1.58 1.24-2.88 1.24-2.74 0-5.24-2.38-5.24-5.46 0-3.08 2.5-5.56 5.24-5.56 1.3 0 2.34.58 2.88 1.22h.08v-.92h2.36zm-2.18 5.38c0-1.96-1.3-3.4-2.96-3.4-1.68 0-3.1 1.44-3.1 3.4 0 1.94 1.42 3.36 3.1 3.36 1.66 0 2.96-1.42 2.96-3.36z" fill="white"/>
                        <path d="M54.44 1.2v16.6h-2.4V1.2h2.4z" fill="white"/>
                        <path d="M63.84 14.28l1.88 1.24c-.6.9-2.08 2.46-4.62 2.46-3.14 0-5.5-2.44-5.5-5.62 0-3.34 2.38-5.62 5.22-5.62 2.86 0 4.26 2.28 4.72 3.5l.24.62-7.38 3.06c.56 1.12 1.44 1.68 2.68 1.68 1.24 0 2.1-.6 2.76-1.52zm-5.78-2.02l4.94-2.04c-.28-.7-1.1-1.18-2.08-1.18-1.24 0-2.98 1.1-2.86 3.22z" fill="white"/>
                      </svg>
                      {/* Microsoft */}
                      <svg className="h-4 w-auto opacity-30 shrink-0" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="0" y="0" width="10.5" height="10.5" fill="white"/>
                        <rect x="12.5" y="0" width="10.5" height="10.5" fill="white"/>
                        <rect x="0" y="12.5" width="10.5" height="10.5" fill="white"/>
                        <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="white"/>
                      </svg>
                      {/* Stripe */}
                      <svg className="h-5 w-auto opacity-30 shrink-0" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M60 12.9C60 8.62 57.94 5.22 54.04 5.22c-3.92 0-6.34 3.4-6.34 7.64 0 5.04 2.82 7.58 6.86 7.58 1.98 0 3.46-.44 4.58-1.08v-3.36c-1.12.56-2.4.9-4.02.9-1.58 0-2.98-.56-3.16-2.46h7.98c0-.2.1-1.04.1-1.54zm-8.08-1.58c0-1.82 1.12-2.58 2.14-2.58 1 0 2.04.76 2.04 2.58h-4.18zM41.42 5.22c-1.6 0-2.62.74-3.2 1.26l-.2-1h-3.58v19.64l4.06-.86.02-4.76c.58.42 1.44 1.02 2.86 1.02 2.88 0 5.52-2.32 5.52-7.42-.02-4.68-2.7-7.28-5.48-7.28zm-.96 11.16c-.96 0-1.52-.34-1.9-.76l-.02-6c.42-.46.98-.8 1.92-.8 1.48 0 2.5 1.66 2.5 3.78 0 2.16-1 3.78-2.5 3.78zM29.1 4.32l4.08-.88V.08l-4.08.86v3.38zm0 1.18h4.08v14.72H29.1V5.5zm-4.36 1.24l-.26-1.24h-3.52v14.72h4.06V10c.96-1.26 2.58-1.02 3.1-.84V5.5c-.54-.2-2.5-.56-3.38 1.24zm-8.16-3.8L12.6 3.8l-.02 13.48c0 2.48 1.88 4.32 4.36 4.32 1.38 0 2.38-.26 2.94-.56v-3.3c-.54.22-3.2 1-3.2-1.48V8.96h3.2V5.5h-3.2l.02-2.56zM4.14 10.16c0-.62.52-.88 1.38-.88 1.24 0 2.8.38 4.04 1.04V6.58c-1.36-.54-2.7-.74-4.04-.74C2.2 5.84 0 7.56 0 10.38c0 4.36 6 3.66 6 5.54 0 .74-.64 1-1.54 1-1.34 0-3.04-.54-4.4-1.28v3.82c1.5.64 3.02.92 4.4.92 3.4 0 5.62-1.68 5.62-4.54-.02-4.7-6.04-3.88-6.04-5.68h.1z" fill="white"/>
                      </svg>
                      {/* Twilio */}
                      <svg className="h-5 w-auto opacity-30 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 20.4c-4.636 0-8.4-3.764-8.4-8.4S7.364 3.6 12 3.6s8.4 3.764 8.4 8.4-3.764 8.4-8.4 8.4z" fill="white"/>
                        <circle cx="9" cy="9" r="2" fill="white"/>
                        <circle cx="15" cy="9" r="2" fill="white"/>
                        <circle cx="9" cy="15" r="2" fill="white"/>
                        <circle cx="15" cy="15" r="2" fill="white"/>
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedSection>

        </div>
      </div>
    </section>
  );
}
