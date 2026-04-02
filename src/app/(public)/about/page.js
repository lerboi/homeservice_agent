import Link from 'next/link';
import { ArrowRight, Zap } from 'lucide-react';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';
import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';

export const metadata = {
  title: 'About — Voco',
  description: 'Voco is an AI receptionist built specifically for home service businesses. Here\'s why we exist.',
};

const STATS = [
  { value: '$650', label: 'average value of a missed emergency call' },
  { value: '3 AM', label: 'when your best leads call' },
  { value: '5 min', label: 'to get Voco live' },
];

const VALUES = [
  {
    title: 'Trades-first',
    body: 'We built Voco for plumbers, electricians, HVAC techs, and roofers — not generic call centres. Every decision we make starts with what a tradesperson actually needs.',
  },
  {
    title: 'Speed over complexity',
    body: 'Five minutes to set up. No IT team. No manuals. If it takes longer than a coffee break, we\'ve failed.',
  },
  {
    title: 'You own the relationship',
    body: 'Voco is your AI, not a third-party answering service. Every caller hears your business name. Every lead lands in your hands.',
  },
  {
    title: 'Always improving',
    body: 'We ship updates constantly. Every edge case we discover — after-hours accents, multi-trade queries, urgent escalations — makes the AI sharper for everyone.',
  },
];

export default function AboutPage() {
  return (
    <div className="bg-[#050505]">

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-36 pb-20 md:pt-44 md:pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.12),transparent_60%)]" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(249,115,22,0.06),transparent_50%)]" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-6">
          <AnimatedSection>
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white leading-tight tracking-tight mb-6">
                We answer phones for people who{' '}
                <span className="text-[#F97316]">work with their hands.</span>
              </h1>
              <p className="text-lg text-white/50 max-w-xl leading-relaxed">
                Voco is an AI receptionist for plumbers, electricians, and HVAC techs.
                We exist because voicemail was never a real solution.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── The Problem ──────────────────────────────────── */}
      <section className="bg-[#F5F5F4]">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">

          {/* Big stat — pull quote */}
          <AnimatedSection>
            <div className="max-w-3xl">
              <div className="text-5xl md:text-7xl font-bold text-[#F97316] leading-none">94%</div>
              <p className="text-xl md:text-2xl text-[#0F172A]/70 mt-3 max-w-md">
                of callers hang up when they reach voicemail.
              </p>
            </div>
          </AnimatedSection>

          {/* Narrative + sidebar stats */}
          <div className="mt-12 md:mt-16 grid md:grid-cols-[2fr_1fr] gap-12 items-start">
            <div className="max-w-2xl">
              <p className="text-lg text-[#475569] leading-relaxed">
                When you&apos;re under a sink or up a ladder, you can&apos;t answer the phone. But the person
                calling you has a burst pipe, a dead furnace, or a sparking outlet. They&apos;re not leaving
                a voicemail — they&apos;re calling the next name on the list.
              </p>
              <p className="text-lg text-[#475569] leading-relaxed mt-4">
                Hiring a receptionist costs $3,000 to $4,000 a month. The math never works for a
                two-person crew. So the calls go to voicemail, and the jobs go to someone else.
              </p>
            </div>

            <div className="space-y-6 border-l-2 border-[#F97316]/20 pl-6">
              {STATS.map(({ value, label }) => (
                <div key={value}>
                  <div className="text-2xl font-semibold text-[#0F172A]">{value}</div>
                  <div className="text-sm text-[#64748B] mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Origin Story ─────────────────────────────────── */}
      <section className="bg-[#050505]">
        <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
          <p className="text-xl md:text-2xl text-white/80 leading-relaxed font-light">
            We started Voco because we kept hearing the same story.
          </p>

          <div className="my-10 md:my-14 border-l-2 border-[#F97316] pl-6 md:pl-8">
            <p className="text-3xl md:text-4xl font-semibold text-white leading-snug">
              A great tradesperson loses a $2,000 job because their phone died on a job site.
            </p>
          </div>

          <div className="space-y-5">
            <p className="text-lg text-white/60 leading-relaxed">
              It happens at 2 AM when a pipe bursts. It happens at noon when you&apos;re
              elbow-deep in a panel box. It happens on Saturday when you&apos;ve finally taken
              your kid to the park.
            </p>
            <p className="text-lg text-white/60 leading-relaxed">
              Our job is simple: make sure there&apos;s always someone there to pick up. Not a
              voicemail. Not a generic answering service. An AI that knows the difference between
              a dripping tap and a flooded basement, and treats your callers the way you would.
            </p>
            <p className="text-lg text-white/60 leading-relaxed">
              It answers in under two rings. It captures the name, number, job type, and urgency.
              It sends you a summary the moment the call ends. And it sounds like your business —
              because it is.
            </p>
          </div>
        </div>
      </section>

      {/* ── How We're Different ───────────────────────────── */}
      <section className="bg-[#F5F5F4]">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
          <h2 className="text-2xl md:text-3xl font-semibold text-[#0F172A] tracking-tight max-w-lg mb-14">
            Not another generic chatbot.
          </h2>

          {/* Differentiator 1 — icon + text, flat */}
          <div className="flex items-start gap-5 md:gap-8">
            <div className="size-10 rounded-xl bg-[#F97316]/10 flex items-center justify-center shrink-0">
              <Zap className="size-5 text-[#F97316]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#0F172A] mb-2">Trained on trade calls</h3>
              <p className="text-[#64748B] leading-relaxed max-w-xl">
                Voco understands &ldquo;burst pipe&rdquo;, &ldquo;no heat&rdquo;, and &ldquo;sparking outlet&rdquo; — not just
                generic booking requests. It asks the right follow-up questions and tags urgency automatically.
              </p>
            </div>
          </div>

          {/* Differentiator 2 — indented callout with border */}
          <div className="md:ml-16 mt-10 border-l-2 border-[#F97316]/30 pl-6">
            <h3 className="text-lg font-semibold text-[#0F172A] mb-2">Your voice, your brand</h3>
            <p className="text-[#64748B] leading-relaxed max-w-lg">
              Pick a tone — professional, friendly, or local expert. Callers hear your business name
              and get the same warm experience every single time, whether you&apos;re on a job or asleep.
            </p>
          </div>

          {/* Differentiator 3 — right-aligned on desktop */}
          <div className="mt-10 md:ml-auto md:max-w-md md:text-right">
            <h3 className="text-lg font-semibold text-[#0F172A] mb-2">Booking, not just answering</h3>
            <p className="text-[#64748B] leading-relaxed">
              Voco doesn&apos;t just take messages. It captures lead details, qualifies the job type,
              and routes everything into your dashboard so you can call back with full context.
            </p>
          </div>
        </div>
      </section>

      {/* ── Values ───────────────────────────────────────── */}
      <section className="bg-[#050505]">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-20">
          <h2 className="text-xl font-medium text-white/40 tracking-tight mb-10">
            What we believe
          </h2>

          <div className="space-y-0">
            {VALUES.map(({ title, body }, i) => (
              <div key={title}>
                <div className="py-8 md:py-10">
                  <h3 className="text-xl md:text-2xl font-semibold text-white">{title}</h3>
                  <p className="text-white/40 leading-relaxed mt-2 max-w-xl">{body}</p>
                </div>
                {i < VALUES.length - 1 && (
                  <div className="h-px bg-white/[0.06]" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[#1C1412]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(249,115,22,0.06),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(249,115,22,0.04),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.08),transparent_50%)] animate-cta-glow" />

        <div className="relative max-w-5xl mx-auto px-6 py-20 md:py-28">
          <div className="md:flex md:items-center md:justify-between gap-12">
            <div className="md:max-w-lg mb-8 md:mb-0">
              <h2 className="text-3xl md:text-4xl font-semibold text-white leading-tight tracking-tight">
                Your next emergency call is tonight.
              </h2>
              <p className="text-lg text-[#A1A1AA] mt-4 leading-relaxed">
                Five-minute setup. No tech skills. No credit card.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-4">
              <AuthAwareCTA variant="cta" />
              <Link
                href="/contact"
                className="text-sm text-[#A1A1AA] hover:text-white transition-colors flex items-center gap-1 group"
              >
                Talk to us first
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
