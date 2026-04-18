import Link from 'next/link';
import { ArrowRight, Check, PhoneMissed } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';

function Row({ text, tone }) {
  const isBad = tone === 'bad';
  return (
    <li className="flex items-start gap-3.5 py-3.5 border-b border-stone-200 text-[15px] leading-[1.55] text-[#475569]">
      <span
        className={`flex items-center justify-center w-5 h-5 rounded-full shrink-0 mt-[1px] text-[12px] font-bold ${
          isBad ? 'bg-red-600/10 text-red-600' : 'bg-[#F97316]/[0.12] text-[#F97316]'
        }`}
      >
        {isBad ? '×' : <Check className="w-[11px] h-[11px]" />}
      </span>
      <span>{text}</span>
    </li>
  );
}

function BigStat() {
  return (
    <div className="relative text-center pt-4 pb-2">
      <div
        className="inline-flex items-baseline justify-center gap-1.5"
        style={{ fontVariantNumeric: 'tabular-nums', lineHeight: 0.95 }}
      >
        <span
          className="self-start font-medium text-red-600 mt-[0.25em]"
          style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
        >
          −$
        </span>
        <span
          className="font-semibold text-[#0F172A]"
          style={{
            fontSize: 'clamp(56px, 8vw, 96px)',
            letterSpacing: '-0.04em',
          }}
        >
          260,400
        </span>
      </div>
      <div className="mt-4 text-[14px] font-medium text-[#94A3B8] uppercase tracking-[0.14em]">
        The average trade business loses this much per year to missed calls
      </div>
      <div className="mt-2 text-[13px] text-[#94A3B8]">
        Based on 3 missed calls/week × $1,670 avg ticket
      </div>
    </div>
  );
}

function SplitLists() {
  return (
    <div className="mt-18 grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] md:gap-x-16 gap-2 relative items-start">
      {/* LEFT — without Voco */}
      <div className="px-1">
        <div className="flex items-baseline justify-between gap-4 pb-[18px] border-b-2 border-[#0F172A]">
          <div className="flex items-center gap-2.5">
            <PhoneMissed className="w-4 h-4 text-red-600" />
            <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#0F172A]">
              Without Voco
            </span>
          </div>
          <div
            className="text-[20px] font-semibold text-red-600"
            style={{ letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
          >
            −$5,010{' '}
            <span className="text-[12px] font-medium text-[#94A3B8]">/ wk</span>
          </div>
        </div>
        <ul className="list-none m-0 p-0">
          <Row tone="bad" text="Phone rings 6+ times, caller hangs up" />
          <Row tone="bad" text="Voicemail fills up, never returned" />
          <Row tone="bad" text="Lead calls the next plumber on the list" />
          <Row tone="bad" text="You see the missed call 2 hours later" />
        </ul>
      </div>

      {/* Divider (desktop only) */}
      <div
        aria-hidden="true"
        className="hidden md:block w-px self-stretch"
        style={{
          background:
            'linear-gradient(180deg, transparent, #E7E5E4 18%, #E7E5E4 82%, transparent)',
        }}
      />

      {/* RIGHT — with Voco */}
      <div className="px-1">
        <div className="flex items-baseline justify-between gap-4 pb-[18px] border-b-2 border-[#F97316]">
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-[#F97316]" />
            <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#F97316]">
              With Voco
            </span>
          </div>
          <div
            className="text-[20px] font-semibold text-[#F97316]"
            style={{ letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
          >
            +$5,010{' '}
            <span className="text-[12px] font-medium text-[#94A3B8]">/ wk</span>
          </div>
        </div>
        <ul className="list-none m-0 p-0">
          <Row tone="good" text="Answered on ring 1, under 1 second" />
          <Row tone="good" text="Triaged, priced, booked on the call" />
          <Row tone="good" text="Confirmed in your calendar before hangup" />
          <Row tone="good" text="SMS follow-up sent automatically" />
        </ul>
      </div>
    </div>
  );
}

export function CostOfSilenceBlock() {
  return (
    <section
      className="bg-white"
      style={{ padding: 'clamp(88px, 14vw, 144px) clamp(24px, 6vw, 72px)' }}
    >
      <div className="max-w-[1040px] mx-auto">
        <AnimatedSection>
          <div className="text-center max-w-[720px] mx-auto">
            <div className="inline-block text-[13px] font-semibold text-[#F97316] tracking-[0.18em] uppercase">
              The cost of silence
            </div>
            <h2
              className="font-semibold text-[#0F172A] mt-3.5"
              style={{
                fontSize: 'clamp(32px, 5vw, 48px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              The math isn&apos;t close.
            </h2>
            <p className="text-[17px] leading-[1.65] text-[#475569] mt-[18px]">
              Every unanswered call is a competitor&apos;s win. That&apos;s not a
              marketing stat — that&apos;s your Tuesday.
            </p>
          </div>

          <div className="mt-18">
            <BigStat />
          </div>

          <SplitLists />

          <div className="mt-14 flex justify-center">
            <Link
              href="/pricing#calculator"
              className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#F97316] border-b border-[#F97316] py-2.5 hover:text-[#EA580C] hover:border-[#EA580C] transition-colors"
            >
              Run your own numbers <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
