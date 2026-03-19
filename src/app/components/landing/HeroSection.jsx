import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from './AnimatedSection';
import { Phone, ArrowRight } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative bg-[#0F172A] overflow-hidden">
      {/* Subtle radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(194,65,12,0.08),transparent_70%)]" />
      {/* Grid texture */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

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
                <span className="text-[#C2410C]">Competitor</span>{' '}
                Just Won
              </h1>

              <p className="text-lg md:text-xl text-white/60 mt-5 mb-8 max-w-xl leading-relaxed">
                HomeService AI answers every call, triages the emergency, and books the slot — while you&apos;re knee-deep in someone else&apos;s burst pipe.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-[#C2410C] text-white hover:bg-[#C2410C]/90 min-h-[48px] px-6 text-[15px] font-medium rounded-xl shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_4px_16px_0_rgba(194,65,12,0.4)] hover:-translate-y-0.5 group"
                >
                  <Link href="/onboarding">
                    Start My 5-Minute Setup
                    <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
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

          {/* Dashboard mockup */}
          <div className="md:col-span-6 lg:col-span-5 mt-12 md:mt-0">
            <AnimatedSection delay={0.2} direction="right">
              <div className="relative">
                {/* Glow behind image */}
                <div className="absolute -inset-4 bg-gradient-to-br from-[#C2410C]/20 via-transparent to-transparent rounded-2xl blur-2xl" />
                <div className="relative rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/40">
                  <Image
                    src="/images/dashboard-mockup.png"
                    alt="HomeService AI dashboard showing live call triage and booking"
                    width={640}
                    height={400}
                    priority
                    className="w-full h-auto"
                  />
                  {/* Overlay shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent" />
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </div>
    </section>
  );
}
