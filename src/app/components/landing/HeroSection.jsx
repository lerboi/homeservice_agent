import Link from 'next/link';
import { ArrowRight, PhoneIncoming, Check } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';

const BAR_SEEDS = [
  0.35, 0.62, 0.44, 0.78, 0.91, 0.55, 0.72, 0.48,
  0.88, 0.66, 0.38, 0.81, 0.58, 0.94, 0.70, 0.52,
  0.76, 0.43, 0.87, 0.60, 0.49, 0.82, 0.71, 0.55,
  0.68, 0.41, 0.79, 0.58, 0.92, 0.64, 0.47, 0.73,
];

function VoiceWave() {
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-[560px] mx-auto aspect-square"
    >
      {/* Expanding halo rings */}
      <span className="hero-vw-halo" style={{ animationDelay: '0s' }} />
      <span className="hero-vw-halo" style={{ animationDelay: '0.8s' }} />
      <span className="hero-vw-halo" style={{ animationDelay: '1.6s' }} />

      {/* Central orb */}
      <div
        className="absolute left-1/2 top-1/2 w-[46%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, #FDBA74 0%, #F97316 45%, #C2410C 100%)',
          boxShadow:
            '0 30px 80px -10px rgba(249,115,22,0.55), inset 0 4px 12px rgba(255,255,255,0.22), inset 0 -10px 30px rgba(0,0,0,0.3)',
        }}
      >
        {/* Audio bars */}
        <div className="absolute inset-0 flex items-center justify-center gap-[1.5%]">
          {BAR_SEEDS.map((h, i) => (
            <span
              key={i}
              className="hero-vw-bar inline-block rounded-full bg-white/85"
              style={{
                width: '1.8%',
                height: `${30 + h * 50}%`,
                animationDelay: `${i * 0.06}s`,
              }}
            />
          ))}
        </div>
        {/* Specular highlight */}
        <span
          className="absolute top-[8%] left-[14%] w-[36%] h-[30%] rounded-full blur-[8px]"
          style={{
            background:
              'radial-gradient(ellipse, rgba(255,255,255,0.35), transparent 70%)',
          }}
        />
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative bg-[#050505] text-white overflow-hidden min-h-[100svh] md:min-h-[760px] flex items-center justify-center md:justify-start py-20 md:py-28 px-6 sm:px-10 md:px-[clamp(32px,6vw,88px)]">
      {/* Warm radial glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 1200px 700px at 72% 45%, rgba(249,115,22,0.18), transparent 65%)',
        }}
      />
      {/* Grid texture */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(ellipse 80% 80% at 30% 50%, black 10%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 80% at 30% 50%, black 10%, transparent 75%)',
        }}
      />

      <div className="relative w-full max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-[1.45fr_1fr] md:gap-14 lg:gap-20 gap-14 items-center text-center md:text-left">
        <AnimatedSection className="max-w-[820px] mx-auto md:mx-0 z-[1] flex flex-col items-center md:items-start">
          {/* Live indicator — inline label with animated green dot */}
          <div className="inline-flex items-center gap-2.5 mb-7 text-[12px] font-medium uppercase tracking-[0.08em] text-white/60">
            <span className="relative inline-flex items-center justify-center w-2 h-2">
              <span className="hero-live-ring absolute inset-0 rounded-full bg-green-500/40" />
              <span
                className="absolute inset-[2px] rounded-full bg-green-500"
                style={{ boxShadow: '0 0 10px rgba(34,197,94,0.8)' }}
              />
            </span>
            <span>1,247 calls answered right now</span>
          </div>

          <h1
            className="font-semibold text-white m-0 text-balance"
            style={{
              fontSize: 'clamp(34px, 6.2vw, 80px)',
              lineHeight: 1.04,
              letterSpacing: '-0.035em',
            }}
          >
            Stop losing <span className="text-[#F97316]">$1,000+</span> every time you miss a call.
          </h1>
          <p className="text-[16px] md:text-[20px] leading-[1.55] text-white/70 mt-5 md:mt-6 max-w-[640px]">
            Voco AI answers, triages, and books every call — in under 1 ring.
          </p>

          <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-8 md:mt-10">
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center gap-2 h-[54px] px-[26px] rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-[15px] font-semibold text-white transition-colors"
              style={{
                boxShadow:
                  '0 4px 24px 0 rgba(249,115,22,0.5), inset 0 1px 0 0 rgba(255,255,255,0.14)',
              }}
            >
              Start my 5-minute setup <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <a
              href="#audio-demo"
              className="inline-flex items-center justify-center gap-2 h-[54px] px-6 rounded-xl border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.1] text-[14px] font-medium text-white transition-colors"
            >
              <PhoneIncoming className="w-3.5 h-3.5" /> Hear Voco in action
            </a>
          </div>

          {/* Trust row — plain text with dot separators */}
          <div className="flex items-center flex-wrap justify-center md:justify-start gap-x-5 gap-y-2.5 mt-7 text-[13px] leading-[1.5] text-white/50">
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3 h-3" /> 14-day free trial
            </span>
            <span className="w-[3px] h-[3px] rounded-full bg-white/25" />
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3 h-3" /> No credit card
            </span>
            <span className="w-[3px] h-[3px] rounded-full bg-white/25" />
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3 h-3" /> 5-minute setup
            </span>
          </div>
        </AnimatedSection>

        {/* Right-hand visual — desktop only */}
        <div className="relative hidden md:flex items-center justify-center">
          <VoiceWave />
        </div>

        {/* Mobile ambient glow — echoes the orb mood without the heavy visual */}
        <div
          aria-hidden="true"
          className="md:hidden absolute inset-0 pointer-events-none -z-0"
        >
          <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.14)_0%,rgba(251,146,60,0.06)_40%,transparent_70%)] blur-[40px]" />
          <div className="absolute top-[45%] right-[20%] w-[200px] h-[200px] rounded-full bg-[radial-gradient(circle,rgba(253,186,116,0.08)_0%,transparent_60%)]" />
        </div>
      </div>
    </section>
  );
}
