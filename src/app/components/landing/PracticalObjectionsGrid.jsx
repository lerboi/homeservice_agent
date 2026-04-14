import { AnimatedSection, AnimatedStagger, AnimatedItem } from './AnimatedSection';
import {
  Phone, Clock, ShieldCheck, ClipboardList,
  Wrench, Thermometer, Zap, Hammer, HardHat,
  ArrowRight, CircleDollarSign,
} from 'lucide-react';
import { AudioPlayerCard } from './AudioPlayerCard';

const CARD_CLS =
  "rounded-2xl bg-white border border-stone-200/60 shadow-sm p-6 flex flex-col gap-4 " +
  "hover:border-[#F97316]/30 hover:shadow-[0_4px_20px_rgba(249,115,22,0.1)] hover:-translate-y-1 " +
  "transition-all duration-200";

const STAT_CHIP_CLS =
  "inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#166534]/10 " +
  "border border-[#166534]/20 text-[14px] font-semibold text-[#166534] self-start";

const TRADES = [
  { Icon: Wrench, name: 'Plumbing' },
  { Icon: Thermometer, name: 'HVAC' },
  { Icon: Zap, name: 'Electrical' },
  { Icon: Hammer, name: 'Handyman' },
  { Icon: HardHat, name: 'Roofing' },
];

export function PracticalObjectionsGrid() {
  return (
    <section className="bg-[#FAFAF9] py-20 md:py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <p className="text-[14px] font-semibold text-[#F97316] tracking-wide uppercase mb-3">
              Straight answers
            </p>
            <h2 className="text-3xl md:text-[2.25rem] font-semibold text-[#0F172A] leading-tight tracking-tight">
              Your concerns, addressed
            </h2>
          </div>
        </AnimatedSection>

        <AnimatedStagger className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* CARD 1 — OBJ-02: Sound robotic */}
          <AnimatedItem>
            <div data-obj="02" className={CARD_CLS}>
              <Phone className="w-10 h-10 text-[#F97316]" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                Callers don&apos;t hear AI. They hear a professional.
              </h3>
              <p className="text-[15px] text-[#475569] leading-relaxed">
                Voco speaks with a natural cadence, pauses, and handles interruptions. In blind tests, most homeowners can&apos;t tell the difference — and the ones who notice don&apos;t mind once they&apos;re booked.
              </p>
              <span className={STAT_CHIP_CLS}>85% can&apos;t tell it&apos;s AI — 2025 blind test</span>
              <AudioPlayerCard />
            </div>
          </AnimatedItem>

          {/* CARD 2 — OBJ-03: Cost of inaction */}
          <AnimatedItem>
            <div data-obj="03" className={CARD_CLS}>
              <CircleDollarSign className="w-10 h-10 text-[#F97316]" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                The math isn&apos;t close.
              </h3>
              <p className="text-[15px] text-[#475569] leading-relaxed">
                42 calls a month. 74% miss rate. $1,000 average ticket. That&apos;s $260,400/year flowing to the next contractor in line — the one whose phone was picked up.
              </p>
              <div className="mt-2 flex flex-col gap-2">
                <span className="inline-flex items-center gap-2 text-[30px] md:text-[36px] font-semibold text-[#0F172A] leading-none">
                  $260,400<span className="text-[14px] font-semibold text-[#71717A]">/year lost</span>
                </span>
                <span className={STAT_CHIP_CLS}>Voco starts at $99/mo — miss one extra job and it&apos;s paid for</span>
              </div>
            </div>
          </AnimatedItem>

          {/* CARD 3 — OBJ-04: 5-minute setup */}
          <AnimatedItem>
            <div data-obj="04" className={CARD_CLS}>
              <Clock className="w-10 h-10 text-[#F97316]" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                Live on your first coffee break.
              </h3>
              <p className="text-[15px] text-[#475569] leading-relaxed">
                No installs. No integrations. Forward your number, set your hours, and Voco is answering.
              </p>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mt-2">
                {[
                  { n: '1', label: 'Forward your number', sub: 'Any carrier, any phone' },
                  { n: '2', label: 'Set your hours', sub: 'When Voco answers' },
                  { n: '3', label: "You're live", sub: 'Next call goes through' },
                ].map(({ n, label, sub }, i, arr) => (
                  <div key={n} className="flex items-center gap-3 flex-1">
                    <div className="flex flex-col items-center md:items-start gap-1 flex-1">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#F97316]/10 text-[#F97316] text-[14px] font-semibold">
                        {n}
                      </span>
                      <p className="text-[14px] font-semibold text-[#0F172A]">{label}</p>
                      <p className="text-[14px] text-[#71717A]">{sub}</p>
                    </div>
                    {i < arr.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-[#71717A] hidden md:block shrink-0" aria-hidden="true" />
                    )}
                  </div>
                ))}
              </div>
              <span className={STAT_CHIP_CLS}>Average setup: 4m 12s</span>
            </div>
          </AnimatedItem>

          {/* CARD 4 — OBJ-05: Trust / hybrid backup */}
          <AnimatedItem>
            <div data-obj="05" className={CARD_CLS}>
              <ShieldCheck className="w-10 h-10 text-[#F97316]" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                You&apos;re never out of the loop.
              </h3>
              <p className="text-[15px] text-[#475569] leading-relaxed">
                Every call is recorded and transcribed. Urgent calls escalate to your phone on your rules. Voco backs you up — it doesn&apos;t cut you out.
              </p>
              <ul className="flex flex-col gap-2 mt-2 text-[15px] text-[#475569]">
                <li className="flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-[#166534] mt-1 shrink-0" aria-hidden="true" /><span>Human escalation chain — you set who gets called when</span></li>
                <li className="flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-[#166534] mt-1 shrink-0" aria-hidden="true" /><span>Every call recorded, transcribed, searchable</span></li>
                <li className="flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-[#166534] mt-1 shrink-0" aria-hidden="true" /><span>Owner-controlled escalation rules — Voco follows what you tell it</span></li>
              </ul>
            </div>
          </AnimatedItem>

          {/* CARD 5 — OBJ-08: Before vs After workflow */}
          <AnimatedItem>
            <div data-obj="08" className={CARD_CLS}>
              <ClipboardList className="w-10 h-10 text-[#F97316]" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                Your workflow, without the voicemail tax.
              </h3>
              <p className="text-[15px] text-[#475569] leading-relaxed">
                Same tools. Same calendar. Same customers. Voco slots in where your missed-call cost used to live.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="rounded-xl border border-stone-200/60 bg-[#FAFAF9] p-4">
                  <p className="text-[14px] font-semibold text-[#71717A] uppercase tracking-wide mb-2">Before</p>
                  <ul className="flex flex-col gap-1 text-[14px] text-[#475569]">
                    <li>Call goes to voicemail</li>
                    <li>Caller hangs up, dials next contractor</li>
                    <li>You find out at 9pm — too late</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-[#F97316]/20 bg-[#F97316]/5 p-4">
                  <p className="text-[14px] font-semibold text-[#F97316] uppercase tracking-wide mb-2">After</p>
                  <ul className="flex flex-col gap-1 text-[14px] text-[#475569]">
                    <li>Call is answered in 1 ring</li>
                    <li>Job booked into your calendar</li>
                    <li>You get the SMS before you finish the one you&apos;re on</li>
                  </ul>
                </div>
              </div>
            </div>
          </AnimatedItem>

          {/* CARD 6 — OBJ-09: Trade specificity */}
          <AnimatedItem>
            <div data-obj="09" className={CARD_CLS}>
              <Wrench className="w-10 h-10 text-[#F97316]" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                It speaks your trade.
              </h3>
              <p className="text-[15px] text-[#475569] leading-relaxed">
                Voco is trained on real service-call language — from compressor short-cycles to tripped GFCIs to flashing replacements. It asks the right follow-ups so the right jobs land.
              </p>
              <div className="grid grid-cols-5 gap-3 mt-2">
                {TRADES.map(({ Icon, name }) => (
                  <div key={name} className="flex flex-col items-center gap-1">
                    <Icon className="w-6 h-6 text-[#0F172A]" strokeWidth={1.75} aria-hidden="true" />
                    <p className="text-[14px] text-[#0F172A]">{name}</p>
                  </div>
                ))}
              </div>
              <p className="text-[14px] text-[#71717A] italic">
                Custom trade vocabulary available on request — just tell Voco what your customers call things.
              </p>
            </div>
          </AnimatedItem>

        </AnimatedStagger>
      </div>
    </section>
  );
}
