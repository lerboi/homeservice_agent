import { AnimatedSection, AnimatedStagger, AnimatedItem } from './AnimatedSection';
import { UserCheck, Clock, Eye } from 'lucide-react';

const CARD_CLS =
  "rounded-2xl bg-white border border-stone-200/60 shadow-sm p-6 flex flex-col gap-4 " +
  "hover:border-[#F97316]/30 hover:shadow-[0_4px_20px_rgba(249,115,22,0.1)] hover:-translate-y-1 " +
  "transition-all duration-200";

const STAT_CHIP_CLS =
  "inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#166534]/10 " +
  "border border-[#166534]/20 text-[14px] font-semibold text-[#166534] self-start italic";

export function YouStayInControlSection() {
  return (
    <>
      {/* Block 1 + Block 2: White background — identity framing + 3 control cards */}
      <section className="bg-white py-20 md:py-28 px-6">
        {/* Block 1: Identity framing */}
        <AnimatedSection>
          <div className="max-w-5xl mx-auto text-center mb-16">
            <div className="text-[14px] font-semibold text-[#F97316] tracking-wide uppercase mb-3">Your rules, your way</div>
            <h2 className="text-3xl md:text-[2.25rem] font-semibold text-[#0F172A] mb-4">You Stay in Control</h2>
            <p className="text-[15px] text-[#475569] leading-relaxed max-w-2xl mx-auto mb-6">
              Smart defaults. Your overrides. Two minutes if you want them — zero if you don&apos;t.
            </p>
            {/* 3-paragraph intro absorbed VERBATIM from IdentitySection.jsx per D-20 */}
            <div className="text-[15px] text-[#475569] leading-relaxed max-w-2xl mx-auto space-y-4 text-left md:text-center">
              <p>
                Voco doesn&apos;t show up on your truck. It doesn&apos;t meet your customers. It doesn&apos;t know your neighborhood the way you do.
              </p>
              <p>
                What it does is pick up the phone when you&apos;re on the roof, in a crawlspace, or finally asleep after a 14-hour day — and it answers the way you told it to.
              </p>
              <p>
                Every job you earned is still yours. Voco just makes sure the next one doesn&apos;t hang up before you can answer.
              </p>
            </div>
          </div>
        </AnimatedSection>

        {/* Block 2: 3 control cards */}
        <div className="pb-0">
          <AnimatedStagger className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1 — WHO (VIP whitelist) */}
            <AnimatedItem>
              <div className={CARD_CLS}>
                <UserCheck className="w-10 h-10 text-[#F97316]" strokeWidth={1.5} />
                <h3 className="text-[14px] font-semibold text-[#0F172A]">WHO reaches you first</h3>
                <p className="text-[15px] text-[#475569] leading-relaxed">
                  Mary calls about her quarterly HVAC check — she gets you, not a bot. Add trusted customers to your VIP list; their calls ring straight through to your phone.
                </p>
                <span className={STAT_CHIP_CLS}>
                  Takes 20 seconds per number. Skip it if you want — nothing breaks.
                </span>
              </div>
            </AnimatedItem>

            {/* Card 2 — WHEN (working hours + forwarding schedule) */}
            <AnimatedItem>
              <div className={CARD_CLS}>
                <Clock className="w-10 h-10 text-[#F97316]" strokeWidth={1.5} />
                <h3 className="text-[14px] font-semibold text-[#0F172A]">WHEN Voco answers</h3>
                <p className="text-[15px] text-[#475569] leading-relaxed">
                  Tuesday afternoons, Sundays, after hours — you decide. Voco picks up when you want it to, and rings you directly the rest of the time.
                </p>
                <span className={STAT_CHIP_CLS}>
                  Pre-set for nights and weekends. Change anytime — or don&apos;t.
                </span>
              </div>
            </AnimatedItem>

            {/* Card 3 — WHAT (owner visibility — compressed OBJ-05) */}
            <AnimatedItem>
              <div className={CARD_CLS}>
                <Eye className="w-10 h-10 text-[#F97316]" strokeWidth={1.5} />
                <h3 className="text-[14px] font-semibold text-[#0F172A]">WHAT happens on every call</h3>
                <p className="text-[15px] text-[#475569] leading-relaxed">
                  Recording, transcript, and urgency tag reach you before the caller hangs up. Emergencies text you instantly. You see everything Voco saw.
                </p>
                <span className={STAT_CHIP_CLS}>
                  No setup. Just on.
                </span>
              </div>
            </AnimatedItem>
          </AnimatedStagger>
        </div>
      </section>

      {/* Block 3: Closing dark pull quote */}
      <section className="relative bg-[#1C1412] py-20 md:py-28 px-6 overflow-hidden">
        {/* Orange radial overlay — matches OwnerControlPullQuote */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(249,115,22,0.10), transparent 70%)' }}
          aria-hidden="true"
        />
        <AnimatedSection>
          <div className="relative max-w-3xl mx-auto text-center">
            <blockquote className="text-[24px] md:text-[30px] font-semibold text-[#F5F5F5] leading-tight">
              &ldquo;You set the rules. Voco follows them.&rdquo;
            </blockquote>
          </div>
        </AnimatedSection>
      </section>
    </>
  );
}
