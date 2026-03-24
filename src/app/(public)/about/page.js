import Link from 'next/link';
import { ArrowRight, Phone, Clock, TrendingUp, Shield, Zap, Users, Star, CheckCircle, Wrench, DollarSign } from 'lucide-react';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from '@/app/components/landing/AnimatedSection';
import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';

export const metadata = {
  title: 'About — Voco',
  description: 'Built for the trades. Every call answered, every job booked.',
};

const VALUES = [
  {
    icon: Phone,
    title: 'Trades-first',
    body: 'We built Voco for plumbers, electricians, HVAC techs, and roofers — not generic call centres. Every decision we make starts with what a tradesperson actually needs.',
  },
  {
    icon: Clock,
    title: 'Speed over complexity',
    body: 'Five minutes to set up. No IT team. No manuals. If it takes longer than a coffee break, we\'ve failed.',
  },
  {
    icon: Shield,
    title: 'You own the relationship',
    body: 'Voco is your AI, not a third-party answering service. Every caller hears your business name. Every lead lands in your hands.',
  },
  {
    icon: TrendingUp,
    title: 'Always improving',
    body: 'We ship updates constantly. Every edge case we discover — after-hours accents, multi-trade queries, urgent escalations — makes the AI sharper for everyone.',
  },
];

const STATS = [
  { value: '94%', label: 'of callers hang up if they reach voicemail' },
  { value: '$650', label: 'average value of a missed emergency call' },
  { value: '3 AM', label: 'when your best jobs come in' },
  { value: '5 min', label: 'to get your AI live with Voco' },
];

const HOW_DIFFERENT = [
  {
    icon: Zap,
    title: 'Trained on trade calls',
    body: 'Voco understands "burst pipe", "no heat", and "sparking outlet" — not just generic booking requests. It asks the right follow-up questions and tags urgency automatically.',
  },
  {
    icon: Users,
    title: 'Your voice, your brand',
    body: 'Pick a tone — professional, friendly, or local expert. Callers hear your business name and get the same warm experience every single time, whether you\'re on a job or asleep.',
  },
  {
    icon: Star,
    title: 'Booking, not just answering',
    body: 'Voco doesn\'t just take messages. It captures lead details, qualifies the job type, and routes everything into your dashboard so you can call back with full context.',
  },
];

export default function AboutPage() {
  return (
    <div className="bg-[#0F172A]">

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-36 pb-24 md:pt-44 md:pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(194,65,12,0.12),transparent_60%)]" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(194,65,12,0.06),transparent_50%)]" aria-hidden="true" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <AnimatedSection>
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-[#C2410C] mb-5">
              About Voco
            </span>
            <h1 className="text-4xl md:text-6xl font-semibold text-white leading-tight tracking-tight mb-6">
              Built for the trades.
              <br className="hidden sm:block" />
              <span className="text-[#C2410C]">Not for call centres.</span>
            </h1>
            <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
              Voco is an AI receptionist that speaks the language of home service businesses —
              handling every inbound call, qualifying every lead, and booking every job while
              you&apos;re out doing the work.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ── The Problem ──────────────────────────────────── */}
      <section className="bg-white">
        <div
          className="h-px w-full"
          style={{ background: 'linear-gradient(90deg, transparent 0%, #C2410C 50%, transparent 100%)' }}
          aria-hidden="true"
        />
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <AnimatedSection>
            <div className="max-w-3xl mx-auto text-center mb-16">
              <p className="text-sm font-semibold tracking-widest uppercase text-[#C2410C] mb-4">The problem</p>
              <h2 className="text-3xl md:text-4xl font-semibold text-[#0F172A] leading-tight tracking-tight mb-5">
                Tradespeople are the best in their field.
                <br className="hidden sm:block" />Phone answering isn&apos;t their field.
              </h2>
              <p className="text-lg text-[#475569] leading-relaxed">
                When you&apos;re under a sink, up a ladder, or just done for the day — missed calls mean missed jobs.
                Hiring a receptionist costs $3,000–$4,000 a month. Voicemail loses the customer before they leave a message.
                There had to be a better way.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedStagger className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ value, label }) => (
              <AnimatedItem key={value}>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl px-6 py-8 text-center">
                  <div className="text-3xl md:text-4xl font-bold text-[#C2410C] mb-2">{value}</div>
                  <div className="text-sm text-[#64748B] leading-snug">{label}</div>
                </div>
              </AnimatedItem>
            ))}
          </AnimatedStagger>
        </div>
      </section>

      {/* ── Mission ──────────────────────────────────────── */}
      <section className="bg-[#F8FAFC] border-t border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <AnimatedSection direction="right">
              <p className="text-sm font-semibold tracking-widest uppercase text-[#C2410C] mb-4">Our mission</p>
              <h2 className="text-3xl md:text-4xl font-semibold text-[#0F172A] leading-tight tracking-tight mb-6">
                Every call answered.<br />Every job booked.
              </h2>
              <p className="text-[#475569] leading-relaxed mb-4">
                We started Voco because we kept hearing the same story: a great tradesperson loses a $2,000 job because
                they were on another call, or their phone died on a job site, or it was 2 AM and the pipe burst.
              </p>
              <p className="text-[#475569] leading-relaxed">
                Our mission is simple — make sure no home service business ever loses a customer to voicemail again.
                Not by replacing the human touch, but by making sure there&apos;s always someone there to pick up.
              </p>
            </AnimatedSection>

            <AnimatedSection direction="left" delay={0.1}>
              <div className="space-y-4">
                {[
                  'Answers calls in under 2 rings, 24 / 7 / 365',
                  "Speaks naturally — callers often don't know it's AI",
                  'Captures name, number, job type, and urgency',
                  'Sends you a summary the moment the call ends',
                  'Works alongside you — you stay in control',
                ].map((point) => (
                  <div key={point} className="flex items-start gap-3">
                    <CheckCircle className="size-5 text-[#C2410C] shrink-0 mt-0.5" />
                    <span className="text-[#334155]">{point}</span>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── How We're Different ───────────────────────────── */}
      <section className="bg-white border-t border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <AnimatedSection>
            <div className="text-center mb-14">
              <p className="text-sm font-semibold tracking-widest uppercase text-[#C2410C] mb-4">Why Voco</p>
              <h2 className="text-3xl md:text-4xl font-semibold text-[#0F172A] leading-tight tracking-tight">
                Not another generic chatbot.
              </h2>
            </div>
          </AnimatedSection>

          <AnimatedStagger className="grid md:grid-cols-3 gap-6">
            {HOW_DIFFERENT.map(({ icon: Icon, title, body }) => (
              <AnimatedItem key={title}>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-8 h-full">
                  <div className="size-11 rounded-xl bg-[#FFF1EC] flex items-center justify-center mb-5">
                    <Icon className="size-5 text-[#C2410C]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0F172A] mb-3">{title}</h3>
                  <p className="text-[#64748B] leading-relaxed text-sm">{body}</p>
                </div>
              </AnimatedItem>
            ))}
          </AnimatedStagger>
        </div>
      </section>

      {/* ── Values ───────────────────────────────────────── */}
      <section className="bg-[#0F172A]">
        <div
          className="h-px w-full"
          style={{ background: 'linear-gradient(90deg, transparent 0%, #C2410C 50%, transparent 100%)' }}
          aria-hidden="true"
        />
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <AnimatedSection>
            <div className="text-center mb-14">
              <p className="text-sm font-semibold tracking-widest uppercase text-[#C2410C] mb-4">What we stand for</p>
              <h2 className="text-3xl md:text-4xl font-semibold text-white leading-tight tracking-tight">
                Our values
              </h2>
            </div>
          </AnimatedSection>

          <AnimatedStagger className="grid md:grid-cols-2 gap-6">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <AnimatedItem key={title}>
                <div className="flex gap-5 bg-white/[0.04] border border-white/[0.08] rounded-2xl p-7 h-full hover:bg-white/[0.06] transition-colors">
                  <div className="size-10 rounded-xl bg-[#C2410C]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="size-5 text-[#C2410C]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{body}</p>
                  </div>
                </div>
              </AnimatedItem>
            ))}
          </AnimatedStagger>
        </div>
      </section>

      {/* ── CTA — white bg ───────────────────────────────── */}
      <section className="bg-white border-t border-[#E2E8F0]">
        <div className="max-w-3xl mx-auto text-center px-6 py-20 md:py-28">
          <AnimatedSection>
            <p className="text-sm font-semibold text-[#C2410C] tracking-widest uppercase mb-4">
              Ready to get started?
            </p>
            <h2 className="text-3xl md:text-[2.75rem] font-semibold text-[#0F172A] leading-tight tracking-tight mb-4">
              Ready to never miss
              <br className="hidden sm:block" />
              another call?
            </h2>
            <p className="text-lg text-[#64748B] mb-10 max-w-md mx-auto leading-relaxed">
              Set up your AI receptionist in 5 minutes. No tech skills needed. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <AuthAwareCTA variant="cta" />
              <Link
                href="/contact"
                className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors flex items-center gap-1 group"
              >
                Talk to us first
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

    </div>
  );
}
